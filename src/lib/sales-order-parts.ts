/**
 * Sales Order Parts Management
 *
 * Functions for generating parts from project BOM, reserving inventory,
 * and managing fulfillment status
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { checkAvailability, AvailabilityResult, extractBasePartNumber, findExtrusionVariant } from './inventory-availability'

export interface BOMPart {
  partNumber: string
  partName: string
  partType: string
  quantity: number
  unit: string
  cutLength?: number | null
  openingName?: string | null
  productName?: string | null
  masterPartId?: number | null
}

export interface GeneratePartsResult {
  parts: {
    partNumber: string
    partName: string
    partType: string
    quantity: number
    unit: string
    cutLength?: number | null
    openingName?: string | null
    productName?: string | null
    masterPartId?: number | null
  }[]
  availability: AvailabilityResult[]
  hasShortages: boolean
}

/**
 * Generate parts list from project BOM
 * Fetches the BOM from the project API and formats for SalesOrderPart creation
 * @param projectId - The project ID to generate parts from
 * @param cookies - Optional cookie header string to pass to internal API calls
 */
export async function generatePartsFromProject(projectId: number, cookies?: string): Promise<GeneratePartsResult> {
  // Fetch BOM from the project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      openings: {
        include: {
          panels: {
            include: {
              componentInstance: {
                include: {
                  product: {
                    include: {
                      productBOMs: {
                        include: { option: true }
                      },
                      productSubOptions: {
                        include: {
                          category: {
                            include: {
                              individualOptions: {
                                include: {
                                  linkedParts: {
                                    include: {
                                      masterPart: true,
                                      variant: true
                                    }
                                  },
                                  variants: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!project) {
    throw new Error('Project not found')
  }

  // Use fetch to call the BOM API and get the full parts list
  // This leverages the existing complex BOM calculation logic
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Pass cookies for authentication on internal API calls
  if (cookies) {
    headers['Cookie'] = cookies
  }

  // Fetch detailed BOM (not summary) to preserve opening names
  const bomResponse = await fetch(`${baseUrl}/api/projects/${projectId}/bom`, {
    headers
  })

  if (!bomResponse.ok) {
    throw new Error('Failed to fetch project BOM')
  }

  const bomData = await bomResponse.json()

  // Aggregate BOM items by partNumber + openingName to preserve opening info
  // This differs from the summary endpoint which loses opening context
  const aggregated = new Map<string, BOMPart>()

  for (const item of bomData.bomItems || []) {
    // Key by partNumber + openingName to keep parts separate per opening
    const key = `${item.partNumber}|${item.openingName || ''}`

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        partNumber: item.partNumber,
        partName: item.partName,
        partType: item.partType,
        quantity: 0,
        unit: item.unit || 'EA',
        cutLength: item.cutLength || null,
        openingName: item.openingName || null,
        productName: item.productName || null,
        masterPartId: null
      })
    }

    const existing = aggregated.get(key)!
    // Use piece count for quantity — cutLength is preserved separately on BOMPart
    // for manufacturing. Extrusion inventory tracks pieces, not linear inches.
    existing.quantity += item.quantity || 1
  }

  const parts: BOMPart[] = Array.from(aggregated.values())

  // Check availability for all parts
  const availabilityInput = parts.map(p => ({
    partNumber: p.partNumber,
    partName: p.partName,
    quantity: p.quantity,
    masterPartId: p.masterPartId,
    partType: p.partType
  }))

  const availability = await checkAvailability(availabilityInput)
  const hasShortages = availability.some(a => a.shortage > 0)

  return {
    parts,
    availability,
    hasShortages
  }
}

/**
 * Create SalesOrderPart records from a parts list
 */
export async function createSalesOrderParts(
  salesOrderId: number,
  parts: BOMPart[]
): Promise<number> {
  let createdCount = 0

  for (const part of parts) {
    // Try to find the master part by part number (base number without finish/length)
    const isExtrusion = part.partType?.toLowerCase() === 'extrusion'
    const basePartNumber = await extractBasePartNumber(part.partNumber, isExtrusion)
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: basePartNumber }
    })

    // For extrusion parts, also find the specific variant
    let extrusionVariantId: number | null = null
    if (part.partType?.toLowerCase() === 'extrusion' && masterPart) {
      const variant = await findExtrusionVariant(part.partNumber, masterPart.id)
      if (variant) {
        extrusionVariantId = variant.id
      }
    }

    await prisma.salesOrderPart.create({
      data: {
        salesOrderId,
        masterPartId: masterPart?.id ?? null,
        extrusionVariantId,
        partNumber: part.partNumber,
        partName: part.partName,
        partType: part.partType,
        quantity: part.quantity,
        unit: part.unit,
        cutLength: part.cutLength,
        openingName: part.openingName,
        productName: part.productName,
        status: 'PENDING'
      }
    })

    createdCount++
  }

  return createdCount
}

/**
 * Reserve inventory for confirmed sales order parts
 * Increments qtyReserved on ExtrusionVariant (for extrusions) or MasterPart (for others)
 */
export async function reserveInventory(salesOrderId: number, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx || prisma

  const parts = await db.salesOrderPart.findMany({
    where: { salesOrderId }
  })

  // Group by extrusion variant or master part
  const reservationsByVariant = new Map<number, number>()
  const reservationsByMasterPart = new Map<number, number>()

  for (const part of parts) {
    if (part.extrusionVariantId) {
      const current = reservationsByVariant.get(part.extrusionVariantId) || 0
      reservationsByVariant.set(part.extrusionVariantId, current + part.quantity)
    } else if (part.masterPartId) {
      const current = reservationsByMasterPart.get(part.masterPartId) || 0
      reservationsByMasterPart.set(part.masterPartId, current + part.quantity)
    }
  }

  // Update qtyReserved on extrusion variants
  for (const [variantId, quantity] of reservationsByVariant) {
    await db.extrusionVariant.update({
      where: { id: variantId },
      data: { qtyReserved: { increment: quantity } }
    })
  }

  // Update qtyReserved on master parts (non-extrusions)
  for (const [masterPartId, quantity] of reservationsByMasterPart) {
    await db.masterPart.update({
      where: { id: masterPartId },
      data: { qtyReserved: { increment: quantity } }
    })
  }

  // Update part status to RESERVED
  await db.salesOrderPart.updateMany({
    where: {
      salesOrderId,
      OR: [
        { masterPartId: { not: null } },
        { extrusionVariantId: { not: null } }
      ]
    },
    data: { status: 'RESERVED' }
  })
}

/**
 * Release inventory reservations for a cancelled sales order
 * Decrements qtyReserved on ExtrusionVariant (for extrusions) or MasterPart (for others)
 */
export async function releaseInventory(salesOrderId: number, tx?: Prisma.TransactionClient): Promise<void> {
  const db = tx || prisma

  const parts = await db.salesOrderPart.findMany({
    where: {
      salesOrderId,
      status: { in: ['RESERVED', 'PENDING'] }
    }
  })

  const releasesByVariant = new Map<number, number>()
  const releasesByMasterPart = new Map<number, number>()

  for (const part of parts) {
    if (part.extrusionVariantId) {
      const current = releasesByVariant.get(part.extrusionVariantId) || 0
      releasesByVariant.set(part.extrusionVariantId, current + part.quantity)
    } else if (part.masterPartId) {
      const current = releasesByMasterPart.get(part.masterPartId) || 0
      releasesByMasterPart.set(part.masterPartId, current + part.quantity)
    }
  }

  // Decrement qtyReserved on extrusion variants
  for (const [variantId, quantity] of releasesByVariant) {
    await db.extrusionVariant.update({
      where: { id: variantId },
      data: { qtyReserved: { decrement: quantity } }
    })
  }

  // Decrement qtyReserved on master parts (non-extrusions)
  for (const [masterPartId, quantity] of releasesByMasterPart) {
    await db.masterPart.update({
      where: { id: masterPartId },
      data: { qtyReserved: { decrement: quantity } }
    })
  }

  // Update part status to CANCELLED
  await db.salesOrderPart.updateMany({
    where: { salesOrderId },
    data: { status: 'CANCELLED' }
  })
}

/**
 * Bulk deduct inventory for all RESERVED parts on a sales order
 * Used when work orders are generated to transition parts from RESERVED → PICKED
 * Only processes parts with status 'RESERVED', so re-running is a safe no-op
 */
export async function bulkDeductInventory(
  salesOrderId: number,
  userId?: number
): Promise<{ deductedCount: number; skippedCount: number }> {
  const parts = await prisma.salesOrderPart.findMany({
    where: { salesOrderId, status: 'RESERVED' }
  })

  if (parts.length === 0) {
    return { deductedCount: 0, skippedCount: 0 }
  }

  // Aggregate quantities by extrusion variant and master part
  const deductionsByVariant = new Map<number, number>()
  const deductionsByMasterPart = new Map<number, number>()
  let skippedCount = 0

  for (const part of parts) {
    if (part.extrusionVariantId) {
      const current = deductionsByVariant.get(part.extrusionVariantId) || 0
      deductionsByVariant.set(part.extrusionVariantId, current + part.quantity)
    } else if (part.masterPartId) {
      const current = deductionsByMasterPart.get(part.masterPartId) || 0
      deductionsByMasterPart.set(part.masterPartId, current + part.quantity)
    } else {
      skippedCount++
    }
  }

  // Decrement qtyOnHand and qtyReserved on extrusion variants
  for (const [variantId, quantity] of deductionsByVariant) {
    await prisma.extrusionVariant.update({
      where: { id: variantId },
      data: {
        qtyOnHand: { decrement: quantity },
        qtyReserved: { decrement: quantity }
      }
    })
  }

  // Decrement qtyOnHand and qtyReserved on master parts (non-extrusions)
  for (const [masterPartId, quantity] of deductionsByMasterPart) {
    await prisma.masterPart.update({
      where: { id: masterPartId },
      data: {
        qtyOnHand: { decrement: quantity },
        qtyReserved: { decrement: quantity }
      }
    })
  }

  // Update all RESERVED parts to PICKED
  const now = new Date()
  for (const part of parts) {
    if (part.extrusionVariantId || part.masterPartId) {
      await prisma.salesOrderPart.update({
        where: { id: part.id },
        data: {
          status: 'PICKED',
          qtyPicked: part.quantity,
          pickedAt: now,
          pickedById: userId
        }
      })
    }
  }

  const deductedCount = parts.length - skippedCount
  return { deductedCount, skippedCount }
}

/**
 * Deduct inventory when parts are picked
 * Decreases qtyOnHand and qtyReserved on ExtrusionVariant or MasterPart
 */
export async function deductInventory(
  partId: number,
  quantity: number,
  userId?: number
): Promise<void> {
  const part = await prisma.salesOrderPart.findUnique({
    where: { id: partId }
  })

  if (!part) {
    throw new Error('Part not found')
  }

  if (!part.masterPartId && !part.extrusionVariantId) {
    throw new Error('Part has no associated master part or extrusion variant')
  }

  // Deduct from extrusion variant if linked, otherwise from master part
  if (part.extrusionVariantId) {
    await prisma.extrusionVariant.update({
      where: { id: part.extrusionVariantId },
      data: {
        qtyOnHand: { decrement: quantity },
        qtyReserved: { decrement: quantity }
      }
    })
  } else if (part.masterPartId) {
    await prisma.masterPart.update({
      where: { id: part.masterPartId },
      data: {
        qtyOnHand: { decrement: quantity },
        qtyReserved: { decrement: quantity }
      }
    })
  }

  // Update the sales order part
  await prisma.salesOrderPart.update({
    where: { id: partId },
    data: {
      qtyPicked: { increment: quantity },
      status: 'PICKED',
      pickedAt: new Date(),
      pickedById: userId
    }
  })
}

/**
 * Update part status to packed
 */
export async function markPartPacked(
  partId: number,
  quantity: number
): Promise<void> {
  await prisma.salesOrderPart.update({
    where: { id: partId },
    data: {
      qtyPacked: { increment: quantity },
      status: 'PACKED',
      packedAt: new Date()
    }
  })
}

/**
 * Update part status to shipped
 */
export async function markPartShipped(
  partId: number,
  quantity: number
): Promise<void> {
  await prisma.salesOrderPart.update({
    where: { id: partId },
    data: {
      qtyShipped: { increment: quantity },
      status: 'SHIPPED',
      shippedAt: new Date()
    }
  })
}

/**
 * Bulk update part statuses
 */
export async function bulkUpdatePartStatus(
  updates: { partId: number; status: string; quantity?: number }[],
  userId?: number
): Promise<number> {
  let updatedCount = 0

  for (const update of updates) {
    const part = await prisma.salesOrderPart.findUnique({
      where: { id: update.partId }
    })

    if (!part) continue

    const quantity = update.quantity ?? part.quantity

    switch (update.status) {
      case 'PICKED':
        await deductInventory(update.partId, quantity, userId)
        break
      case 'PACKED':
        await markPartPacked(update.partId, quantity)
        break
      case 'SHIPPED':
        await markPartShipped(update.partId, quantity)
        break
      default:
        await prisma.salesOrderPart.update({
          where: { id: update.partId },
          data: { status: update.status as any }
        })
    }

    updatedCount++
  }

  return updatedCount
}

/**
 * Get parts summary for a sales order
 */
export async function getPartsSummary(salesOrderId: number): Promise<{
  total: number
  pending: number
  reserved: number
  picked: number
  packed: number
  shipped: number
  cancelled: number
}> {
  const parts = await prisma.salesOrderPart.groupBy({
    by: ['status'],
    where: { salesOrderId },
    _count: { id: true }
  })

  const summary = {
    total: 0,
    pending: 0,
    reserved: 0,
    picked: 0,
    packed: 0,
    shipped: 0,
    cancelled: 0
  }

  for (const group of parts) {
    const count = group._count.id
    summary.total += count

    switch (group.status) {
      case 'PENDING':
        summary.pending = count
        break
      case 'RESERVED':
        summary.reserved = count
        break
      case 'PICKED':
        summary.picked = count
        break
      case 'PACKED':
        summary.packed = count
        break
      case 'SHIPPED':
        summary.shipped = count
        break
      case 'CANCELLED':
        summary.cancelled = count
        break
    }
  }

  return summary
}


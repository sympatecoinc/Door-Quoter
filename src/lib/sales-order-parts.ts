/**
 * Sales Order Parts Management
 *
 * Functions for generating parts from project BOM, reserving inventory,
 * and managing fulfillment status
 */

import { prisma } from '@/lib/prisma'
import { checkAvailability, AvailabilityResult } from './inventory-availability'

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
    existing.quantity += item.quantity || 1
  }

  const parts: BOMPart[] = Array.from(aggregated.values())

  // Check availability for all parts
  const availabilityInput = parts.map(p => ({
    partNumber: p.partNumber,
    partName: p.partName,
    quantity: p.quantity,
    masterPartId: p.masterPartId
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
    const basePartNumber = extractBasePartNumber(part.partNumber)
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: basePartNumber }
    })

    await prisma.salesOrderPart.create({
      data: {
        salesOrderId,
        masterPartId: masterPart?.id ?? null,
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
 * Increments qtyReserved on MasterPart for each part
 */
export async function reserveInventory(salesOrderId: number): Promise<void> {
  // Get all parts for this sales order
  const parts = await prisma.salesOrderPart.findMany({
    where: { salesOrderId },
    include: { masterPart: true }
  })

  // Group by master part to aggregate quantities
  const reservationsByMasterPart = new Map<number, number>()

  for (const part of parts) {
    if (part.masterPartId) {
      const current = reservationsByMasterPart.get(part.masterPartId) || 0
      reservationsByMasterPart.set(part.masterPartId, current + part.quantity)
    }
  }

  // Update qtyReserved for each master part
  for (const [masterPartId, quantity] of reservationsByMasterPart) {
    await prisma.masterPart.update({
      where: { id: masterPartId },
      data: {
        qtyReserved: { increment: quantity }
      }
    })
  }

  // Update part status to RESERVED
  await prisma.salesOrderPart.updateMany({
    where: { salesOrderId, masterPartId: { not: null } },
    data: { status: 'RESERVED' }
  })
}

/**
 * Release inventory reservations for a cancelled sales order
 * Decrements qtyReserved on MasterPart for each part
 */
export async function releaseInventory(salesOrderId: number): Promise<void> {
  // Get all parts for this sales order that are reserved
  const parts = await prisma.salesOrderPart.findMany({
    where: {
      salesOrderId,
      status: { in: ['RESERVED', 'PENDING'] },
      masterPartId: { not: null }
    }
  })

  // Group by master part to aggregate quantities
  const releasesByMasterPart = new Map<number, number>()

  for (const part of parts) {
    if (part.masterPartId) {
      const current = releasesByMasterPart.get(part.masterPartId) || 0
      releasesByMasterPart.set(part.masterPartId, current + part.quantity)
    }
  }

  // Decrement qtyReserved for each master part
  for (const [masterPartId, quantity] of releasesByMasterPart) {
    await prisma.masterPart.update({
      where: { id: masterPartId },
      data: {
        qtyReserved: { decrement: quantity }
      }
    })
  }

  // Update part status to CANCELLED
  await prisma.salesOrderPart.updateMany({
    where: { salesOrderId },
    data: { status: 'CANCELLED' }
  })
}

/**
 * Deduct inventory when parts are picked
 * Decreases qtyOnHand and qtyReserved on MasterPart
 */
export async function deductInventory(
  partId: number,
  quantity: number,
  userId?: number
): Promise<void> {
  const part = await prisma.salesOrderPart.findUnique({
    where: { id: partId },
    include: { masterPart: true }
  })

  if (!part) {
    throw new Error('Part not found')
  }

  if (!part.masterPartId) {
    throw new Error('Part has no associated master part')
  }

  // Update master part inventory
  await prisma.masterPart.update({
    where: { id: part.masterPartId },
    data: {
      qtyOnHand: { decrement: quantity },
      qtyReserved: { decrement: quantity }
    }
  })

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

/**
 * Extract base part number from full part number
 * Removes finish code (e.g., -BL, -C2) and stock length suffix (e.g., -144)
 */
function extractBasePartNumber(fullPartNumber: string): string {
  // Common finish codes to remove
  const finishCodes = ['-BL', '-C2', '-AL', '-AN', '-MF']

  let baseNumber = fullPartNumber

  // Remove finish code if present
  for (const code of finishCodes) {
    if (baseNumber.includes(code)) {
      baseNumber = baseNumber.replace(code, '')
      break
    }
  }

  // Remove trailing stock length suffix (e.g., -144, -192)
  baseNumber = baseNumber.replace(/-\d+$/, '')

  return baseNumber
}

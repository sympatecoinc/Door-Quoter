import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import type { InventoryAlertsResponse, InventoryAlert, AlertUrgency, DemandSource } from '@/components/purchasing-dashboard/types'

export async function GET() {
  try {
    // Get all master parts with inventory tracking info (non-extrusion parts)
    const nonExtrusionParts = await prisma.masterPart.findMany({
      where: {
        qtyOnHand: { not: null },  // Include all parts with inventory tracking
        partType: { not: 'Extrusion' }  // Exclude extrusions - we'll handle them via variants
      },
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        partType: true,
        qtyOnHand: true,
        qtyReserved: true,
        reorderPoint: true,
        reorderQty: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            displayName: true,
            category: true
          }
        }
      },
      orderBy: [
        { qtyOnHand: 'asc' }
      ]
    })

    // Get extrusion variants with their master part and finish info
    const extrusionVariants = await prisma.extrusionVariant.findMany({
      select: {
        id: true,
        stockLength: true,
        qtyOnHand: true,
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            description: true,
            partType: true,
            qtyReserved: true,
            reorderPoint: true,
            reorderQty: true,
            vendorId: true,
            vendor: {
              select: {
                id: true,
                displayName: true,
                category: true
              }
            }
          }
        },
        finishPricing: {
          select: {
            finishType: true,
            finishCode: true
          }
        }
      },
      orderBy: [
        { qtyOnHand: 'asc' }
      ]
    })

    // Combine non-extrusion parts and extrusion variants into unified structure
    const parts = [
      ...nonExtrusionParts.map(part => ({
        ...part,
        variantId: null as number | null,
        stockLength: null as number | null,
        color: null as string | null
      })),
      ...extrusionVariants.map(variant => ({
        id: variant.masterPart.id,
        partNumber: variant.masterPart.partNumber,
        baseName: variant.masterPart.baseName,
        description: variant.masterPart.description,
        partType: variant.masterPart.partType,
        qtyOnHand: variant.qtyOnHand,
        qtyReserved: variant.masterPart.qtyReserved,
        reorderPoint: variant.masterPart.reorderPoint,
        reorderQty: variant.masterPart.reorderQty,
        vendorId: variant.masterPart.vendorId,
        vendor: variant.masterPart.vendor,
        variantId: variant.id,
        stockLength: variant.stockLength,
        color: variant.finishPricing?.finishType || 'Mill Finish'
      }))
    ]

    // Get confirmed sales order parts to build demand sources for reserved qty
    const confirmedSOParts = await prisma.salesOrderPart.findMany({
      where: {
        salesOrder: {
          status: {
            in: ['CONFIRMED', 'SENT', 'PARTIAL', 'PARTIALLY_INVOICED']
          }
        },
        masterPartId: { not: null }
      },
      select: {
        masterPartId: true,
        partNumber: true,
        quantity: true,
        qtyShipped: true,
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            shipDate: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Build reserved demand lookup by masterPartId, aggregating by project
    const reservedDemandByPart: Map<number, DemandSource[]> = new Map()
    for (const soPart of confirmedSOParts) {
      if (!soPart.masterPartId) continue
      const remaining = soPart.quantity - soPart.qtyShipped
      if (remaining <= 0) continue

      const projectId = soPart.salesOrder.project?.id || soPart.salesOrder.id
      const projectName = soPart.salesOrder.project?.name || `SO: ${soPart.salesOrder.orderNumber}`

      const sources = reservedDemandByPart.get(soPart.masterPartId) || []

      // Check if we already have an entry for this project - aggregate if so
      const existingSource = sources.find(s => s.projectId === projectId)
      if (existingSource) {
        existingSource.quantity += remaining
      } else {
        sources.push({
          type: 'reserved',
          projectId,
          projectName,
          projectStatus: soPart.salesOrder.status,
          quantity: remaining,
          shipDate: soPart.salesOrder.shipDate?.toISOString() || null
        })
      }
      reservedDemandByPart.set(soPart.masterPartId, sources)
    }

    // Get projected demand from pipeline projects (QUOTE_ACCEPTED, ACTIVE without confirmed SO)
    const pipelineProjects = await prisma.project.findMany({
      where: {
        status: {
          in: ['QUOTE_ACCEPTED', 'ACTIVE']
        },
        salesOrders: {
          none: {
            status: {
              in: ['CONFIRMED', 'SENT', 'PARTIAL', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'PAID']
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        shipDate: true,
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: true
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

    // Get parts that already have open POs (any status except COMPLETE and CANCELLED)
    const partsWithOpenPOs = await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          status: {
            notIn: [POStatus.COMPLETE, POStatus.CANCELLED]
          }
        },
        itemRefName: { not: null }
      },
      select: {
        itemRefName: true
      }
    })

    // Build a set of part numbers that have open POs
    const partNumbersWithOpenPOs = new Set<string>()
    for (const line of partsWithOpenPOs) {
      if (line.itemRefName) {
        partNumbersWithOpenPOs.add(line.itemRefName)
      }
    }
    console.log(`[Inventory Alerts] Found ${partNumbersWithOpenPOs.size} parts with open POs:`, Array.from(partNumbersWithOpenPOs))

    // Build projected demand lookup by part number
    const projectedDemandByPartNumber: Map<string, { qty: number; sources: DemandSource[] }> = new Map()

    for (const project of pipelineProjects) {
      const projectPartQuantities: Map<string, number> = new Map()

      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue
          const product = panel.componentInstance.product

          for (const bom of product.productBOMs) {
            if (!bom.partNumber || bom.optionId) continue
            const currentQty = projectPartQuantities.get(bom.partNumber) || 0
            projectPartQuantities.set(bom.partNumber, currentQty + (bom.quantity || 1))
          }
        }
      }

      // Add to projected demand lookup
      for (const [partNumber, quantity] of projectPartQuantities) {
        const existing = projectedDemandByPartNumber.get(partNumber) || { qty: 0, sources: [] }
        existing.qty += quantity
        existing.sources.push({
          type: 'projected',
          projectId: project.id,
          projectName: project.name,
          projectStatus: project.status,
          quantity: quantity,
          shipDate: project.shipDate?.toISOString() || null
        })
        projectedDemandByPartNumber.set(partNumber, existing)
      }
    }

    // Calculate alerts with full demand breakdown
    const alerts: InventoryAlert[] = parts.map(part => {
      const qtyOnHand = part.qtyOnHand || 0
      const qtyReserved = part.qtyReserved || 0
      const reorderPoint = part.reorderPoint

      // Get projected demand for this part
      const projectedData = projectedDemandByPartNumber.get(part.partNumber)
      const projectedDemand = projectedData?.qty || 0

      // Calculate available qty = onHand - reserved - projected
      const availableQty = qtyOnHand - qtyReserved - projectedDemand
      const shortage = Math.max(0, -availableQty)

      // Build demand sources array
      const demandSources: DemandSource[] = []

      // Add reserved sources
      const reservedSources = reservedDemandByPart.get(part.id) || []
      demandSources.push(...reservedSources)

      // Add projected sources
      if (projectedData?.sources) {
        demandSources.push(...projectedData.sources)
      }

      // Determine urgency based on multiple factors
      let urgency: AlertUrgency = 'healthy'

      if (availableQty <= 0 && (qtyReserved > 0 || projectedDemand > 0)) {
        // Short on stock with actual demand
        urgency = 'critical'
      } else if (qtyOnHand <= 0) {
        // Zero physical inventory
        urgency = 'critical'
      } else if (availableQty <= 0 && projectedDemand > 0) {
        // Would be short if projected demand materializes
        urgency = 'projected'
      } else if (reorderPoint !== null && qtyOnHand <= reorderPoint) {
        // Below reorder point
        urgency = 'low'
      }

      return {
        partId: part.id,
        partNumber: part.partNumber,
        description: part.description || part.baseName,
        qtyOnHand,
        qtyReserved,
        projectedDemand,
        availableQty,
        shortage,
        reorderPoint: part.reorderPoint,
        reorderQty: part.reorderQty,
        urgency,
        vendorId: part.vendorId,
        vendorName: part.vendor?.displayName || null,
        category: part.vendor?.category || part.partType,
        demandSources,
        // Extrusion variant details
        color: part.color,
        stockLength: part.stockLength,
        variantId: part.variantId
      }
    })

    // Filter to only show items needing attention (not healthy) AND not already on order
    const alertsNeedingAttention = alerts.filter(a => {
      // Skip healthy items
      if (a.urgency === 'healthy') return false

      // Skip items that already have open POs
      if (partNumbersWithOpenPOs.has(a.partNumber)) {
        console.log(`[Inventory Alerts] Skipping ${a.partNumber} - already has open PO`)
        return false
      }

      return true
    })

    // Calculate summary
    const summary = {
      critical: alerts.filter(a => a.urgency === 'critical').length,
      low: alerts.filter(a => a.urgency === 'low').length,
      projected: alerts.filter(a => a.urgency === 'projected').length,
      healthy: alerts.filter(a => a.urgency === 'healthy').length,
      total: alerts.length
    }

    const response: InventoryAlertsResponse = {
      alerts: alertsNeedingAttention,
      summary
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching inventory alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory alerts' },
      { status: 500 }
    )
  }
}

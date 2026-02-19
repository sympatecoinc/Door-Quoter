import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import { evaluateFormula } from '@/lib/bom/calculations'
import { calculateOptimizedStockPieces, calculateMultiStockOptimization } from '@/lib/bom-utils'
import type { InventoryAlertsResponse, InventoryAlert, AlertUrgency, DemandSource } from '@/components/purchasing-dashboard/types'

export const dynamic = 'force-dynamic'

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
        unit: true,
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
        unit: null as string | null,
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

    // Find confirmed SO Parts for extrusions that have no matching variant link
    // (variant may have been created after the SO was confirmed)
    const unresolvedExtrusionParts = await prisma.salesOrderPart.findMany({
      where: {
        salesOrder: {
          status: { in: ['CONFIRMED', 'SENT', 'PARTIAL', 'PARTIALLY_INVOICED'] }
        },
        partType: 'Extrusion',
        extrusionVariantId: null,
        masterPartId: { not: null }
      },
      select: {
        partNumber: true,
        partName: true,
        quantity: true,
        qtyShipped: true,
        masterPartId: true,
        masterPart: {
          select: {
            id: true, partNumber: true, baseName: true, description: true,
            partType: true, reorderPoint: true, reorderQty: true,
            vendorId: true, vendor: { select: { id: true, displayName: true, category: true } }
          }
        },
        salesOrder: {
          select: { id: true, orderNumber: true, status: true, shipDate: true,
            project: { select: { id: true, name: true } }
          }
        }
      }
    })

    // Try to resolve each unresolved part to an existing variant by matching partNumber suffix
    // Build a variant lookup for the relevant masterParts
    const unresolvedMpIds = [...new Set(unresolvedExtrusionParts.map(p => p.masterPartId).filter((id): id is number => id !== null))]
    const resolverVariants = unresolvedMpIds.length > 0
      ? await prisma.extrusionVariant.findMany({
          where: { masterPartId: { in: unresolvedMpIds } },
          select: { id: true, masterPartId: true, stockLength: true, finishPricing: { select: { finishCode: true } } }
        })
      : []
    const resolverByMpId = new Map<number, typeof resolverVariants>()
    for (const v of resolverVariants) {
      const list = resolverByMpId.get(v.masterPartId) || []
      list.push(v)
      resolverByMpId.set(v.masterPartId, list)
    }

    // Only create synthetic entries for parts that truly have no matching variant
    const trulyUnresolvedByMasterPart = new Map<number, {
      masterPartId: number, masterPartNumber: string, baseName: string,
      description: string | null, reorderPoint: number | null, reorderQty: number | null,
      vendorId: number | null, vendor: { id: number; displayName: string; category: string | null } | null,
      totalRemaining: number
    }>()

    for (const soPart of unresolvedExtrusionParts) {
      if (!soPart.masterPartId || !soPart.masterPart) continue
      const remaining = soPart.quantity - soPart.qtyShipped
      if (remaining <= 0) continue

      // Try to match this part's partNumber to an existing variant
      const candidates = resolverByMpId.get(soPart.masterPartId) || []
      let resolved = false
      for (const v of candidates) {
        const lengthStr = String(Math.round(v.stockLength))
        const suffix = v.finishPricing?.finishCode
          ? `-${v.finishPricing.finishCode}-${lengthStr}`
          : `-${lengthStr}`
        if (soPart.partNumber.endsWith(suffix)) {
          resolved = true
          break
        }
      }
      if (resolved) continue  // Variant exists — already in the parts array with real inventory

      const existing = trulyUnresolvedByMasterPart.get(soPart.masterPartId)
      if (existing) {
        existing.totalRemaining += remaining
      } else {
        trulyUnresolvedByMasterPart.set(soPart.masterPartId, {
          masterPartId: soPart.masterPart.id,
          masterPartNumber: soPart.masterPart.partNumber,
          baseName: soPart.masterPart.baseName,
          description: soPart.masterPart.description,
          reorderPoint: soPart.masterPart.reorderPoint,
          reorderQty: soPart.masterPart.reorderQty,
          vendorId: soPart.masterPart.vendorId,
          vendor: soPart.masterPart.vendor,
          totalRemaining: remaining
        })
      }
    }

    // Add synthetic entries with qtyOnHand: 0 only for truly missing variants
    for (const [, data] of trulyUnresolvedByMasterPart) {
      parts.push({
        id: data.masterPartId,
        partNumber: data.masterPartNumber,
        baseName: data.baseName,
        description: data.description,
        partType: 'Extrusion',
        unit: null,
        qtyOnHand: 0,
        qtyReserved: data.totalRemaining,
        reorderPoint: data.reorderPoint,
        reorderQty: data.reorderQty,
        vendorId: data.vendorId,
        vendor: data.vendor,
        variantId: null,
        stockLength: null,
        color: null
      })
    }

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
        unit: true,
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
          unit: soPart.unit || undefined,
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

    // Build a lookup for extrusion parts' isMillFinish flag
    const extrusionMasterParts = await prisma.masterPart.findMany({
      where: { partType: 'Extrusion' },
      select: { partNumber: true, isMillFinish: true }
    })
    const isMillFinishMap = new Map(extrusionMasterParts.map(p => [p.partNumber, p.isMillFinish || false]))

    // Pre-fetch CutStock part numbers and stock length rules for bin-packing optimization
    const cutStockMasterParts = await prisma.masterPart.findMany({
      where: { partType: 'CutStock' },
      include: { stockLengthRules: { where: { isActive: true } } }
    })
    const cutStockPartNumbers = new Set(cutStockMasterParts.map(mp => mp.partNumber))
    const cutStockStockLengthMap = new Map<string, number[]>()
    for (const mp of cutStockMasterParts) {
      const lengths = mp.stockLengthRules
        .map(r => r.stockLength)
        .filter((l): l is number => l !== null && l > 0)
      if (lengths.length > 0) {
        cutStockStockLengthMap.set(mp.partNumber, lengths)
      }
    }

    // Build projected demand lookup by part key (partNumber for non-extrusions, partNumber|finishColor for extrusions)
    const projectedDemandByKey: Map<string, { qty: number; sources: DemandSource[] }> = new Map()

    for (const project of pipelineProjects) {
      const projectPartQuantities: Map<string, number> = new Map()
      // Accumulate CutStock cut lengths per part for bin-packing after all openings
      const projectCutStockCuts: Map<string, { cutLengths: number[], stockLengths: number[] }> = new Map()

      for (const opening of project.openings) {
        const openingFinishColor = opening.finishColor || null

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue
          const product = panel.componentInstance.product
          const panelWidth = panel.width || 0
          const panelHeight = panel.height || 0

          for (const bom of product.productBOMs) {
            if (!bom.partNumber || bom.optionId) continue

            // Detect CutStock via MasterPart partType (ProductBOM may have 'Hardware')
            const isCutStock = bom.partType === 'CutStock' ||
              (bom.partType === 'Hardware' && cutStockPartNumbers.has(bom.partNumber))

            // CutStock: evaluate formula to get cut length, accumulate for bin-packing
            if (isCutStock && bom.formula) {
              const cutLength = evaluateFormula(bom.formula, { width: panelWidth, height: panelHeight })
              if (cutLength > 0) {
                const entry = projectCutStockCuts.get(bom.partNumber) || {
                  cutLengths: [],
                  stockLengths: cutStockStockLengthMap.get(bom.partNumber) || []
                }
                const qty = bom.quantity || 1
                for (let i = 0; i < qty; i++) {
                  entry.cutLengths.push(cutLength)
                }
                projectCutStockCuts.set(bom.partNumber, entry)
              }
              continue
            }

            const bomUnit = (bom.unit || 'EA').toUpperCase()
            const isExtrusion = bom.partType === 'Extrusion'
            let demand: number

            if (!isExtrusion && (bomUnit === 'LF' || bomUnit === 'IN') && bom.formula) {
              // For non-extrusion linear parts (Hardware, Fastener), calculate linear demand
              const calculatedLength = evaluateFormula(bom.formula, { width: panelWidth, height: panelHeight })
              const linearDemand = bomUnit === 'LF' ? calculatedLength / 12 : calculatedLength
              demand = linearDemand * (bom.quantity || 1)
            } else {
              // For extrusions and EA parts: demand is counted in pieces
              demand = bom.quantity || 1
            }

            // Build demand key: include finish color for extrusions so demand maps to correct variant
            let demandKey = bom.partNumber
            if (bom.partType === 'Extrusion') {
              const isMillFinish = isMillFinishMap.get(bom.partNumber) || false
              const finishColor = isMillFinish ? 'Mill Finish' : (openingFinishColor || 'Mill Finish')
              demandKey = `${bom.partNumber}|${finishColor}`
            }

            const currentQty = projectPartQuantities.get(demandKey) || 0
            projectPartQuantities.set(demandKey, currentQty + demand)
          }
        }
      }

      // Bin-pack accumulated CutStock cuts to get stock pieces needed
      for (const [partNumber, { cutLengths, stockLengths }] of projectCutStockCuts) {
        let stockPiecesNeeded: number
        if (stockLengths.length > 1) {
          const result = calculateMultiStockOptimization(stockLengths, cutLengths)
          stockPiecesNeeded = result ? result.stockPieces.length : cutLengths.length
        } else if (stockLengths.length === 1) {
          const result = calculateOptimizedStockPieces(cutLengths, stockLengths[0])
          stockPiecesNeeded = result.stockPiecesNeeded
        } else {
          // No stock length rules — fall back to cut piece count
          stockPiecesNeeded = cutLengths.length
        }
        const currentQty = projectPartQuantities.get(partNumber) || 0
        projectPartQuantities.set(partNumber, currentQty + stockPiecesNeeded)
      }

      // Add to projected demand lookup
      for (const [key, quantity] of projectPartQuantities) {
        const existing = projectedDemandByKey.get(key) || { qty: 0, sources: [] }
        existing.qty += quantity
        existing.sources.push({
          type: 'projected',
          projectId: project.id,
          projectName: project.name,
          projectStatus: project.status,
          quantity: quantity,
          shipDate: project.shipDate?.toISOString() || null
        })
        projectedDemandByKey.set(key, existing)
      }
    }

    // Calculate alerts with full demand breakdown
    const alerts: InventoryAlert[] = parts.map(part => {
      const qtyOnHand = part.qtyOnHand || 0
      const qtyReserved = part.qtyReserved || 0
      const reorderPoint = part.reorderPoint

      // Get projected demand for this part
      // For extrusion variants, use finish-aware key to match demand to correct variant
      let demandKey = part.partNumber
      if (part.variantId) {
        demandKey = `${part.partNumber}|${part.color || 'Mill Finish'}`
      }
      const projectedData = projectedDemandByKey.get(demandKey)
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
        unit: part.unit || undefined,
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

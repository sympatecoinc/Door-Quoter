import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MRPResponse, MRPRequirement } from '@/components/purchasing-dashboard/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get active/confirmed projects with their BOM requirements
    const projects = await prisma.project.findMany({
      where: {
        status: {
          in: ['QUOTE_ACCEPTED', 'ACTIVE']
        }
      },
      select: {
        id: true,
        name: true,
        shipDate: true,
        boms: {
          select: {
            partName: true,
            quantity: true,
            materialType: true
          }
        }
      }
    })

    // Get active Sales Orders with their parts (include FK fields)
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        status: {
          in: ['CONFIRMED', 'SENT', 'PARTIAL', 'PARTIALLY_INVOICED']
        }
      },
      select: {
        id: true,
        orderNumber: true,
        shipDate: true,
        parts: {
          select: {
            partNumber: true,
            partName: true,
            partType: true,
            quantity: true,
            qtyShipped: true,
            masterPartId: true,
            extrusionVariantId: true
          }
        }
      }
    })

    // Aggregate requirements by inventory key
    // Keys: "ev:{extrusionVariantId}" | "mp:{masterPartId}" | "pn:{partName}" (legacy BOM)
    const requirementsByKey: Map<string, {
      partName: string
      materialType: string
      totalQty: number
      neededByDate: Date | null
      projects: Array<{ id: number; name: string; qty: number; type: 'project' | 'salesOrder' }>
      // Track FK IDs for inventory lookups
      masterPartId: number | null
      extrusionVariantId: number | null
    }> = new Map()

    // Add Project BOM requirements (legacy path - keyed by partName)
    for (const project of projects) {
      for (const bom of project.boms) {
        const key = `pn:${bom.partName}`
        const existing = requirementsByKey.get(key) || {
          partName: bom.partName,
          materialType: bom.materialType,
          totalQty: 0,
          neededByDate: null,
          projects: [],
          masterPartId: null,
          extrusionVariantId: null
        }

        existing.totalQty += bom.quantity
        existing.projects.push({
          id: project.id,
          name: project.name,
          qty: bom.quantity,
          type: 'project'
        })

        if (project.shipDate) {
          if (!existing.neededByDate || new Date(project.shipDate) < existing.neededByDate) {
            existing.neededByDate = new Date(project.shipDate)
          }
        }

        requirementsByKey.set(key, existing)
      }
    }

    // Pre-fetch variants for extrusion SO parts missing extrusionVariantId
    // (variant may have been created after the SO was confirmed)
    const unresolvedMasterPartIds = new Set<number>()
    for (const so of salesOrders) {
      for (const part of so.parts) {
        if (part.partType === 'Extrusion' && !part.extrusionVariantId && part.masterPartId) {
          unresolvedMasterPartIds.add(part.masterPartId)
        }
      }
    }

    const variantsByMasterPartId = new Map<number, Array<{
      id: number; stockLength: number; finishCode: string | null; masterPartNumber: string
    }>>()

    if (unresolvedMasterPartIds.size > 0) {
      const unresolvedVariants = await prisma.extrusionVariant.findMany({
        where: { masterPartId: { in: Array.from(unresolvedMasterPartIds) } },
        select: {
          id: true, masterPartId: true, stockLength: true,
          masterPart: { select: { partNumber: true } },
          finishPricing: { select: { finishCode: true } }
        }
      })
      for (const v of unresolvedVariants) {
        const list = variantsByMasterPartId.get(v.masterPartId) || []
        list.push({
          id: v.id,
          stockLength: v.stockLength,
          finishCode: v.finishPricing?.finishCode || null,
          masterPartNumber: v.masterPart.partNumber
        })
        variantsByMasterPartId.set(v.masterPartId, list)
      }
    }

    // Try to match an SO part number to a specific variant
    function resolveVariantFromPartNumber(partNumber: string, masterPartId: number): number | null {
      const variants = variantsByMasterPartId.get(masterPartId)
      if (!variants) return null
      for (const v of variants) {
        const lengthStr = String(Math.round(v.stockLength))
        const suffix = v.finishCode ? `-${v.finishCode}-${lengthStr}` : `-${lengthStr}`
        if (partNumber.endsWith(suffix)) return v.id
      }
      return null
    }

    // Add Sales Order parts requirements using FK-based keys
    for (const so of salesOrders) {
      // Aggregate parts by inventory key within this SO
      const soPartsByKey: Map<string, { partType: string; totalRemainingQty: number; masterPartId: number | null; extrusionVariantId: number | null }> = new Map()

      for (const part of so.parts) {
        const remainingQty = part.quantity - part.qtyShipped
        if (remainingQty <= 0) continue

        // Determine inventory key based on FK relationships
        let key: string
        let resolvedVariantId = part.extrusionVariantId
        if (part.extrusionVariantId) {
          key = `ev:${part.extrusionVariantId}`
        } else if (part.partType === 'Extrusion' && part.masterPartId) {
          // Variant link missing — try to resolve from part number
          resolvedVariantId = resolveVariantFromPartNumber(part.partNumber, part.masterPartId)
          if (resolvedVariantId) {
            key = `ev:${resolvedVariantId}`
          } else {
            key = `mp:${part.masterPartId}`
          }
        } else if (part.masterPartId) {
          key = `mp:${part.masterPartId}`
        } else {
          // No inventory link (Glass, Options without masterPartId) - skip from MRP
          continue
        }

        const existing = soPartsByKey.get(key)
        if (existing) {
          existing.totalRemainingQty += remainingQty
        } else {
          soPartsByKey.set(key, {
            partType: part.partType,
            totalRemainingQty: remainingQty,
            masterPartId: part.masterPartId,
            extrusionVariantId: resolvedVariantId
          })
        }
      }

      // Add aggregated SO parts to requirements
      for (const [key, soPart] of soPartsByKey) {
        const existing = requirementsByKey.get(key) || {
          partName: key, // placeholder, replaced below with real part info
          materialType: soPart.partType,
          totalQty: 0,
          neededByDate: null,
          projects: [],
          masterPartId: soPart.masterPartId,
          extrusionVariantId: soPart.extrusionVariantId
        }

        existing.totalQty += soPart.totalRemainingQty
        // Preserve FK IDs (may already be set from another SO)
        if (!existing.masterPartId) existing.masterPartId = soPart.masterPartId
        if (!existing.extrusionVariantId) existing.extrusionVariantId = soPart.extrusionVariantId

        existing.projects.push({
          id: so.id,
          name: `SO: ${so.orderNumber}`,
          qty: soPart.totalRemainingQty,
          type: 'salesOrder'
        })

        if (so.shipDate) {
          if (!existing.neededByDate || new Date(so.shipDate) < existing.neededByDate) {
            existing.neededByDate = new Date(so.shipDate)
          }
        }

        requirementsByKey.set(key, existing)
      }
    }

    // Collect IDs for batch fetching
    const masterPartIds = new Set<number>()
    const extrusionVariantIds = new Set<number>()

    for (const [key, req] of requirementsByKey) {
      if (key.startsWith('ev:') && req.extrusionVariantId) {
        extrusionVariantIds.add(req.extrusionVariantId)
      }
      if (req.masterPartId) {
        masterPartIds.add(req.masterPartId)
      }
    }

    // Fetch MasterParts and ExtrusionVariants by ID
    const [masterParts, extrusionVariants] = await Promise.all([
      masterPartIds.size > 0
        ? prisma.masterPart.findMany({
            where: { id: { in: Array.from(masterPartIds) } },
            select: {
              id: true,
              partNumber: true,
              baseName: true,
              description: true,
              partType: true,
              qtyOnHand: true
            }
          })
        : [],
      extrusionVariantIds.size > 0
        ? prisma.extrusionVariant.findMany({
            where: { id: { in: Array.from(extrusionVariantIds) } },
            select: {
              id: true,
              masterPartId: true,
              stockLength: true,
              qtyOnHand: true,
              masterPart: {
                select: {
                  id: true,
                  partNumber: true,
                  baseName: true,
                  description: true,
                  partType: true
                }
              },
              finishPricing: {
                select: {
                  finishCode: true
                }
              }
            }
          })
        : []
    ])

    const masterPartById = new Map(masterParts.map(p => [p.id, p]))
    const variantById = new Map(extrusionVariants.map(v => [v.id, v]))

    // Build reverse lookup: masterPart.partNumber → masterPart.id (for PO matching)
    const masterPartIdByPartNumber = new Map(masterParts.map(p => [p.partNumber, p.id]))

    // Build reverse lookup: variant partNumber pattern → ev key (for PO matching)
    // PO itemRefName for extrusions typically matches the SO partNumber: "basePN-finishCode-stockLength"
    const evKeyByVariantPartNumber = new Map<string, string>()
    for (const variant of extrusionVariants) {
      const basePN = variant.masterPart.partNumber
      const finishCode = variant.finishPricing?.finishCode || null
      const stockLen = Math.round(variant.stockLength)
      // Reconstruct the expected PO itemRefName pattern
      if (finishCode) {
        evKeyByVariantPartNumber.set(`${basePN}-${finishCode}-${stockLen}`, `ev:${variant.id}`)
      } else {
        // Mill finish - try with and without suffix
        evKeyByVariantPartNumber.set(`${basePN}-${stockLen}`, `ev:${variant.id}`)
      }
    }

    // Get on-order quantities from open POs
    const openPOLines = await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          status: {
            in: ['SENT', 'ACKNOWLEDGED', 'PARTIAL']
          }
        }
      },
      select: {
        itemRefName: true,
        description: true,
        quantity: true,
        quantityReceived: true
      }
    })

    // Aggregate on-order quantities, matching to inventory keys
    const onOrderByKey: Map<string, number> = new Map()
    for (const line of openPOLines) {
      const itemName = line.itemRefName || line.description || ''
      const remaining = line.quantity - line.quantityReceived
      if (remaining <= 0) continue

      // Try to match PO line to an inventory key:
      // 1. Check if it matches an extrusion variant pattern
      const evKey = evKeyByVariantPartNumber.get(itemName)
      if (evKey) {
        onOrderByKey.set(evKey, (onOrderByKey.get(evKey) || 0) + remaining)
        continue
      }

      // 2. Check if it matches a MasterPart partNumber → mp key
      const mpId = masterPartIdByPartNumber.get(itemName)
      if (mpId) {
        const mpKey = `mp:${mpId}`
        onOrderByKey.set(mpKey, (onOrderByKey.get(mpKey) || 0) + remaining)
        continue
      }

      // 3. Fall back to legacy pn: key for BOM-based requirements
      const pnKey = `pn:${itemName}`
      if (requirementsByKey.has(pnKey)) {
        onOrderByKey.set(pnKey, (onOrderByKey.get(pnKey) || 0) + remaining)
      }
    }

    // Build requirements list
    const requirements: MRPRequirement[] = []

    for (const [key, req] of requirementsByKey) {
      let onHandQty = 0
      let partId = 0
      let partNumber = req.partName
      let description: string | null = null
      let partType = req.materialType

      if (key.startsWith('ev:') && req.extrusionVariantId) {
        // Extrusion variant - inventory is at variant level
        const variant = variantById.get(req.extrusionVariantId)
        if (variant) {
          onHandQty = variant.qtyOnHand
          partId = variant.masterPart.id
          partNumber = variant.masterPart.partNumber
          description = variant.masterPart.description || variant.masterPart.baseName
          partType = variant.masterPart.partType
          // Append finish/length info to description for clarity
          const finishCode = variant.finishPricing?.finishCode
          const stockLen = Math.round(variant.stockLength)
          if (finishCode) {
            partNumber = `${partNumber}-${finishCode}-${stockLen}`
          } else {
            partNumber = `${partNumber}-${stockLen}`
          }
        }
      } else if (key.startsWith('mp:') && req.masterPartId) {
        const mp = masterPartById.get(req.masterPartId)
        if (mp) {
          // For extrusion parts keyed as mp: (no matching variant exists),
          // inventory is 0 — if variant existed it would be keyed as ev:
          onHandQty = mp.partType === 'Extrusion' ? 0 : (mp.qtyOnHand || 0)
          partId = mp.id
          partNumber = mp.partNumber
          description = mp.description || mp.baseName
          partType = mp.partType
        }
      } else if (key.startsWith('pn:')) {
        // Legacy BOM path - try string match against masterParts
        const mpId = masterPartIdByPartNumber.get(req.partName)
        if (mpId) {
          const mp = masterPartById.get(mpId)
          if (mp) {
            onHandQty = mp.qtyOnHand || 0
            partId = mp.id
            partNumber = mp.partNumber
            description = mp.description || mp.baseName
            partType = mp.partType
          }
        }
      }

      const onOrderQty = onOrderByKey.get(key) || 0
      const gap = onHandQty + onOrderQty - req.totalQty

      requirements.push({
        partId,
        partNumber,
        description,
        partType,
        requiredQty: req.totalQty,
        onHandQty,
        onOrderQty,
        gap,
        neededByDate: req.neededByDate?.toISOString() || null,
        projects: req.projects
      })
    }

    // Sort by gap (shortages first)
    requirements.sort((a, b) => a.gap - b.gap)

    const summary = {
      totalItems: requirements.length,
      shortages: requirements.filter(r => r.gap < 0).length,
      adequate: requirements.filter(r => r.gap >= 0).length
    }

    const response: MRPResponse = {
      requirements,
      summary
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching MRP data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MRP data' },
      { status: 500 }
    )
  }
}

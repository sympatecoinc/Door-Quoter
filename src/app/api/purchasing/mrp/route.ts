import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { MRPResponse, MRPRequirement } from '@/components/purchasing-dashboard/types'

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

    // Get active Sales Orders with their parts
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
            masterPartId: true
          }
        }
      }
    })

    // Aggregate requirements by part
    const requirementsByPart: Map<string, {
      partName: string
      materialType: string
      totalQty: number
      neededByDate: Date | null
      projects: Array<{ id: number; name: string; qty: number; type: 'project' | 'salesOrder' }>
    }> = new Map()

    // Add Project BOM requirements
    for (const project of projects) {
      for (const bom of project.boms) {
        const existing = requirementsByPart.get(bom.partName) || {
          partName: bom.partName,
          materialType: bom.materialType,
          totalQty: 0,
          neededByDate: null,
          projects: []
        }

        existing.totalQty += bom.quantity
        existing.projects.push({
          id: project.id,
          name: project.name,
          qty: bom.quantity,
          type: 'project'
        })

        // Track earliest ship date
        if (project.shipDate) {
          if (!existing.neededByDate || new Date(project.shipDate) < existing.neededByDate) {
            existing.neededByDate = new Date(project.shipDate)
          }
        }

        requirementsByPart.set(bom.partName, existing)
      }
    }

    // Add Sales Order parts requirements (only unfulfilled quantity)
    for (const so of salesOrders) {
      for (const part of so.parts) {
        // Calculate remaining quantity needed (not yet shipped)
        const remainingQty = part.quantity - part.qtyShipped
        if (remainingQty <= 0) continue // Skip fully shipped parts

        const existing = requirementsByPart.get(part.partNumber) || {
          partName: part.partNumber,
          materialType: part.partType,
          totalQty: 0,
          neededByDate: null,
          projects: []
        }

        existing.totalQty += remainingQty
        existing.projects.push({
          id: so.id,
          name: `SO: ${so.orderNumber}`,
          qty: remainingQty,
          type: 'salesOrder'
        })

        // Track earliest ship date
        if (so.shipDate) {
          if (!existing.neededByDate || new Date(so.shipDate) < existing.neededByDate) {
            existing.neededByDate = new Date(so.shipDate)
          }
        }

        requirementsByPart.set(part.partNumber, existing)
      }
    }

    // Get on-hand quantities from MasterParts
    const masterParts = await prisma.masterPart.findMany({
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        partType: true,
        qtyOnHand: true
      }
    })

    const partLookup = new Map(masterParts.map(p => [p.partNumber, p]))

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

    // Aggregate on-order quantities
    const onOrderByPart: Map<string, number> = new Map()
    for (const line of openPOLines) {
      const partName = line.itemRefName || line.description || ''
      const remaining = line.quantity - line.quantityReceived
      onOrderByPart.set(partName, (onOrderByPart.get(partName) || 0) + remaining)
    }

    // Build requirements list
    const requirements: MRPRequirement[] = []

    for (const [partName, req] of requirementsByPart) {
      const masterPart = partLookup.get(partName)
      const onHandQty = masterPart?.qtyOnHand || 0
      const onOrderQty = onOrderByPart.get(partName) || 0
      const gap = onHandQty + onOrderQty - req.totalQty

      requirements.push({
        partId: masterPart?.id || 0,
        partNumber: masterPart?.partNumber || partName,
        description: masterPart?.description || masterPart?.baseName || null,
        partType: masterPart?.partType || req.materialType,
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

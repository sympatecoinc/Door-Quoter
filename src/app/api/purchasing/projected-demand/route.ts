import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ProjectedDemandResponse, ProjectedDemandItem } from '@/components/purchasing-dashboard/types'

export async function GET() {
  try {
    // Get projects in pipeline (QUOTE_ACCEPTED or ACTIVE) that DON'T have confirmed SOs
    // A confirmed SO means the demand is already tracked as qtyReserved
    const pipelineProjects = await prisma.project.findMany({
      where: {
        status: {
          in: ['QUOTE_ACCEPTED', 'ACTIVE']
        },
        // Exclude projects that have confirmed Sales Orders
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

    // Get all master parts for lookups
    const masterParts = await prisma.masterPart.findMany({
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        partType: true
      }
    })
    const masterPartLookup = new Map(masterParts.map(p => [p.partNumber, p]))

    // Aggregate projected demand per part
    const demandByPart: Map<string, {
      partId: number
      partNumber: string
      description: string | null
      projectedQty: number
      projects: Array<{
        id: number
        name: string
        status: string
        quantity: number
        shipDate: string | null
      }>
    }> = new Map()

    for (const project of pipelineProjects) {
      const projectPartQuantities: Map<string, number> = new Map()

      // Process each opening's panels
      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Process product BOMs
          for (const bom of product.productBOMs) {
            if (!bom.partNumber) continue

            // Skip option-specific BOMs for simplicity
            if (bom.optionId) continue

            const currentQty = projectPartQuantities.get(bom.partNumber) || 0
            projectPartQuantities.set(bom.partNumber, currentQty + (bom.quantity || 1))
          }
        }
      }

      // Add project quantities to demand aggregation
      for (const [partNumber, quantity] of projectPartQuantities) {
        const masterPart = masterPartLookup.get(partNumber)
        const existing = demandByPart.get(partNumber)

        if (existing) {
          existing.projectedQty += quantity
          existing.projects.push({
            id: project.id,
            name: project.name,
            status: project.status,
            quantity: quantity,
            shipDate: project.shipDate?.toISOString() || null
          })
        } else {
          demandByPart.set(partNumber, {
            partId: masterPart?.id || 0,
            partNumber: partNumber,
            description: masterPart?.description || masterPart?.baseName || null,
            projectedQty: quantity,
            projects: [{
              id: project.id,
              name: project.name,
              status: project.status,
              quantity: quantity,
              shipDate: project.shipDate?.toISOString() || null
            }]
          })
        }
      }
    }

    const items: ProjectedDemandItem[] = Array.from(demandByPart.values())
      .sort((a, b) => b.projectedQty - a.projectedQty)

    const response: ProjectedDemandResponse = {
      items,
      totalParts: items.length
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching projected demand:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projected demand' },
      { status: 500 }
    )
  }
}

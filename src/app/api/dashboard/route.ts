import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import { calculateTotalMarkedUpPrice, estimateCostBreakdown, type PricingMode } from '@/lib/pricing'

// Lead phase statuses (pre-acceptance)
const LEAD_STATUSES = [
  ProjectStatus.STAGING,
  ProjectStatus.APPROVED,
  ProjectStatus.REVISE,
  ProjectStatus.QUOTE_SENT
]

// Project phase statuses (post-acceptance / "Won")
const PROJECT_STATUSES = [
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE
]

// Helper function to calculate sale price with category-specific markup/discount
async function calculateProjectSalePrice(projectId: number, costPrice: number, pricingMode: PricingMode | null): Promise<number> {
  if (!pricingMode || costPrice === 0) return costPrice

  // Fetch project with BOM data to estimate cost breakdown by part type
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      openings: {
        orderBy: { id: 'asc' },
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

  if (!project) return costPrice

  // Count BOMs by type across all openings
  const bomCounts = { Extrusion: 0, Hardware: 0, Glass: 0, Other: 0 }

  for (const opening of project.openings) {
    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      for (const bom of panel.componentInstance.product.productBOMs || []) {
        if (bom.partType === 'Extrusion') {
          bomCounts.Extrusion++
        } else if (bom.partType === 'Hardware') {
          bomCounts.Hardware++
        } else if (bom.partType === 'Glass') {
          bomCounts.Glass++
        } else {
          bomCounts.Other++
        }
      }
    }
  }

  // Estimate cost breakdown and apply category-specific markups
  const costBreakdown = estimateCostBreakdown(costPrice, bomCounts)
  return calculateTotalMarkedUpPrice(costBreakdown, pricingMode)
}

export async function GET() {
  try {
    // Get total projects (only "Won" projects - QUOTE_ACCEPTED, ACTIVE, COMPLETE)
    const totalProjects = await prisma.project.count({
      where: {
        status: { in: PROJECT_STATUSES }
      }
    })

    // Get total leads (STAGING, APPROVED, REVISE, QUOTE_SENT)
    const totalLeads = await prisma.project.count({
      where: {
        status: { in: LEAD_STATUSES }
      }
    })

    // Get total openings
    const totalOpenings = await prisma.opening.count()

    // Get all projects with pricing modes to calculate total portfolio value (only won projects)
    const allProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES }
      },
      include: {
        openings: true,
        pricingMode: true
      }
    })

    // Get all leads to calculate lead pipeline value
    const allLeadProjects = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES }
      },
      include: {
        openings: true,
        pricingMode: true
      }
    })

    // Calculate total portfolio value (won projects only)
    let totalValue = 0
    for (const project of allProjects) {
      const costValue = project.openings.reduce((openingSum, opening) => openingSum + opening.price, 0)
      const saleValue = await calculateProjectSalePrice(project.id, costValue, project.pricingMode)
      totalValue += saleValue
    }

    // Calculate total lead pipeline value
    let leadPipelineValue = 0
    for (const lead of allLeadProjects) {
      const costValue = lead.openings.reduce((openingSum, opening) => openingSum + opening.price, 0)
      const saleValue = await calculateProjectSalePrice(lead.id, costValue, lead.pricingMode)
      leadPipelineValue += saleValue
    }

    // Get recent projects (won projects only)
    const recentProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES }
      },
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        openings: true,
        pricingMode: true,
        _count: {
          select: {
            openings: true
          }
        }
      }
    })

    // Get recent leads
    const recentLeads = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES }
      },
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        openings: true,
        pricingMode: true,
        _count: {
          select: {
            openings: true
          }
        }
      }
    })

    // Calculate project values with pricing modes
    const projectsWithValues = await Promise.all(
      recentProjects.map(async (project) => {
        const costValue = project.openings.reduce((sum, opening) => sum + opening.price, 0)
        const saleValue = await calculateProjectSalePrice(project.id, costValue, project.pricingMode)

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          openingsCount: project._count.openings,
          value: saleValue,
          updatedAt: project.updatedAt.toISOString()
        }
      })
    )

    // Calculate lead values with pricing modes
    const leadsWithValues = await Promise.all(
      recentLeads.map(async (lead) => {
        const costValue = lead.openings.reduce((sum, opening) => sum + opening.price, 0)
        const saleValue = await calculateProjectSalePrice(lead.id, costValue, lead.pricingMode)

        return {
          id: lead.id,
          name: lead.name,
          status: lead.status,
          openingsCount: lead._count.openings,
          value: saleValue,
          updatedAt: lead.updatedAt.toISOString()
        }
      })
    )

    return NextResponse.json({
      stats: {
        totalProjects,
        totalLeads,
        totalValue,
        leadPipelineValue,
        totalOpenings
      },
      recentProjects: projectsWithValues,
      recentLeads: leadsWithValues
    })
  } catch (error: unknown) {
    console.error('Dashboard API Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: errorMessage },
      { status: 500 }
    )
  }
}
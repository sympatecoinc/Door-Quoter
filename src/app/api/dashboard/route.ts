import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import { getDefaultPricingMode } from '@/lib/pricing-mode'

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

// Helper function to calculate quote total using project's pricing fields and cost breakdowns
interface OpeningCosts {
  extrusionCost: number
  hardwareCost: number
  glassCost: number
  packagingCost: number
  otherCost: number
  standardOptionCost: number
  hybridRemainingCost: number
}

interface PricingMode {
  markup: number
  extrusionMarkup: number
  hardwareMarkup: number
  glassMarkup: number
  packagingMarkup: number
  discount: number
}

interface ProjectForQuoteCalc {
  taxRate: number
  manualInstallationCost: number
  pricingMode: PricingMode | null
  openings: OpeningCosts[]
}

function applyMarkup(baseCost: number, categoryMarkup: number, globalMarkup: number, discount: number): number {
  // Use category-specific markup if set, otherwise fall back to global
  const markupPercent = categoryMarkup > 0 ? categoryMarkup : globalMarkup
  let price = baseCost * (1 + markupPercent / 100)

  // Apply discount if set
  if (discount > 0) {
    price *= (1 - discount / 100)
  }

  return price
}

function calculateQuoteTotal(project: ProjectForQuoteCalc, defaultPricingMode?: PricingMode | null): number {
  const pm = project.pricingMode || defaultPricingMode
  const globalMarkup = pm?.markup || 0
  const discount = pm?.discount || 0

  let adjustedSubtotal = 0

  for (const opening of project.openings) {
    // Apply category-specific markups to each cost component
    const markedUpExtrusion = applyMarkup(opening.extrusionCost, pm?.extrusionMarkup || 0, globalMarkup, discount)
    const markedUpHardware = applyMarkup(opening.hardwareCost, pm?.hardwareMarkup || 0, globalMarkup, discount)
    const markedUpGlass = applyMarkup(opening.glassCost, pm?.glassMarkup || 0, globalMarkup, discount)
    const markedUpPackaging = applyMarkup(opening.packagingCost, pm?.packagingMarkup || 0, globalMarkup, discount)
    const markedUpOther = applyMarkup(opening.otherCost, globalMarkup, globalMarkup, discount)

    // Standard options and hybrid remaining are not marked up
    const standardOptions = opening.standardOptionCost
    const hybridRemaining = opening.hybridRemainingCost

    adjustedSubtotal += markedUpExtrusion + markedUpHardware + markedUpGlass + markedUpPackaging + markedUpOther + standardOptions + hybridRemaining
  }

  // Add installation cost
  const subtotalWithInstallation = adjustedSubtotal + project.manualInstallationCost

  // Apply tax
  const taxAmount = subtotalWithInstallation * project.taxRate
  const total = subtotalWithInstallation + taxAmount

  return Math.round(total * 100) / 100
}

export async function GET() {
  try {
    // Get the default pricing mode to use for projects without one
    const defaultPricingMode = await getDefaultPricingMode(prisma)

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

    // Get all projects to calculate total portfolio value (only won projects)
    const allProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES }
      },
      select: {
        taxRate: true,
        manualInstallationCost: true,
        pricingMode: {
          select: {
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            packagingMarkup: true,
            discount: true
          }
        },
        openings: {
          select: {
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            packagingCost: true,
            otherCost: true,
            standardOptionCost: true,
            hybridRemainingCost: true
          }
        }
      }
    })

    // Get all leads to calculate lead pipeline value
    const allLeadProjects = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES }
      },
      select: {
        taxRate: true,
        manualInstallationCost: true,
        pricingMode: {
          select: {
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            packagingMarkup: true,
            discount: true
          }
        },
        openings: {
          select: {
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            packagingCost: true,
            otherCost: true,
            standardOptionCost: true,
            hybridRemainingCost: true
          }
        }
      }
    })

    // Calculate total portfolio value (won projects only)
    const totalValue = allProjects.reduce((sum, project) => sum + calculateQuoteTotal(project, defaultPricingMode), 0)

    // Calculate total lead pipeline value
    const leadPipelineValue = allLeadProjects.reduce((sum, lead) => sum + calculateQuoteTotal(lead, defaultPricingMode), 0)

    // Get recent projects (won projects only)
    const recentProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES }
      },
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        taxRate: true,
        manualInstallationCost: true,
        pricingMode: {
          select: {
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            packagingMarkup: true,
            discount: true
          }
        },
        openings: {
          select: {
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            packagingCost: true,
            otherCost: true,
            standardOptionCost: true,
            hybridRemainingCost: true
          }
        },
        _count: {
          select: {
            openings: true
          }
        }
      }
    })

    // Get all leads
    const recentLeads = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        taxRate: true,
        manualInstallationCost: true,
        pricingMode: {
          select: {
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            packagingMarkup: true,
            discount: true
          }
        },
        openings: {
          select: {
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            packagingCost: true,
            otherCost: true,
            standardOptionCost: true,
            hybridRemainingCost: true
          }
        },
        customer: {
          select: {
            id: true,
            companyName: true,
            status: true
          }
        },
        _count: {
          select: {
            openings: true
          }
        }
      }
    })

    // Calculate project values
    const projectsWithValues = recentProjects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      openingsCount: project._count.openings,
      value: calculateQuoteTotal(project, defaultPricingMode),
      updatedAt: project.updatedAt.toISOString()
    }))

    // Calculate lead values
    const leadsWithValues = recentLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      status: lead.status,
      openingsCount: lead._count.openings,
      value: calculateQuoteTotal(lead, defaultPricingMode),
      updatedAt: lead.updatedAt.toISOString(),
      customer: lead.customer ? {
        id: lead.customer.id,
        companyName: lead.customer.companyName,
        isProspect: lead.customer.status === 'Prospect'
      } : null
    }))

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
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: errorMessage },
      { status: 500 }
    )
  }
}
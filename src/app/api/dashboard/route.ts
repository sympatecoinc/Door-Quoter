import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

// Lead phase statuses (pre-acceptance) - excludes ARCHIVE and BID_LOST by default
const LEAD_STATUSES = [
  ProjectStatus.NEW_LEAD,
  ProjectStatus.STAGING,
  ProjectStatus.QUOTE_SENT
]

// Project phase statuses (post-acceptance / "Won")
const PROJECT_STATUSES = [
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.COMPLETE
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectsLimit = parseInt(searchParams.get('projectsLimit') || '5')
  const projectsOffset = parseInt(searchParams.get('projectsOffset') || '0')
  try {
    // Get total projects (only "Won" projects - QUOTE_ACCEPTED, ACTIVE, COMPLETE)
    // Only count current versions (not historical revisions)
    const totalProjects = await prisma.project.count({
      where: {
        status: { in: PROJECT_STATUSES },
        isCurrentVersion: true
      }
    })

    // Get total leads (NEW_LEAD, STAGING, QUOTE_SENT)
    // Only count current versions (not historical revisions)
    const totalLeads = await prisma.project.count({
      where: {
        status: { in: LEAD_STATUSES },
        isCurrentVersion: true
      }
    })

    // Get total openings (only from won projects, current versions)
    const totalOpenings = await prisma.opening.count({
      where: {
        project: {
          status: { in: PROJECT_STATUSES },
          isCurrentVersion: true
        }
      }
    })

    // Get all projects to calculate total portfolio value (only won projects)
    // Only include current versions (not historical revisions)
    const allProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES },
        isCurrentVersion: true
      },
      select: {
        quoteVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { totalPrice: true }
        }
      }
    })

    // Get all leads to calculate lead pipeline value
    // Only include current versions (not historical revisions)
    const allLeadProjects = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES },
        isCurrentVersion: true
      },
      select: {
        quoteVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { totalPrice: true }
        }
      }
    })

    // Calculate total portfolio value (won projects only) - uses stored quote prices
    const totalValue = allProjects.reduce((sum, project) => sum + (project.quoteVersions[0]?.totalPrice ?? 0), 0)

    // Calculate total lead pipeline value - uses stored quote prices
    const leadPipelineValue = allLeadProjects.reduce((sum, lead) => sum + (lead.quoteVersions[0]?.totalPrice ?? 0), 0)

    // Get recent projects (won projects only)
    // Only include current versions (not historical revisions)
    const recentProjects = await prisma.project.findMany({
      where: {
        status: { in: PROJECT_STATUSES },
        isCurrentVersion: true
      },
      skip: projectsOffset,
      take: projectsLimit,
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        version: true,
        openings: {
          select: {
            openingType: true
          }
        },
        quoteVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            totalPrice: true
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
    // Only include current versions (not historical revisions)
    const recentLeads = await prisma.project.findMany({
      where: {
        status: { in: LEAD_STATUSES },
        isCurrentVersion: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        version: true,
        // Prospect fields for leads without customer
        prospectCompanyName: true,
        prospectPhone: true,
        openings: {
          select: {
            openingType: true
          }
        },
        quoteVersions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            totalPrice: true
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
    const projectsWithValues = recentProjects.map((project) => {
      const hasThinWall = project.openings.some(o => o.openingType === 'THINWALL')
      const hasTrimmed = project.openings.some(o => o.openingType === 'FRAMED')
      const latestQuote = project.quoteVersions[0] || null
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        version: project.version,
        openingsCount: project._count.openings,
        value: latestQuote?.totalPrice ?? 0,
        updatedAt: project.updatedAt.toISOString(),
        hasThinWall,
        hasTrimmed,
        latestQuote: latestQuote ? {
          version: latestQuote.version,
          totalPrice: latestQuote.totalPrice
        } : null
      }
    })

    // Calculate lead values
    const leadsWithValues = recentLeads.map((lead) => {
      const hasThinWall = lead.openings.some(o => o.openingType === 'THINWALL')
      const hasTrimmed = lead.openings.some(o => o.openingType === 'FRAMED')
      const latestQuote = lead.quoteVersions[0] || null
      return {
        id: lead.id,
        name: lead.name,
        status: lead.status,
        version: lead.version,
        openingsCount: lead._count.openings,
        value: latestQuote?.totalPrice ?? 0,
        updatedAt: lead.updatedAt.toISOString(),
        // Include customer if linked, otherwise include lead info
        customer: lead.customer ? {
          id: lead.customer.id,
          companyName: lead.customer.companyName,
          isLead: lead.customer.status === 'Lead'
        } : null,
        // Lead info for leads without customer
        prospectCompanyName: lead.prospectCompanyName,
        hasThinWall,
        hasTrimmed,
        latestQuote: latestQuote ? {
          version: latestQuote.version,
          totalPrice: latestQuote.totalPrice
        } : null
      }
    })

    return NextResponse.json({
      stats: {
        totalProjects,
        totalLeads,
        totalValue,
        leadPipelineValue,
        totalOpenings
      },
      recentProjects: projectsWithValues,
      recentLeads: leadsWithValues,
      hasMoreProjects: (projectsOffset + projectsLimit) < totalProjects
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
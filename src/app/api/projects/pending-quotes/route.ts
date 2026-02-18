import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List projects with QUOTE_ACCEPTED status that don't have sales orders
// Excludes projects where a sibling/parent version already has an active SO
export async function GET() {
  try {
    const pendingQuotes = await prisma.project.findMany({
      where: {
        status: 'QUOTE_ACCEPTED',
        isCurrentVersion: true,
        salesOrders: {
          none: {}
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            quickbooksId: true
          }
        },
        openings: {
          select: {
            id: true,
            name: true
          }
        },
        quoteVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalPrice: true }
        },
        _count: {
          select: {
            openings: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // Filter out projects where a family member already has an active SO
    // (these should go through the Change Order / New SO choice flow instead)
    const filteredQuotes = []
    for (const project of pendingQuotes) {
      const rootProjectId = project.parentProjectId || project.id

      const familySO = await prisma.salesOrder.findFirst({
        where: {
          project: {
            OR: [
              { id: rootProjectId },
              { parentProjectId: rootProjectId }
            ],
            id: { not: project.id }
          },
          status: { notIn: ['VOIDED', 'CANCELLED'] }
        },
        select: { id: true }
      })

      if (!familySO) {
        filteredQuotes.push(project)
      }
    }

    // Calculate total value for each project from the quote
    const projectsWithTotals = filteredQuotes.map(project => {
      // Use the quote total - if QUOTE_ACCEPTED, a quote must exist
      const latestQuote = project.quoteVersions?.[0]
      const totalValue = latestQuote?.totalPrice ? Number(latestQuote.totalPrice) : 0
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        customerId: project.customerId,
        customer: project.customer,
        totalValue,
        openingCount: project._count.openings,
        updatedAt: project.updatedAt
      }
    })

    return NextResponse.json({
      pendingQuotes: projectsWithTotals,
      count: projectsWithTotals.length
    })
  } catch (error) {
    console.error('Error fetching pending quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pending quotes' },
      { status: 500 }
    )
  }
}

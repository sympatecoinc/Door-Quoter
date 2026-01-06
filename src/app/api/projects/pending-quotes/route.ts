import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List projects with QUOTE_ACCEPTED status that don't have sales orders
export async function GET() {
  try {
    const pendingQuotes = await prisma.project.findMany({
      where: {
        status: 'QUOTE_ACCEPTED',
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
            name: true,
            price: true
          }
        },
        _count: {
          select: {
            openings: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // Calculate total value for each project
    const projectsWithTotals = pendingQuotes.map(project => {
      const totalValue = project.openings.reduce((sum, opening) => sum + (opening.price || 0), 0)
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

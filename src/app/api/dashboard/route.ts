import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get total projects
    const totalProjects = await prisma.project.count()

    // Get total portfolio value (sum of all opening prices)
    const totalValueResult = await prisma.opening.aggregate({
      _sum: {
        price: true
      }
    })
    const totalValue = totalValueResult._sum.price || 0

    // Get total openings
    const totalOpenings = await prisma.opening.count()

    // Get recent projects with their openings
    const recentProjects = await prisma.project.findMany({
      take: 5,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        openings: true,
        _count: {
          select: {
            openings: true
          }
        }
      }
    })

    // Calculate project values
    const projectsWithValues = recentProjects.map(project => {
      const projectValue = project.openings.reduce((sum, opening) => sum + opening.price, 0)
      return {
        id: project.id,
        name: project.name,
        status: project.status,
        openingsCount: project._count.openings,
        value: projectValue,
        updatedAt: project.updatedAt.toISOString()
      }
    })

    return NextResponse.json({
      stats: {
        totalProjects,
        totalValue,
        totalOpenings
      },
      recentProjects: projectsWithValues
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
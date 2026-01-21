import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const projects = await prisma.project.findMany({
      where: { customerId: customerId },
      include: {
        openings: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            roughWidth: true,
            roughHeight: true,
            _count: {
              select: { panels: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform to include panel count at opening level
    const projectsWithPanelCount = projects.map(project => ({
      ...project,
      openings: project.openings.map(opening => ({
        id: opening.id,
        name: opening.name,
        price: opening.price,
        roughWidth: opening.roughWidth,
        roughHeight: opening.roughHeight,
        panelCount: opening._count.panels
      })),
      totalPanelCount: project.openings.reduce((sum, o) => sum + o._count.panels, 0)
    }))

    return NextResponse.json(projectsWithPanelCount)
  } catch (error) {
    console.error('Error fetching customer projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer projects' },
      { status: 500 }
    )
  }
}
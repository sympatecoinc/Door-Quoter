import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get all work orders for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        shipDate: true,
        customer: {
          select: {
            id: true,
            companyName: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all work orders for the project
    const workOrders = await prisma.workOrder.findMany({
      where: { projectId },
      include: {
        items: true,
        stageHistory: {
          orderBy: { enteredAt: 'desc' },
          include: {
            enteredBy: {
              select: { id: true, name: true }
            },
            exitedBy: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [
        { batchNumber: 'asc' }
      ]
    })

    // Calculate stage distribution
    const stageDistribution: Record<string, number> = {
      STAGED: 0,
      CUTTING: 0,
      ASSEMBLY: 0,
      QC: 0,
      SHIP: 0,
      COMPLETE: 0
    }

    for (const wo of workOrders) {
      stageDistribution[wo.currentStage]++
    }

    // Calculate progress percentage
    const totalWorkOrders = workOrders.length
    const completedWorkOrders = stageDistribution.COMPLETE
    const progressPercent = totalWorkOrders > 0
      ? Math.round((completedWorkOrders / totalWorkOrders) * 100)
      : 0

    return NextResponse.json({
      project,
      workOrders,
      summary: {
        total: totalWorkOrders,
        completed: completedWorkOrders,
        progressPercent,
        stageDistribution
      }
    })
  } catch (error) {
    console.error('Error fetching project work orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project work orders' },
      { status: 500 }
    )
  }
}

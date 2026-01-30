import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get aggregated progress for a project
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
        shipDate: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get work order counts by stage
    const workOrders = await prisma.workOrder.findMany({
      where: { projectId },
      select: {
        id: true,
        currentStage: true,
        batchNumber: true,
        items: {
          select: { quantity: true }
        }
      }
    })

    // Calculate stage distribution
    const stageDistribution: Record<string, { count: number; itemCount: number }> = {
      STAGED: { count: 0, itemCount: 0 },
      CUTTING: { count: 0, itemCount: 0 },
      ASSEMBLY: { count: 0, itemCount: 0 },
      QC: { count: 0, itemCount: 0 },
      SHIP: { count: 0, itemCount: 0 },
      COMPLETE: { count: 0, itemCount: 0 }
    }

    for (const wo of workOrders) {
      const stage = wo.currentStage
      stageDistribution[stage].count++
      stageDistribution[stage].itemCount += wo.items.reduce((sum, item) => sum + item.quantity, 0)
    }

    // Calculate overall progress
    const totalWorkOrders = workOrders.length
    const completedWorkOrders = stageDistribution.COMPLETE.count
    const progressPercent = totalWorkOrders > 0
      ? Math.round((completedWorkOrders / totalWorkOrders) * 100)
      : 0

    // Calculate weighted progress (gives partial credit for items in progress)
    const stageWeights: Record<string, number> = {
      STAGED: 0,
      CUTTING: 0.2,
      ASSEMBLY: 0.4,
      QC: 0.6,
      SHIP: 0.8,
      COMPLETE: 1.0
    }

    let weightedProgress = 0
    for (const [stage, data] of Object.entries(stageDistribution)) {
      weightedProgress += data.count * stageWeights[stage]
    }
    const weightedProgressPercent = totalWorkOrders > 0
      ? Math.round((weightedProgress / totalWorkOrders) * 100)
      : 0

    // Get total time spent in production (excluding STAGED and COMPLETE)
    const stageHistory = await prisma.workOrderStageHistory.findMany({
      where: {
        workOrder: { projectId },
        stage: { notIn: ['STAGED', 'COMPLETE'] },
        durationMins: { not: null }
      },
      select: {
        stage: true,
        durationMins: true
      }
    })

    const timeByStage: Record<string, number> = {
      CUTTING: 0,
      ASSEMBLY: 0,
      QC: 0,
      SHIP: 0
    }

    let totalProductionMins = 0
    for (const history of stageHistory) {
      if (history.durationMins) {
        timeByStage[history.stage] = (timeByStage[history.stage] || 0) + history.durationMins
        totalProductionMins += history.durationMins
      }
    }

    return NextResponse.json({
      project,
      progress: {
        totalWorkOrders,
        completedWorkOrders,
        progressPercent,
        weightedProgressPercent,
        stageDistribution
      },
      timing: {
        totalProductionMins,
        timeByStage
      }
    })
  } catch (error) {
    console.error('Error fetching project progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project progress' },
      { status: 500 }
    )
  }
}

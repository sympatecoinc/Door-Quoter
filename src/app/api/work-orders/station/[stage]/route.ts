import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WorkOrderStage } from '@prisma/client'

// Valid stages
const VALID_STAGES: WorkOrderStage[] = [
  'STAGED',
  'CUTTING',
  'MILLING',
  'ASSEMBLY',
  'QC',
  'SHIP',
  'COMPLETE'
]

// GET - Get all work orders at a specific stage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stage: string }> }
) {
  try {
    const { stage } = await params
    const stageUpper = stage.toUpperCase() as WorkOrderStage

    if (!VALID_STAGES.includes(stageUpper)) {
      return NextResponse.json(
        { error: 'Invalid stage' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sortBy = searchParams.get('sortBy') || 'priority'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Get work orders at this stage
    const workOrders = await prisma.workOrder.findMany({
      where: { currentStage: stageUpper },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            shipDate: true,
            shippingAddress: true,
            shippingCity: true,
            shippingState: true,
            shippingZipCode: true,
            productionColor: true,
            customer: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                phone: true
              }
            },
            openings: {
              select: {
                finishColor: true
              },
              take: 1
            }
          }
        },
        items: true,
        stageHistory: {
          where: { stage: stageUpper, exitedAt: null },
          orderBy: { enteredAt: 'desc' },
          take: 1,
          include: {
            enteredBy: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    })

    // Calculate time in current stage for each work order
    const now = new Date()
    const workOrdersWithTime = workOrders.map(wo => {
      const currentStageHistory = wo.stageHistory[0]
      let timeInStageMins = 0
      if (currentStageHistory) {
        const enteredAt = new Date(currentStageHistory.enteredAt)
        timeInStageMins = Math.round((now.getTime() - enteredAt.getTime()) / 60000)
      }
      return {
        ...wo,
        timeInStageMins
      }
    })

    // Get counts for all stages (for station overview)
    const stageCounts = await prisma.workOrder.groupBy({
      by: ['currentStage'],
      _count: true
    })

    const countsMap: Record<string, number> = {}
    for (const sc of stageCounts) {
      countsMap[sc.currentStage] = sc._count
    }

    return NextResponse.json({
      stage: stageUpper,
      workOrders: workOrdersWithTime,
      count: workOrders.length,
      allStageCounts: countsMap
    })
  } catch (error) {
    console.error('Error fetching station work orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch station work orders' },
      { status: 500 }
    )
  }
}

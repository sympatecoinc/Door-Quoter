import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'

// POST /api/work-orders/[id]/start - Start work on a work order (sets startedAt on current stage history)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from session (optional - work can start without auth)
    let userId: number | null = null
    const sessionToken = await getSessionToken()
    if (sessionToken) {
      const user = await validateSession(sessionToken)
      userId = user?.id || null
    }

    const { id: workOrderId } = await context.params

    // Find the work order and its current stage history
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        stageHistory: {
          where: {
            exitedAt: null // Current stage (not yet exited)
          },
          orderBy: { enteredAt: 'desc' },
          take: 1
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    const currentStageHistory = workOrder.stageHistory[0]

    if (!currentStageHistory) {
      return NextResponse.json(
        { error: 'No active stage history found' },
        { status: 400 }
      )
    }

    // Check if already started
    if (currentStageHistory.startedAt) {
      return NextResponse.json({
        message: 'Work already started',
        startedAt: currentStageHistory.startedAt,
        stageHistoryId: currentStageHistory.id
      })
    }

    // Update the stage history with startedAt
    const updatedStageHistory = await prisma.workOrderStageHistory.update({
      where: { id: currentStageHistory.id },
      data: {
        startedAt: new Date(),
        startedById: userId
      },
      include: {
        startedBy: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json({
      message: 'Work started',
      startedAt: updatedStageHistory.startedAt,
      stageHistoryId: updatedStageHistory.id,
      startedBy: updatedStageHistory.startedBy
    })
  } catch (error) {
    console.error('Error starting work order:', error)
    return NextResponse.json(
      { error: 'Failed to start work order' },
      { status: 500 }
    )
  }
}

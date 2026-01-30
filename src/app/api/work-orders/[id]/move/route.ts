import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { WorkOrderStage } from '@prisma/client'

// Valid stages
const VALID_STAGES: WorkOrderStage[] = [
  'STAGED',
  'CUTTING',
  'ASSEMBLY',
  'QC',
  'SHIP',
  'COMPLETE'
]

// POST - Move work order to specific stage (skip or rework)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { targetStage, reason } = body

    if (!targetStage || !VALID_STAGES.includes(targetStage)) {
      return NextResponse.json(
        { error: 'Invalid target stage' },
        { status: 400 }
      )
    }

    // Get session for tracking
    const sessionToken = await getSessionToken()
    let userId: number | null = null
    if (sessionToken) {
      const session = await getSessionWithUser(sessionToken)
      if (session?.user) {
        userId = session.user.id
      }
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        stageHistory: {
          where: { exitedAt: null },
          orderBy: { enteredAt: 'desc' },
          take: 1
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    if (workOrder.currentStage === targetStage) {
      return NextResponse.json(
        { error: 'Work order is already at this stage' },
        { status: 400 }
      )
    }

    const now = new Date()
    const currentHistory = workOrder.stageHistory[0]

    // Calculate duration if there's an active stage history
    let durationMins: number | null = null
    if (currentHistory) {
      const enteredAt = new Date(currentHistory.enteredAt)
      durationMins = Math.round((now.getTime() - enteredAt.getTime()) / 60000)
    }

    // Determine if this is skip (forward) or rework (backward)
    const currentIndex = VALID_STAGES.indexOf(workOrder.currentStage)
    const targetIndex = VALID_STAGES.indexOf(targetStage)
    const isRework = targetIndex < currentIndex

    // Use transaction to update stage atomically
    const updated = await prisma.$transaction(async (tx) => {
      // Close current stage history
      if (currentHistory) {
        await tx.workOrderStageHistory.update({
          where: { id: currentHistory.id },
          data: {
            exitedAt: now,
            exitedById: userId,
            durationMins
          }
        })
      }

      // Create new stage history with reason note
      await tx.workOrderStageHistory.create({
        data: {
          workOrderId: id,
          stage: targetStage,
          enteredById: userId
        }
      })

      // Update work order current stage and notes if reason provided
      const updateData: any = { currentStage: targetStage }
      if (reason) {
        const timestamp = now.toISOString()
        const actionType = isRework ? 'REWORK' : 'SKIP'
        const notePrefix = `[${timestamp}] ${actionType}: ${workOrder.currentStage} → ${targetStage}`
        const existingNotes = workOrder.notes || ''
        updateData.notes = existingNotes
          ? `${existingNotes}\n${notePrefix}: ${reason}`
          : `${notePrefix}: ${reason}`
      }

      return tx.workOrder.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              customer: {
                select: {
                  id: true,
                  companyName: true
                }
              }
            }
          },
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
        }
      })
    })

    return NextResponse.json({
      workOrder: updated,
      previousStage: workOrder.currentStage,
      newStage: targetStage,
      moveType: isRework ? 'rework' : 'skip',
      durationMins
    })
  } catch (error) {
    console.error('Error moving work order:', error)
    return NextResponse.json(
      { error: 'Failed to move work order' },
      { status: 500 }
    )
  }
}

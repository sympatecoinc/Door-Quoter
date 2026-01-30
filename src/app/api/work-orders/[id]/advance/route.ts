import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { WorkOrderStage } from '@prisma/client'

// Stage progression order
const STAGE_ORDER: WorkOrderStage[] = [
  'STAGED',
  'CUTTING',
  'MILLING',
  'ASSEMBLY',
  'QC',
  'SHIP',
  'COMPLETE'
]

function getNextStage(currentStage: WorkOrderStage): WorkOrderStage | null {
  const currentIndex = STAGE_ORDER.indexOf(currentStage)
  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
    return null
  }
  return STAGE_ORDER[currentIndex + 1]
}

// Check if work order has any items that require milling
async function hasMilledItems(workOrderId: string): Promise<boolean> {
  const items = await prisma.workOrderItem.findMany({
    where: { workOrderId },
    select: { metadata: true }
  })
  return items.some(item => {
    const meta = item.metadata as Record<string, any> | null
    return meta?.isMilled === true
  })
}

// POST - Advance work order to next stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    let nextStage = getNextStage(workOrder.currentStage)

    if (!nextStage) {
      return NextResponse.json(
        { error: 'Work order is already complete' },
        { status: 400 }
      )
    }

    // Skip MILLING stage if work order has no milled items
    // If going to MILLING, reset completion status for milled items
    if (nextStage === 'MILLING') {
      const hasMilled = await hasMilledItems(id)
      if (!hasMilled) {
        // Skip MILLING, go directly to ASSEMBLY
        nextStage = 'ASSEMBLY'
      } else {
        // Reset completion status for milled items so they can be tracked at milling station
        await prisma.workOrderItem.updateMany({
          where: {
            workOrderId: id,
            metadata: {
              path: ['isMilled'],
              equals: true
            }
          },
          data: {
            isCompleted: false,
            completedAt: null,
            completedById: null,
            startedAt: null,
            elapsedSeconds: 0,
            startedById: null
          }
        })
      }
    }

    // Check station assignment permission
    if (userId) {
      const assignment = await prisma.userStationAssignment.findFirst({
        where: {
          userId,
          station: workOrder.currentStage
        }
      })

      // Only check permissions if station assignments exist in the system
      const anyAssignments = await prisma.userStationAssignment.count()
      if (anyAssignments > 0 && !assignment) {
        return NextResponse.json(
          { error: `You are not assigned to the ${workOrder.currentStage} station` },
          { status: 403 }
        )
      }
    }

    const now = new Date()
    const currentHistory = workOrder.stageHistory[0]

    // Calculate duration if there's an active stage history
    let durationMins: number | null = null
    if (currentHistory) {
      const enteredAt = new Date(currentHistory.enteredAt)
      durationMins = Math.round((now.getTime() - enteredAt.getTime()) / 60000)
    }

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

      // Create new stage history
      await tx.workOrderStageHistory.create({
        data: {
          workOrderId: id,
          stage: nextStage,
          enteredById: userId
        }
      })

      // Update work order current stage
      return tx.workOrder.update({
        where: { id },
        data: { currentStage: nextStage },
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
      newStage: nextStage,
      durationMins
    })
  } catch (error) {
    console.error('Error advancing work order:', error)
    return NextResponse.json(
      { error: 'Failed to advance work order' },
      { status: 500 }
    )
  }
}

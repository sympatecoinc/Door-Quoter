import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'

// POST /api/work-orders/[id]/items/bulk-complete - Mark multiple items as complete
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Get user from session (optional)
    let userId: number | null = null
    const sessionToken = await getSessionToken()
    if (sessionToken) {
      const user = await validateSession(sessionToken)
      userId = user?.id || null
    }

    const { id: workOrderId } = await context.params
    const body = await request.json()

    const { itemIds, isCompleted = true, action = 'complete' } = body

    // Verify work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId }
    })

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    let result

    if (action === 'complete' || action === 'uncomplete') {
      // Mark items as complete/incomplete
      const shouldComplete = action === 'complete' || isCompleted

      if (itemIds && itemIds.length > 0) {
        // Update specific items
        result = await prisma.workOrderItem.updateMany({
          where: {
            id: { in: itemIds },
            workOrderId: workOrderId
          },
          data: {
            isCompleted: shouldComplete,
            completedAt: shouldComplete ? new Date() : null,
            completedById: shouldComplete ? userId : null
          }
        })
      } else {
        // Update all items in the work order
        result = await prisma.workOrderItem.updateMany({
          where: {
            workOrderId: workOrderId
          },
          data: {
            isCompleted: shouldComplete,
            completedAt: shouldComplete ? new Date() : null,
            completedById: shouldComplete ? userId : null
          }
        })
      }
    } else if (action === 'receive' || action === 'unreceive') {
      // Mark items as received/unreceived
      const shouldReceive = action === 'receive'

      if (itemIds && itemIds.length > 0) {
        result = await prisma.workOrderItem.updateMany({
          where: {
            id: { in: itemIds },
            workOrderId: workOrderId
          },
          data: {
            isReceived: shouldReceive,
            receivedAt: shouldReceive ? new Date() : null,
            receivedById: shouldReceive ? userId : null
          }
        })
      } else {
        result = await prisma.workOrderItem.updateMany({
          where: {
            workOrderId: workOrderId
          },
          data: {
            isReceived: shouldReceive,
            receivedAt: shouldReceive ? new Date() : null,
            receivedById: shouldReceive ? userId : null
          }
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "complete", "uncomplete", "receive", or "unreceive"' },
        { status: 400 }
      )
    }

    // Get updated items
    const updatedItems = await prisma.workOrderItem.findMany({
      where: { workOrderId },
      include: {
        completedBy: {
          select: { id: true, name: true }
        },
        receivedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Calculate progress
    const totalItems = updatedItems.length
    const completedItems = updatedItems.filter(i => i.isCompleted).length
    const receivedItems = updatedItems.filter(i => i.isReceived).length

    return NextResponse.json({
      message: `Updated ${result.count} items`,
      count: result.count,
      items: updatedItems,
      progress: {
        total: totalItems,
        completed: completedItems,
        received: receivedItems,
        completionPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        receivingPercent: totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0
      }
    })
  } catch (error) {
    console.error('Error bulk updating work order items:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update work order items' },
      { status: 500 }
    )
  }
}

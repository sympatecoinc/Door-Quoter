import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'

// PATCH /api/work-orders/[id]/items/[itemId] - Update item timing/completion/receipt status
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // Get user from session (optional)
    let userId: number | null = null
    const sessionToken = await getSessionToken()
    if (sessionToken) {
      const user = await validateSession(sessionToken)
      userId = user?.id || null
    }

    const { id: workOrderId, itemId } = await context.params
    const body = await request.json()

    // Verify item belongs to the work order
    const existingItem = await prisma.workOrderItem.findFirst({
      where: {
        id: itemId,
        workOrderId: workOrderId
      }
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Work order item not found' },
        { status: 404 }
      )
    }

    // Build update data based on what's provided
    const updateData: {
      isCompleted?: boolean
      completedAt?: Date | null
      completedById?: number | null
      isReceived?: boolean
      receivedAt?: Date | null
      receivedById?: number | null
      receivingNotes?: string | null
      startedAt?: Date | null
      elapsedSeconds?: number
      startedById?: number | null
    } = {}

    // Handle timing actions: "start", "stop", "complete"
    if (body.action) {
      switch (body.action) {
        case 'start':
          // Start timing - set startedAt to now
          updateData.startedAt = new Date()
          updateData.startedById = userId
          break

        case 'stop':
          // Stop timing - calculate elapsed and accumulate
          if (existingItem.startedAt) {
            const now = new Date()
            const elapsed = Math.floor((now.getTime() - existingItem.startedAt.getTime()) / 1000)
            updateData.elapsedSeconds = existingItem.elapsedSeconds + elapsed
          }
          updateData.startedAt = null
          updateData.startedById = null
          break

        case 'complete':
          // Complete the item - stop timing if running and mark complete
          if (existingItem.startedAt) {
            const now = new Date()
            const elapsed = Math.floor((now.getTime() - existingItem.startedAt.getTime()) / 1000)
            updateData.elapsedSeconds = existingItem.elapsedSeconds + elapsed
            updateData.startedAt = null
            updateData.startedById = null
          }
          updateData.isCompleted = true
          updateData.completedAt = new Date()
          updateData.completedById = userId
          break

        case 'uncomplete':
          // Uncomplete the item - go back to paused state (keeps elapsed time)
          updateData.isCompleted = false
          updateData.completedAt = null
          updateData.completedById = null
          break
      }
    }

    // Handle legacy completion status (for bulk operations and backward compatibility)
    if (body.isCompleted !== undefined && !body.action) {
      updateData.isCompleted = body.isCompleted
      if (body.isCompleted) {
        updateData.completedAt = new Date()
        updateData.completedById = userId
      } else {
        updateData.completedAt = null
        updateData.completedById = null
      }
    }

    // Handle received status
    if (body.isReceived !== undefined) {
      updateData.isReceived = body.isReceived
      if (body.isReceived) {
        updateData.receivedAt = new Date()
        updateData.receivedById = userId
      } else {
        updateData.receivedAt = null
        updateData.receivedById = null
      }
    }

    // Handle receiving notes
    if (body.receivingNotes !== undefined) {
      updateData.receivingNotes = body.receivingNotes
    }

    const updatedItem = await prisma.workOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        completedBy: {
          select: { id: true, name: true }
        },
        receivedBy: {
          select: { id: true, name: true }
        },
        startedBy: {
          select: { id: true, name: true }
        }
      }
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error updating work order item:', error)
    return NextResponse.json(
      { error: 'Failed to update work order item' },
      { status: 500 }
    )
  }
}

// GET /api/work-orders/[id]/items/[itemId] - Get single item details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: workOrderId, itemId } = await context.params

    const item = await prisma.workOrderItem.findFirst({
      where: {
        id: itemId,
        workOrderId: workOrderId
      },
      include: {
        completedBy: {
          select: { id: true, name: true }
        },
        receivedBy: {
          select: { id: true, name: true }
        },
        startedBy: {
          select: { id: true, name: true }
        }
      }
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Work order item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching work order item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch work order item' },
      { status: 500 }
    )
  }
}

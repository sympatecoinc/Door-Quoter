import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get single work order with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
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
            customer: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                zipCode: true
              }
            }
          }
        },
        items: true,
        stageHistory: {
          orderBy: { enteredAt: 'desc' },
          include: {
            enteredBy: {
              select: { id: true, name: true, email: true }
            },
            exitedBy: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    // Calculate total time in each stage
    const stageTimings: Record<string, number> = {}
    for (const history of workOrder.stageHistory) {
      if (history.durationMins) {
        stageTimings[history.stage] = (stageTimings[history.stage] || 0) + history.durationMins
      }
    }

    return NextResponse.json({
      workOrder,
      stageTimings
    })
  } catch (error) {
    console.error('Error fetching work order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch work order' },
      { status: 500 }
    )
  }
}

// PATCH - Update work order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { priority, notes } = body

    const workOrder = await prisma.workOrder.findUnique({
      where: { id }
    })

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        ...(priority !== undefined && { priority }),
        ...(notes !== undefined && { notes })
      },
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
          take: 1
        }
      }
    })

    return NextResponse.json({ workOrder: updated })
  } catch (error) {
    console.error('Error updating work order:', error)
    return NextResponse.json(
      { error: 'Failed to update work order' },
      { status: 500 }
    )
  }
}

// DELETE - Delete work order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const workOrder = await prisma.workOrder.findUnique({
      where: { id }
    })

    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    // Only allow deletion if in STAGED status
    if (workOrder.currentStage !== 'STAGED') {
      return NextResponse.json(
        { error: 'Can only delete work orders in STAGED status' },
        { status: 400 }
      )
    }

    await prisma.workOrder.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting work order:', error)
    return NextResponse.json(
      { error: 'Failed to delete work order' },
      { status: 500 }
    )
  }
}

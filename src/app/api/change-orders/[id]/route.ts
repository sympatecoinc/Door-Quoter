import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get change order detail with lines
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid change order ID' }, { status: 400 })
    }

    const changeOrder = await prisma.changeOrder.findUnique({
      where: { id },
      include: {
        salesOrder: {
          select: { id: true, orderNumber: true, status: true, totalAmount: true }
        },
        project: {
          select: { id: true, name: true, version: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        lines: {
          orderBy: { lineNum: 'asc' }
        }
      }
    })

    if (!changeOrder) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    return NextResponse.json(changeOrder)
  } catch (error) {
    console.error('Error fetching change order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch change order' },
      { status: 500 }
    )
  }
}

// PUT - Update change order status (DRAFT → APPROVED, or VOID)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid change order ID' }, { status: 400 })
    }

    const { status } = await request.json()

    if (!status || !['DRAFT', 'APPROVED', 'VOIDED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be DRAFT, APPROVED, or VOIDED' },
        { status: 400 }
      )
    }

    const existing = await prisma.changeOrder.findUnique({
      where: { id },
      select: { status: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Change order not found' }, { status: 404 })
    }

    // Validate state transitions
    if (existing.status === 'VOIDED') {
      return NextResponse.json(
        { error: 'Cannot update a voided change order' },
        { status: 400 }
      )
    }
    if (existing.status === 'APPROVED' && status !== 'VOIDED') {
      return NextResponse.json(
        { error: 'Approved change orders can only be voided' },
        { status: 400 }
      )
    }

    const changeOrder = await prisma.changeOrder.update({
      where: { id },
      data: { status },
      include: {
        salesOrder: {
          select: { id: true, orderNumber: true }
        },
        project: {
          select: { id: true, name: true, version: true }
        },
        lines: {
          orderBy: { lineNum: 'asc' }
        }
      }
    })

    return NextResponse.json(changeOrder)
  } catch (error) {
    console.error('Error updating change order:', error)
    return NextResponse.json(
      { error: 'Failed to update change order' },
      { status: 500 }
    )
  }
}

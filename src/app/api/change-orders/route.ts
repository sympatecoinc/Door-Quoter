import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createChangeOrderFromRevision } from '@/lib/change-order'

// GET - List change orders with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const salesOrderId = searchParams.get('salesOrderId')
    const status = searchParams.get('status')

    const where: any = {}
    if (salesOrderId) where.salesOrderId = parseInt(salesOrderId)
    if (status) where.status = status

    const changeOrders = await prisma.changeOrder.findMany({
      where,
      include: {
        salesOrder: {
          select: { id: true, orderNumber: true, status: true }
        },
        project: {
          select: { id: true, name: true, version: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: { select: { lines: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ changeOrders })
  } catch (error) {
    console.error('Error fetching change orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch change orders' },
      { status: 500 }
    )
  }
}

// POST - Create a change order from two project revisions
export async function POST(request: NextRequest) {
  try {
    const { salesOrderId, newProjectId, previousProjectId, reason, userId } = await request.json()

    if (!salesOrderId || !newProjectId || !previousProjectId) {
      return NextResponse.json(
        { error: 'salesOrderId, newProjectId, and previousProjectId are required' },
        { status: 400 }
      )
    }

    // Guard: block change orders for non-DRAFT SOs (confirmed SOs have inventory reserved)
    const existingSO = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      select: { status: true }
    })

    if (!existingSO) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      )
    }

    if (existingSO.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot create a change order for a confirmed Sales Order. The SO has inventory reserved — you must create a new Sales Order instead.' },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      return createChangeOrderFromRevision(tx, {
        salesOrderId,
        newProjectId,
        previousProjectId,
        userId: userId || null,
        reason: reason || null,
      })
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result.changeOrder)
  } catch (error) {
    console.error('Error creating change order:', error)
    return NextResponse.json(
      { error: 'Failed to create change order' },
      { status: 500 }
    )
  }
}

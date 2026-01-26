import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'

// GET - Fetch purchase orders awaiting receiving
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const vendorId = searchParams.get('vendorId')
    const isHistory = searchParams.get('history') === 'true'

    // Valid statuses for receiving queue
    const validStatuses: POStatus[] = ['SENT', 'ACKNOWLEDGED', 'PARTIAL']

    // Build where clause
    const where: any = {}

    if (isHistory) {
      // History tab: show only completed orders
      where.status = 'COMPLETE'
    } else {
      // Pending tab: show receivable orders
      where.status = status && validStatuses.includes(status as POStatus)
        ? status as POStatus
        : { in: validStatuses }
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId, 10)
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            displayName: true,
            companyName: true
          }
        },
        lines: {
          include: {
            quickbooksItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                description: true
              }
            }
          },
          orderBy: { lineNum: 'asc' }
        }
      },
      orderBy: isHistory
        ? [{ updatedAt: 'desc' }]  // Most recently completed first
        : [{ expectedDate: 'asc' }, { createdAt: 'desc' }],
      take: isHistory ? 50 : undefined  // Limit history to last 50
    })

    // Calculate progress for each PO
    const formattedPOs = purchaseOrders.map(po => {
      const totalQuantity = po.lines.reduce((sum, l) => sum + l.quantity, 0)
      const receivedQuantity = po.lines.reduce((sum, l) => sum + l.quantityReceived, 0)
      const remainingQuantity = totalQuantity - receivedQuantity

      return {
        ...po,
        totalItems: po.lines.length,
        totalQuantity,
        receivedQuantity,
        remainingQuantity,
        progressPercent: totalQuantity > 0 ? Math.round((receivedQuantity / totalQuantity) * 100) : 0
      }
    })

    // Calculate stats
    const stats = {
      totalPOs: purchaseOrders.length,
      sentCount: purchaseOrders.filter(p => p.status === 'SENT').length,
      acknowledgedCount: purchaseOrders.filter(p => p.status === 'ACKNOWLEDGED').length,
      partialCount: purchaseOrders.filter(p => p.status === 'PARTIAL').length,
      totalItemsPending: formattedPOs.reduce((sum, po) => sum + po.remainingQuantity, 0)
    }

    return NextResponse.json({
      purchaseOrders: formattedPOs,
      stats
    })
  } catch (error) {
    console.error('Error fetching receiving POs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch receiving data' },
      { status: 500 }
    )
  }
}

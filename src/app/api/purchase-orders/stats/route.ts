import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get counts by status
    const statusCounts = await prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalAmount: true }
    })

    // Build stats object
    const stats = {
      draft: 0,
      sent: 0,
      acknowledged: 0,
      partial: 0,
      complete: 0,
      cancelled: 0,
      onHold: 0,
      totalCount: 0,
      totalValue: 0,
      pendingValue: 0,
      completedValue: 0
    }

    const pendingStatuses = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIAL', 'ON_HOLD']

    for (const item of statusCounts) {
      const count = item._count.id
      const value = item._sum.totalAmount || 0

      stats.totalCount += count
      stats.totalValue += value

      switch (item.status) {
        case 'DRAFT':
          stats.draft = count
          break
        case 'SENT':
          stats.sent = count
          stats.pendingValue += value
          break
        case 'ACKNOWLEDGED':
          stats.acknowledged = count
          stats.pendingValue += value
          break
        case 'PARTIAL':
          stats.partial = count
          stats.pendingValue += value
          break
        case 'COMPLETE':
          stats.complete = count
          stats.completedValue += value
          break
        case 'CANCELLED':
          stats.cancelled = count
          break
        case 'ON_HOLD':
          stats.onHold = count
          break
      }
    }

    // Get recent POs
    const recentPOs = await prisma.purchaseOrder.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            displayName: true
          }
        },
        _count: {
          select: {
            lines: true
          }
        }
      }
    })

    // Get POs awaiting receiving
    const awaitingReceiving = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: ['SENT', 'ACKNOWLEDGED', 'PARTIAL']
        }
      },
      take: 10,
      orderBy: { expectedDate: 'asc' },
      include: {
        vendor: {
          select: {
            displayName: true
          }
        }
      }
    })

    return NextResponse.json({
      stats,
      recentPOs: recentPOs.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.displayName,
        status: po.status,
        totalAmount: po.totalAmount,
        txnDate: po.txnDate,
        expectedDate: po.expectedDate,
        lineCount: po._count.lines
      })),
      awaitingReceiving: awaitingReceiving.map(po => ({
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.displayName,
        status: po.status,
        totalAmount: po.totalAmount,
        expectedDate: po.expectedDate
      }))
    })
  } catch (error) {
    console.error('Error fetching PO stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order statistics' },
      { status: 500 }
    )
  }
}

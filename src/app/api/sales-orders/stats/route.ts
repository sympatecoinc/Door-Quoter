import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get sales order statistics
export async function GET(request: NextRequest) {
  try {
    // Get counts by status
    const statusCounts = await prisma.salesOrder.groupBy({
      by: ['status'],
      _count: true
    })

    // Get total count
    const totalCount = await prisma.salesOrder.count()

    // Get totals for non-voided orders
    const totals = await prisma.salesOrder.aggregate({
      where: {
        status: { not: 'VOIDED' }
      },
      _sum: {
        totalAmount: true,
        balance: true
      }
    })

    // Get counts for this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonthCount = await prisma.salesOrder.count({
      where: {
        createdAt: { gte: startOfMonth },
        status: { not: 'VOIDED' }
      }
    })

    const thisMonthTotal = await prisma.salesOrder.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { not: 'VOIDED' }
      },
      _sum: {
        totalAmount: true
      }
    })

    // Format response
    const stats = {
      total: totalCount,
      byStatus: Object.fromEntries(
        statusCounts.map(s => [s.status, s._count])
      ),
      totalAmount: totals._sum.totalAmount || 0,
      totalBalance: totals._sum.balance || 0,
      thisMonth: {
        count: thisMonthCount,
        amount: thisMonthTotal._sum.totalAmount || 0
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching sales order stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

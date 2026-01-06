import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Invoice statistics
export async function GET() {
  try {
    // Get counts by status
    const statusCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true
    })

    // Get total count (excluding voided)
    const totalCount = await prisma.invoice.count({
      where: { status: { not: 'VOIDED' } }
    })

    // Get total amounts (excluding voided)
    const totals = await prisma.invoice.aggregate({
      where: { status: { not: 'VOIDED' } },
      _sum: {
        totalAmount: true,
        balance: true
      }
    })

    // Get this month's invoices
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonth = await prisma.invoice.aggregate({
      where: {
        txnDate: { gte: startOfMonth },
        status: { not: 'VOIDED' }
      },
      _count: true,
      _sum: {
        totalAmount: true
      }
    })

    // Get overdue invoices
    const now = new Date()
    const overdueCount = await prisma.invoice.count({
      where: {
        dueDate: { lt: now },
        balance: { gt: 0 },
        status: { notIn: ['PAID', 'VOIDED'] }
      }
    })

    const overdueTotal = await prisma.invoice.aggregate({
      where: {
        dueDate: { lt: now },
        balance: { gt: 0 },
        status: { notIn: ['PAID', 'VOIDED'] }
      },
      _sum: {
        balance: true
      }
    })

    // Build status counts object
    const byStatus: Record<string, number> = {}
    for (const item of statusCounts) {
      byStatus[item.status] = item._count
    }

    return NextResponse.json({
      total: totalCount,
      byStatus,
      totalAmount: totals._sum.totalAmount || 0,
      totalBalance: totals._sum.balance || 0,
      thisMonth: {
        count: thisMonth._count || 0,
        amount: thisMonth._sum.totalAmount || 0
      },
      overdue: {
        count: overdueCount,
        amount: overdueTotal._sum.balance || 0
      }
    })
  } catch (error) {
    console.error('Error fetching invoice stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice stats' },
      { status: 500 }
    )
  }
}

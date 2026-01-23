import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { SpendAnalyticsResponse, SpendByVendor, SpendByCategory, MonthlySpend } from '@/components/purchasing-dashboard/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '90')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()

    // Get YTD start date
    const ytdStart = new Date(endDate.getFullYear(), 0, 1)

    // Get POs for the period
    const periodPOs = await prisma.purchaseOrder.findMany({
      where: {
        txnDate: { gte: startDate },
        status: { notIn: ['DRAFT', 'CANCELLED'] }
      },
      select: {
        id: true,
        totalAmount: true,
        txnDate: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            displayName: true,
            category: true
          }
        }
      }
    })

    // Get YTD POs for total
    const ytdPOs = await prisma.purchaseOrder.findMany({
      where: {
        txnDate: { gte: ytdStart },
        status: { notIn: ['DRAFT', 'CANCELLED'] }
      },
      select: {
        totalAmount: true
      }
    })

    // Aggregate by vendor
    const vendorSpend: Map<number, { name: string; amount: number; count: number }> = new Map()

    for (const po of periodPOs) {
      const existing = vendorSpend.get(po.vendorId) || {
        name: po.vendor.displayName,
        amount: 0,
        count: 0
      }
      existing.amount += po.totalAmount
      existing.count++
      vendorSpend.set(po.vendorId, existing)
    }

    const byVendor: SpendByVendor[] = Array.from(vendorSpend.entries())
      .map(([vendorId, data]) => ({
        vendorId,
        vendorName: data.name,
        amount: data.amount,
        poCount: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    // Aggregate by category
    const categorySpend: Map<string, number> = new Map()

    for (const po of periodPOs) {
      const category = po.vendor.category || 'Uncategorized'
      categorySpend.set(category, (categorySpend.get(category) || 0) + po.totalAmount)
    }

    const byCategory: SpendByCategory[] = Array.from(categorySpend.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)

    // Monthly trend
    const monthlySpend: Map<string, number> = new Map()

    for (const po of periodPOs) {
      const monthKey = po.txnDate.toISOString().substring(0, 7) // YYYY-MM
      monthlySpend.set(monthKey, (monthlySpend.get(monthKey) || 0) + po.totalAmount)
    }

    const monthlyTrend: MonthlySpend[] = Array.from(monthlySpend.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Calculate totals
    const periodTotal = periodPOs.reduce((sum, po) => sum + po.totalAmount, 0)
    const ytdTotal = ytdPOs.reduce((sum, po) => sum + po.totalAmount, 0)

    const response: SpendAnalyticsResponse = {
      byVendor,
      byCategory,
      monthlyTrend,
      ytdTotal,
      periodTotal,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching spend analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch spend analytics' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { VendorMetricsResponse, VendorMetrics } from '@/components/purchasing-dashboard/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()

    // Get vendors with their PO data
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
        purchaseOrders: {
          some: {
            txnDate: { gte: startDate }
          }
        }
      },
      select: {
        id: true,
        displayName: true,
        purchaseOrders: {
          where: {
            txnDate: { gte: startDate }
          },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            txnDate: true,
            expectedDate: true,
            receivings: {
              select: {
                receivedDate: true
              },
              take: 1,
              orderBy: {
                receivedDate: 'asc'
              }
            }
          }
        }
      }
    })

    // Calculate metrics for each vendor
    const vendorMetrics: VendorMetrics[] = vendors.map(vendor => {
      const pos = vendor.purchaseOrders
      const totalPOs = pos.length
      const completedPOs = pos.filter(po => po.status === 'COMPLETE').length
      const totalValue = pos.reduce((sum, po) => sum + po.totalAmount, 0)

      // Calculate on-time delivery rate
      let onTimeCount = 0
      let deliveredCount = 0
      let totalLeadTimeDays = 0

      for (const po of pos) {
        if (po.receivings.length > 0 && po.expectedDate) {
          deliveredCount++
          const receivedDate = new Date(po.receivings[0].receivedDate)
          const expectedDate = new Date(po.expectedDate)

          if (receivedDate <= expectedDate) {
            onTimeCount++
          }

          // Calculate lead time from order to receipt
          const leadTime = Math.ceil(
            (receivedDate.getTime() - new Date(po.txnDate).getTime()) / (1000 * 60 * 60 * 24)
          )
          totalLeadTimeDays += leadTime
        }
      }

      const onTimeDeliveryRate = deliveredCount > 0
        ? Math.round((onTimeCount / deliveredCount) * 100)
        : null

      const avgLeadTimeDays = deliveredCount > 0
        ? Math.round(totalLeadTimeDays / deliveredCount)
        : null

      return {
        id: vendor.id,
        displayName: vendor.displayName,
        metrics: {
          totalPOs,
          completedPOs,
          onTimeDeliveryRate,
          avgLeadTimeDays,
          totalValue
        }
      }
    })

    // Sort by total value descending
    vendorMetrics.sort((a, b) => b.metrics.totalValue - a.metrics.totalValue)

    const response: VendorMetricsResponse = {
      vendors: vendorMetrics,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching vendor metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendor metrics' },
      { status: 500 }
    )
  }
}

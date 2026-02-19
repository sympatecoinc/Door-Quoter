import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ReceivingQueueResponse, ReceivingPO } from '@/components/purchasing-dashboard/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const twoWeeksOut = new Date(today)
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

    // Get POs awaiting receiving
    const openPOs = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: ['SENT', 'ACKNOWLEDGED', 'PARTIAL']
        }
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalAmount: true,
        expectedDate: true,
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
      },
      orderBy: {
        expectedDate: 'asc'
      }
    })

    const mapPO = (po: typeof openPOs[0]): ReceivingPO => {
      const expectedDate = po.expectedDate ? new Date(po.expectedDate) : null
      let daysUntilDue = 0

      if (expectedDate) {
        daysUntilDue = Math.ceil(
          (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
      }

      return {
        poId: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.displayName,
        expectedDate: po.expectedDate?.toISOString() || '',
        totalAmount: po.totalAmount,
        status: po.status,
        lineCount: po._count.lines,
        daysUntilDue
      }
    }

    // Categorize POs
    const todayPOs: ReceivingPO[] = []
    const upcomingPOs: ReceivingPO[] = []
    const overduePOs: ReceivingPO[] = []

    for (const po of openPOs) {
      const mapped = mapPO(po)

      if (!po.expectedDate) {
        upcomingPOs.push(mapped)
        continue
      }

      const expectedDate = new Date(po.expectedDate)
      expectedDate.setHours(0, 0, 0, 0)

      if (expectedDate < today) {
        overduePOs.push(mapped)
      } else if (expectedDate >= today && expectedDate < tomorrow) {
        todayPOs.push(mapped)
      } else {
        upcomingPOs.push(mapped)
      }
    }

    // Calculate overdue value
    const overdueValue = overduePOs.reduce((sum, po) => sum + po.totalAmount, 0)

    const response: ReceivingQueueResponse = {
      today: todayPOs,
      upcoming: upcomingPOs.slice(0, 20), // Limit to next 20
      overdue: overduePOs,
      summary: {
        todayCount: todayPOs.length,
        upcomingCount: upcomingPOs.length,
        overdueCount: overduePOs.length,
        overdueValue
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching receiving queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch receiving queue' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { PriceHistoryResponse, PriceAlert, VendorPriceComparison } from '@/components/purchasing-dashboard/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '90')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()

    // Get price history records with significant changes (>5%)
    const priceHistoryRecords = await prisma.priceHistory.findMany({
      where: {
        effectiveDate: { gte: startDate },
        OR: [
          { percentChange: { gte: 5 } },
          { percentChange: { lte: -5 } }
        ]
      },
      include: {
        vendor: {
          select: {
            displayName: true
          }
        },
        masterPart: {
          select: {
            partNumber: true
          }
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      },
      take: 50
    })

    const priceAlerts: PriceAlert[] = priceHistoryRecords.map(record => ({
      id: record.id,
      vendorName: record.vendor.displayName,
      partNumber: record.masterPart?.partNumber || null,
      itemDescription: record.description || record.sku,
      previousPrice: record.previousPrice || 0,
      currentPrice: record.unitPrice,
      percentChange: record.percentChange || 0,
      effectiveDate: record.effectiveDate.toISOString()
    }))

    // Build vendor price comparison from recent PO lines
    // Group by part/sku to compare prices across vendors
    const recentPOLines = await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          txnDate: { gte: startDate }
        },
        unitPrice: { gt: 0 }
      },
      select: {
        itemRefName: true,
        description: true,
        unitPrice: true,
        purchaseOrder: {
          select: {
            txnDate: true,
            vendor: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        }
      },
      orderBy: {
        purchaseOrder: {
          txnDate: 'desc'
        }
      }
    })

    // Group by item to compare vendor prices
    const itemPrices: Map<string, Map<number, { price: number; name: string; date: Date }>> = new Map()

    for (const line of recentPOLines) {
      const itemKey = line.itemRefName || line.description || 'Unknown'
      const vendorId = line.purchaseOrder.vendor.id

      if (!itemPrices.has(itemKey)) {
        itemPrices.set(itemKey, new Map())
      }

      const vendorMap = itemPrices.get(itemKey)!
      // Keep most recent price per vendor
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          price: line.unitPrice,
          name: line.purchaseOrder.vendor.displayName,
          date: line.purchaseOrder.txnDate
        })
      }
    }

    // Convert to comparison format (only items with multiple vendors)
    const vendorComparison: VendorPriceComparison[] = []

    for (const [itemKey, vendorMap] of itemPrices) {
      if (vendorMap.size > 1) {
        vendorComparison.push({
          partNumber: itemKey,
          description: null,
          vendors: Array.from(vendorMap.entries()).map(([vendorId, data]) => ({
            vendorId,
            vendorName: data.name,
            price: data.price,
            lastUpdated: data.date.toISOString()
          }))
        })
      }
    }

    // Sort by number of vendors (most comparable first)
    vendorComparison.sort((a, b) => b.vendors.length - a.vendors.length)

    const response: PriceHistoryResponse = {
      priceAlerts,
      vendorComparison: vendorComparison.slice(0, 20),
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching price history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price history' },
      { status: 500 }
    )
  }
}

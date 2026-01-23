import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { StockMetricsResponse, ProfileSummary, FastBurningProfile } from '@/components/purchasing-dashboard/types'

export async function GET() {
  try {
    // Get extrusion variants grouped by profile
    const extrusionParts = await prisma.masterPart.findMany({
      where: {
        partType: 'Extrusion'
      },
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        qtyOnHand: true,
        reorderPoint: true,
        extrusionVariants: {
          select: {
            id: true,
            stockLength: true,
            qtyOnHand: true,
            reorderPoint: true,
            finishPricing: {
              select: {
                finishType: true
              }
            }
          }
        }
      }
    })

    // Group by profile type (using baseName as profile identifier)
    const profileGroups: Map<string, {
      totalStock: number
      lowStockCount: number
      variants: number
    }> = new Map()

    const allProfiles: Array<{
      partNumber: string
      description: string | null
      totalStock: number
    }> = []

    for (const part of extrusionParts) {
      const profileType = part.baseName || 'Unknown'
      const existing = profileGroups.get(profileType) || {
        totalStock: 0,
        lowStockCount: 0,
        variants: 0
      }

      // Sum up stock from variants
      let partTotalStock = part.qtyOnHand || 0
      for (const variant of part.extrusionVariants) {
        partTotalStock += variant.qtyOnHand || 0
        existing.variants++

        if (variant.reorderPoint && variant.qtyOnHand <= variant.reorderPoint) {
          existing.lowStockCount++
        }
      }

      existing.totalStock += partTotalStock

      // Check if main part is low stock
      if (part.reorderPoint && (part.qtyOnHand || 0) <= part.reorderPoint) {
        existing.lowStockCount++
      }

      profileGroups.set(profileType, existing)

      allProfiles.push({
        partNumber: part.partNumber,
        description: part.description,
        totalStock: partTotalStock
      })
    }

    // Convert to array
    const profileSummary: ProfileSummary[] = Array.from(profileGroups.entries())
      .map(([profileType, data]) => ({
        profileType,
        totalStock: data.totalStock,
        lowStockCount: data.lowStockCount,
        variants: data.variants
      }))
      .sort((a, b) => b.totalStock - a.totalStock)

    // Get consumption data from recent POs (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentPOLines = await prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          txnDate: { gte: thirtyDaysAgo },
          status: { in: ['COMPLETE', 'PARTIAL'] }
        },
        OR: [
          { itemRefName: { contains: 'E-' } },
          { description: { contains: 'Extrusion' } }
        ]
      },
      select: {
        itemRefName: true,
        description: true,
        quantityReceived: true
      }
    })

    // Aggregate consumption by part
    const consumptionByPart: Map<string, number> = new Map()
    for (const line of recentPOLines) {
      const partKey = line.itemRefName || line.description || 'Unknown'
      consumptionByPart.set(
        partKey,
        (consumptionByPart.get(partKey) || 0) + line.quantityReceived
      )
    }

    // Find fast-burning profiles (highest ordered in last 30 days)
    const fastBurning: FastBurningProfile[] = Array.from(consumptionByPart.entries())
      .map(([partNumber, consumption]) => {
        const part = extrusionParts.find(p => p.partNumber === partNumber)
        return {
          partNumber,
          description: part?.description || null,
          consumption30Days: consumption,
          currentStock: part?.qtyOnHand || 0
        }
      })
      .sort((a, b) => b.consumption30Days - a.consumption30Days)
      .slice(0, 10)

    const response: StockMetricsResponse = {
      profileSummary,
      fastBurning,
      wasteMetrics: {
        totalWaste: null, // Opticutter integration deferred
        avgWastePercent: null
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching stock metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock metrics' },
      { status: 500 }
    )
  }
}

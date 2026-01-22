import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPartsSummary } from '@/lib/sales-order-parts'

/**
 * GET /api/sales-orders/[id]/parts
 * Retrieve all parts for a sales order with availability info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const soId = parseInt(resolvedParams.id)

    if (isNaN(soId)) {
      return NextResponse.json(
        { error: 'Invalid sales order ID' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const partType = searchParams.get('partType')
    const opening = searchParams.get('opening')
    const groupBy = searchParams.get('groupBy') // 'opening', 'partType', or none

    // Build where clause
    const where: any = { salesOrderId: soId }

    if (status) {
      where.status = status
    }

    if (partType) {
      where.partType = partType
    }

    if (opening) {
      where.openingName = opening
    }

    // Get parts with master part details
    const parts = await prisma.salesOrderPart.findMany({
      where,
      include: {
        masterPart: {
          include: {
            binLocationRef: true
          }
        },
        pickedBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: [
        { openingName: 'asc' },
        { partType: 'asc' },
        { partNumber: 'asc' }
      ]
    })

    // Calculate availability for each part
    const partsWithAvailability = parts.map(part => {
      const onHand = part.masterPart?.qtyOnHand ?? 0
      const reserved = part.masterPart?.qtyReserved ?? 0
      const available = Math.max(0, onHand - reserved)

      return {
        ...part,
        availability: {
          onHand,
          reserved,
          available,
          binLocation: part.masterPart?.binLocationRef?.code ?? null
        }
      }
    })

    // Get summary
    const summary = await getPartsSummary(soId)

    // Group by opening or part type if requested
    let groupedParts: any = null
    if (groupBy === 'opening') {
      groupedParts = {}
      for (const part of partsWithAvailability) {
        const key = part.openingName || 'Ungrouped'
        if (!groupedParts[key]) {
          groupedParts[key] = []
        }
        groupedParts[key].push(part)
      }
    } else if (groupBy === 'partType') {
      groupedParts = {}
      for (const part of partsWithAvailability) {
        const key = part.partType
        if (!groupedParts[key]) {
          groupedParts[key] = []
        }
        groupedParts[key].push(part)
      }
    }

    // Get unique values for filters
    const uniqueOpenings = [...new Set(parts.map(p => p.openingName).filter(Boolean))]
    const uniquePartTypes = [...new Set(parts.map(p => p.partType))]
    const uniqueStatuses = [...new Set(parts.map(p => p.status))]

    return NextResponse.json({
      parts: partsWithAvailability,
      groupedParts,
      summary,
      filters: {
        openings: uniqueOpenings,
        partTypes: uniquePartTypes,
        statuses: uniqueStatuses
      }
    })
  } catch (error) {
    console.error('Error fetching sales order parts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales order parts' },
      { status: 500 }
    )
  }
}

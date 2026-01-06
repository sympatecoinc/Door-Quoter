import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const partType = searchParams.get('partType')
    const vendorId = searchParams.get('vendorId')
    const stockStatus = searchParams.get('stockStatus') // 'all', 'in_stock', 'low_stock', 'out_of_stock'

    const skip = (page - 1) * limit

    const where: any = {}

    // Search filter - search by part number or base name
    if (search) {
      where.OR = [
        { partNumber: { contains: search, mode: 'insensitive' } },
        { baseName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Part type filter
    // When 'all' or no filter, exclude Extrusions (they have their own tab)
    if (partType && partType !== 'all') {
      where.partType = partType
    } else {
      where.partType = { not: 'Extrusion' }
    }

    // Vendor filter
    if (vendorId && vendorId !== 'all') {
      where.vendorId = parseInt(vendorId)
    }

    // Get all parts first (we need to filter by stock status in memory due to calculated field)
    const [allParts, vendors] = await Promise.all([
      prisma.masterPart.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              displayName: true,
              category: true
            }
          }
        },
        orderBy: [
          { partType: 'asc' },
          { partNumber: 'asc' }
        ]
      }),
      prisma.vendor.findMany({
        where: { isActive: true },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' }
      })
    ])

    // Calculate stock status for each part and filter
    const partsWithStatus = allParts.map(part => {
      const qtyOnHand = part.qtyOnHand ?? 0
      const reorderPoint = part.reorderPoint ?? 0

      let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
      if (qtyOnHand <= 0) {
        stockStatus = 'out_of_stock'
      } else if (reorderPoint > 0 && qtyOnHand <= reorderPoint) {
        stockStatus = 'low_stock'
      } else {
        stockStatus = 'in_stock'
      }

      return {
        ...part,
        // Map binLocationLegacy to binLocation for UI compatibility
        binLocation: part.binLocationLegacy,
        stockStatus
      }
    })

    // Filter by stock status if specified
    let filteredParts = partsWithStatus
    if (stockStatus && stockStatus !== 'all') {
      filteredParts = partsWithStatus.filter(p => p.stockStatus === stockStatus)
    }

    // Calculate summary stats
    const totalParts = filteredParts.length
    const lowStockCount = partsWithStatus.filter(p => p.stockStatus === 'low_stock').length
    const outOfStockCount = partsWithStatus.filter(p => p.stockStatus === 'out_of_stock').length

    // Paginate
    const paginatedParts = filteredParts.slice(skip, skip + limit)

    return NextResponse.json({
      parts: paginatedParts,
      vendors,
      summary: {
        totalParts: allParts.length,
        lowStockCount,
        outOfStockCount,
        filteredCount: totalParts
      },
      pagination: {
        page,
        limit,
        total: totalParts,
        pages: Math.ceil(totalParts / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, qtyOnHand, binLocation, reorderPoint, reorderQty, vendorId } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Part ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (qtyOnHand !== undefined) {
      updateData.qtyOnHand = parseFloat(qtyOnHand) || 0
    }
    if (binLocation !== undefined) {
      // Use binLocationLegacy (schema field mapped to 'binLocation' column)
      updateData.binLocationLegacy = binLocation?.trim() || null
    }
    if (reorderPoint !== undefined) {
      updateData.reorderPoint = reorderPoint !== null ? parseFloat(reorderPoint) : null
    }
    if (reorderQty !== undefined) {
      updateData.reorderQty = reorderQty !== null ? parseFloat(reorderQty) : null
    }
    if (vendorId !== undefined) {
      updateData.vendorId = vendorId !== null ? parseInt(vendorId) : null
    }

    const part = await prisma.masterPart.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        vendor: {
          select: {
            id: true,
            displayName: true,
            category: true
          }
        }
      }
    })

    // Calculate stock status
    const qtyOnHandVal = part.qtyOnHand ?? 0
    const reorderPointVal = part.reorderPoint ?? 0

    let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
    if (qtyOnHandVal <= 0) {
      stockStatus = 'out_of_stock'
    } else if (reorderPointVal > 0 && qtyOnHandVal <= reorderPointVal) {
      stockStatus = 'low_stock'
    } else {
      stockStatus = 'in_stock'
    }

    return NextResponse.json({
      ...part,
      // Map binLocationLegacy to binLocation for UI compatibility
      binLocation: part.binLocationLegacy,
      stockStatus
    })
  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    )
  }
}

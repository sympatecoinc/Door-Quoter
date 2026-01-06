import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/bin-locations/[id]/items - Get items in a bin location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const binLocationId = parseInt(id)

    if (isNaN(binLocationId)) {
      return NextResponse.json({ error: 'Invalid bin location ID' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || 'all' // 'masterPart', 'extrusion', or 'all'

    // Get bin location
    const binLocation = await prisma.binLocation.findUnique({
      where: { id: binLocationId }
    })

    if (!binLocation) {
      return NextResponse.json({ error: 'Bin location not found' }, { status: 404 })
    }

    // Build search filter
    const masterPartWhere: Record<string, unknown> = { binLocationId }
    const extrusionWhere: Record<string, unknown> = { binLocationId }

    if (search) {
      masterPartWhere.OR = [
        { partNumber: { contains: search, mode: 'insensitive' } },
        { baseName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
      // For extrusion variants, search on the master part fields
      extrusionWhere.masterPart = {
        OR: [
          { partNumber: { contains: search, mode: 'insensitive' } },
          { baseName: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      }
    }

    // Fetch items based on type
    let masterParts: unknown[] = []
    let extrusionVariants: unknown[] = []

    if (type === 'all' || type === 'masterPart') {
      masterParts = await prisma.masterPart.findMany({
        where: masterPartWhere,
        select: {
          id: true,
          partNumber: true,
          baseName: true,
          description: true,
          partType: true,
          unit: true,
          qtyOnHand: true
        },
        orderBy: { partNumber: 'asc' }
      })
    }

    if (type === 'all' || type === 'extrusion') {
      extrusionVariants = await prisma.extrusionVariant.findMany({
        where: extrusionWhere,
        select: {
          id: true,
          stockLength: true,
          qtyOnHand: true,
          masterPart: {
            select: {
              partNumber: true,
              baseName: true
            }
          },
          finishPricing: {
            select: {
              finishType: true
            }
          }
        },
        orderBy: [
          { masterPart: { partNumber: 'asc' } },
          { stockLength: 'asc' }
        ]
      })
    }

    return NextResponse.json({
      binLocation,
      masterParts,
      extrusionVariants
    })
  } catch (error) {
    console.error('Error fetching bin location items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bin location items' },
      { status: 500 }
    )
  }
}

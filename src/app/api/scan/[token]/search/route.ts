import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SearchItem } from '@/types/bin-location'

// GET /api/scan/[token]/search - Search items for inventory adjustment (PUBLIC - no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Verify token is valid
    const binLocation = await prisma.binLocation.findUnique({
      where: { accessToken: token },
      select: { id: true, isActive: true }
    })

    if (!binLocation) {
      return NextResponse.json({ error: 'Invalid or expired scan code' }, { status: 404 })
    }

    if (!binLocation.isActive) {
      return NextResponse.json({ error: 'This bin location is no longer active' }, { status: 400 })
    }

    if (!query || query.length < 2) {
      return NextResponse.json({ items: [] })
    }

    // Search master parts
    const masterParts = await prisma.masterPart.findMany({
      where: {
        OR: [
          { partNumber: { contains: query, mode: 'insensitive' } },
          { baseName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        partType: true,
        unit: true,
        qtyOnHand: true
      },
      take: 20,
      orderBy: { partNumber: 'asc' }
    })

    // Search extrusion variants
    const extrusionVariants = await prisma.extrusionVariant.findMany({
      where: {
        masterPart: {
          OR: [
            { partNumber: { contains: query, mode: 'insensitive' } },
            { baseName: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        }
      },
      select: {
        id: true,
        stockLength: true,
        qtyOnHand: true,
        masterPart: {
          select: {
            partNumber: true,
            baseName: true,
            description: true
          }
        },
        finishPricing: {
          select: {
            finishType: true
          }
        }
      },
      take: 20,
      orderBy: [
        { masterPart: { partNumber: 'asc' } },
        { stockLength: 'asc' }
      ]
    })

    // Combine and format results
    const items: SearchItem[] = [
      ...masterParts.map(part => ({
        type: 'masterPart' as const,
        id: part.id,
        partNumber: part.partNumber,
        name: part.baseName,
        description: part.description,
        qtyOnHand: part.qtyOnHand || 0,
        unit: part.unit
      })),
      ...extrusionVariants.map(variant => ({
        type: 'extrusion' as const,
        id: variant.id,
        partNumber: variant.masterPart.partNumber,
        name: variant.masterPart.baseName,
        description: variant.masterPart.description,
        qtyOnHand: variant.qtyOnHand,
        stockLength: variant.stockLength,
        finishType: variant.finishPricing?.finishType || 'Mill Finish'
      }))
    ]

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error searching items:', error)
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    )
  }
}

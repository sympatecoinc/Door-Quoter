import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InventoryAdjustment, AdjustmentResult } from '@/types/bin-location'

// POST /api/scan/[token]/adjust - Adjust inventory quantities (PUBLIC - no auth)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { items } = body as { items: InventoryAdjustment[] }

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Verify token is valid
    const binLocation = await prisma.binLocation.findUnique({
      where: { accessToken: token },
      select: { id: true, isActive: true, code: true }
    })

    if (!binLocation) {
      return NextResponse.json({ error: 'Invalid or expired scan code' }, { status: 404 })
    }

    if (!binLocation.isActive) {
      return NextResponse.json({ error: 'This bin location is no longer active' }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    // Process each adjustment
    const adjustments: AdjustmentResult[] = []

    for (const item of items) {
      const { type, id, adjustment } = item

      if (!type || !id || adjustment === undefined || adjustment === null) {
        continue // Skip invalid items
      }

      if (type === 'masterPart') {
        // Get current quantity
        const part = await prisma.masterPart.findUnique({
          where: { id },
          select: { id: true, partNumber: true, baseName: true, qtyOnHand: true }
        })

        if (!part) continue

        const previousQty = part.qtyOnHand || 0
        const newQty = Math.max(0, previousQty + adjustment) // Don't allow negative

        // Update quantity and optionally link to bin location
        await prisma.masterPart.update({
          where: { id },
          data: {
            qtyOnHand: newQty,
            binLocationId: binLocation.id // Auto-link to scanned bin
          }
        })

        adjustments.push({
          type: 'masterPart',
          id: part.id,
          partNumber: part.partNumber,
          name: part.baseName,
          previousQty,
          newQty,
          adjustment
        })
      } else if (type === 'extrusion') {
        // Get current quantity
        const variant = await prisma.extrusionVariant.findUnique({
          where: { id },
          select: {
            id: true,
            qtyOnHand: true,
            stockLength: true,
            masterPart: {
              select: { partNumber: true, baseName: true }
            },
            finishPricing: {
              select: { finishType: true }
            }
          }
        })

        if (!variant) continue

        const previousQty = variant.qtyOnHand
        const newQty = Math.max(0, previousQty + adjustment) // Don't allow negative

        // Update quantity and optionally link to bin location
        await prisma.extrusionVariant.update({
          where: { id },
          data: {
            qtyOnHand: newQty,
            binLocationId: binLocation.id // Auto-link to scanned bin
          }
        })

        const finishName = variant.finishPricing?.finishType || 'Mill Finish'
        const lengthFt = variant.stockLength / 12

        adjustments.push({
          type: 'extrusion',
          id: variant.id,
          partNumber: variant.masterPart.partNumber,
          name: `${variant.masterPart.baseName} - ${lengthFt}ft ${finishName}`,
          previousQty,
          newQty,
          adjustment
        })
      }
    }

    return NextResponse.json({
      success: true,
      adjustments
    })
  } catch (error) {
    console.error('Error adjusting inventory:', error)
    return NextResponse.json(
      { error: 'Failed to adjust inventory' },
      { status: 500 }
    )
  }
}

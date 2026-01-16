import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const partId = parseInt(id)

    if (isNaN(partId)) {
      return NextResponse.json(
        { error: 'Invalid part ID' },
        { status: 400 }
      )
    }

    const part = await prisma.masterPart.findUnique({
      where: { id: partId },
      include: {
        vendor: {
          select: {
            id: true,
            displayName: true,
            category: true,
            primaryEmail: true,
            primaryPhone: true
          }
        }
      }
    })

    if (!part) {
      return NextResponse.json(
        { error: 'Part not found' },
        { status: 404 }
      )
    }

    // Calculate stock status
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

    return NextResponse.json({
      ...part,
      // Map binLocationLegacy to binLocation for UI compatibility
      binLocation: part.binLocationLegacy,
      stockStatus
    })
  } catch (error) {
    console.error('Error fetching part inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch part inventory' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const partId = parseInt(id)

    if (isNaN(partId)) {
      return NextResponse.json(
        { error: 'Invalid part ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    // binLocation is sent from the UI, maps to binLocationLegacy in schema
    const { cost, salePrice, qtyOnHand, binLocation, reorderPoint, reorderQty, vendorId } = body

    const updateData: any = {}

    // Optional fields - only update if provided
    if (cost !== undefined) {
      updateData.cost = cost !== null ? parseFloat(cost) : null
    }
    if (salePrice !== undefined) {
      updateData.salePrice = salePrice !== null ? parseFloat(salePrice) : null
    }
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
      where: { id: partId },
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
    console.error('Error updating part inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update part inventory' },
      { status: 500 }
    )
  }
}

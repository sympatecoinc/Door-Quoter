import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch single variant
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variantId = parseInt(id)

    if (isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 })
    }

    const variant = await prisma.extrusionVariant.findUnique({
      where: { id: variantId },
      include: {
        finishPricing: true,
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            description: true
          }
        }
      }
    })

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json(variant)
  } catch (error) {
    console.error('Error fetching extrusion variant:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extrusion variant' },
      { status: 500 }
    )
  }
}

// PATCH - Update variant
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variantId = parseInt(id)

    if (isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      qtyOnHand,
      binLocation,
      reorderPoint,
      reorderQty,
      pricePerPiece,
      notes,
      isActive
    } = body

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {}
    if (qtyOnHand !== undefined) updateData.qtyOnHand = qtyOnHand
    if (binLocation !== undefined) updateData.binLocation = binLocation
    if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint
    if (reorderQty !== undefined) updateData.reorderQty = reorderQty
    if (pricePerPiece !== undefined) updateData.pricePerPiece = pricePerPiece
    if (notes !== undefined) updateData.notes = notes
    if (isActive !== undefined) updateData.isActive = isActive

    const variant = await prisma.extrusionVariant.update({
      where: { id: variantId },
      data: updateData,
      include: {
        finishPricing: true,
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            description: true
          }
        }
      }
    })

    return NextResponse.json(variant)
  } catch (error) {
    console.error('Error updating extrusion variant:', error)
    return NextResponse.json(
      { error: 'Failed to update extrusion variant' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete (set isActive = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const variantId = parseInt(id)

    if (isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 })
    }

    // Soft delete by setting isActive to false
    await prisma.extrusionVariant.update({
      where: { id: variantId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting extrusion variant:', error)
    return NextResponse.json(
      { error: 'Failed to delete extrusion variant' },
      { status: 500 }
    )
  }
}

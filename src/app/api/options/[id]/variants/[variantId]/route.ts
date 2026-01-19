import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get a single variant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)
    const variantId = parseInt(resolvedParams.variantId)

    if (isNaN(optionId) || isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid option or variant ID' }, { status: 400 })
    }

    const variant = await prisma.optionVariant.findFirst({
      where: { id: variantId, optionId },
      include: {
        linkedParts: {
          include: {
            masterPart: {
              select: {
                id: true,
                partNumber: true,
                baseName: true,
                description: true,
                unit: true,
                cost: true,
                partType: true
              }
            }
          }
        }
      }
    })

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    return NextResponse.json(variant)
  } catch (error) {
    console.error('Error fetching variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a variant
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)
    const variantId = parseInt(resolvedParams.variantId)

    if (isNaN(optionId) || isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid option or variant ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, isDefault, sortOrder } = body

    // Check if variant exists
    const existingVariant = await prisma.optionVariant.findFirst({
      where: { id: variantId, optionId }
    })

    if (!existingVariant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Variant name cannot be empty' }, { status: 400 })
      }
      updateData.name = name.trim()
    }
    if (sortOrder !== undefined) {
      updateData.sortOrder = sortOrder
    }

    // Handle isDefault flag
    if (isDefault !== undefined) {
      updateData.isDefault = isDefault

      // If setting this as default, unset other defaults
      if (isDefault) {
        await prisma.optionVariant.updateMany({
          where: { optionId, isDefault: true, id: { not: variantId } },
          data: { isDefault: false }
        })
      }
    }

    const updatedVariant = await prisma.optionVariant.update({
      where: { id: variantId },
      data: updateData,
      include: {
        linkedParts: {
          include: {
            masterPart: {
              select: {
                id: true,
                partNumber: true,
                baseName: true,
                description: true,
                unit: true,
                cost: true,
                partType: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedVariant)
  } catch (error) {
    console.error('Error updating variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a variant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)
    const variantId = parseInt(resolvedParams.variantId)

    if (isNaN(optionId) || isNaN(variantId)) {
      return NextResponse.json({ error: 'Invalid option or variant ID' }, { status: 400 })
    }

    // Check if variant exists
    const existingVariant = await prisma.optionVariant.findFirst({
      where: { id: variantId, optionId }
    })

    if (!existingVariant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    // Delete the variant (linked parts will be cascade deleted due to schema)
    await prisma.optionVariant.delete({
      where: { id: variantId }
    })

    return NextResponse.json({ message: 'Variant deleted successfully' })
  } catch (error) {
    console.error('Error deleting variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

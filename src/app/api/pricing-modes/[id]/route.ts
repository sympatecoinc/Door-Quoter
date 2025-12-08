import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/pricing-modes/[id] - Get a single pricing mode
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid pricing mode ID' },
        { status: 400 }
      )
    }

    const mode = await prisma.pricingMode.findUnique({
      where: { id },
      include: {
        _count: {
          select: { projects: true }
        }
      }
    })

    if (!mode) {
      return NextResponse.json(
        { error: 'Pricing mode not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(mode)
  } catch (error) {
    console.error('Error fetching pricing mode:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing mode' },
      { status: 500 }
    )
  }
}

// PUT /api/pricing-modes/[id] - Update a pricing mode
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid pricing mode ID' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const { name, description, markup, extrusionMarkup, hardwareMarkup, glassMarkup, discount, isDefault, extrusionCostingMethod } = data

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check if name already exists for a different mode
    const existing = await prisma.pricingMode.findFirst({
      where: {
        name: name.trim(),
        NOT: { id }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A pricing mode with this name already exists' },
        { status: 400 }
      )
    }

    // If this mode is set as default, unset all others
    if (isDefault) {
      await prisma.pricingMode.updateMany({
        where: {
          isDefault: true,
          NOT: { id }
        },
        data: { isDefault: false }
      })
    }

    const mode = await prisma.pricingMode.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        markup: parseFloat(markup) || 0,
        extrusionMarkup: parseFloat(extrusionMarkup) || 0,
        hardwareMarkup: parseFloat(hardwareMarkup) || 0,
        glassMarkup: parseFloat(glassMarkup) || 0,
        discount: parseFloat(discount) || 0,
        isDefault: Boolean(isDefault),
        extrusionCostingMethod: ['PERCENTAGE_BASED', 'HYBRID'].includes(extrusionCostingMethod) ? extrusionCostingMethod : 'FULL_STOCK'
      }
    })

    return NextResponse.json(mode)
  } catch (error) {
    console.error('Error updating pricing mode:', error)
    return NextResponse.json(
      { error: 'Failed to update pricing mode' },
      { status: 500 }
    )
  }
}

// DELETE /api/pricing-modes/[id] - Delete a pricing mode
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid pricing mode ID' },
        { status: 400 }
      )
    }

    // Check if the pricing mode exists and get its details
    const mode = await prisma.pricingMode.findUnique({
      where: { id }
    })

    if (!mode) {
      return NextResponse.json(
        { error: 'Pricing mode not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of default pricing mode
    if (mode.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default pricing mode. Please set another pricing mode as default first.' },
        { status: 400 }
      )
    }

    // Prevent deletion of last pricing mode
    const totalModes = await prisma.pricingMode.count()
    if (totalModes <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last pricing mode. At least one pricing mode must exist.' },
        { status: 400 }
      )
    }

    // Check if any projects are using this mode
    const projectCount = await prisma.project.count({
      where: { pricingModeId: id }
    })

    if (projectCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete pricing mode. It is currently used by ${projectCount} project(s).` },
        { status: 400 }
      )
    }

    await prisma.pricingMode.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting pricing mode:', error)
    return NextResponse.json(
      { error: 'Failed to delete pricing mode' },
      { status: 500 }
    )
  }
}

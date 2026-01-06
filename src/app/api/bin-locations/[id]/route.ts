import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/bin-locations/[id] - Get single bin location with item counts
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

    const binLocation = await prisma.binLocation.findUnique({
      where: { id: binLocationId },
      include: {
        _count: {
          select: {
            masterParts: true,
            extrusionVariants: true
          }
        }
      }
    })

    if (!binLocation) {
      return NextResponse.json({ error: 'Bin location not found' }, { status: 404 })
    }

    return NextResponse.json(binLocation)
  } catch (error) {
    console.error('Error fetching bin location:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bin location' },
      { status: 500 }
    )
  }
}

// PATCH /api/bin-locations/[id] - Update a bin location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const binLocationId = parseInt(id)

    if (isNaN(binLocationId)) {
      return NextResponse.json({ error: 'Invalid bin location ID' }, { status: 400 })
    }

    const body = await request.json()
    const { code, name, description, isActive } = body

    // Check if bin location exists
    const existing = await prisma.binLocation.findUnique({
      where: { id: binLocationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bin location not found' }, { status: 404 })
    }

    // If code is being changed, check for uniqueness
    if (code && code !== existing.code) {
      const codeExists = await prisma.binLocation.findUnique({
        where: { code }
      })
      if (codeExists) {
        return NextResponse.json(
          { error: 'A bin location with this code already exists' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    const binLocation = await prisma.binLocation.update({
      where: { id: binLocationId },
      data: updateData,
      include: {
        _count: {
          select: {
            masterParts: true,
            extrusionVariants: true
          }
        }
      }
    })

    return NextResponse.json(binLocation)
  } catch (error) {
    console.error('Error updating bin location:', error)
    return NextResponse.json(
      { error: 'Failed to update bin location' },
      { status: 500 }
    )
  }
}

// DELETE /api/bin-locations/[id] - Delete a bin location (unlinks all items first)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const binLocationId = parseInt(id)

    if (isNaN(binLocationId)) {
      return NextResponse.json({ error: 'Invalid bin location ID' }, { status: 400 })
    }

    // Check if bin location exists
    const existing = await prisma.binLocation.findUnique({
      where: { id: binLocationId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bin location not found' }, { status: 404 })
    }

    // Unlink all master parts and extrusion variants
    await prisma.$transaction([
      prisma.masterPart.updateMany({
        where: { binLocationId },
        data: { binLocationId: null }
      }),
      prisma.extrusionVariant.updateMany({
        where: { binLocationId },
        data: { binLocationId: null }
      }),
      prisma.binLocation.delete({
        where: { id: binLocationId }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bin location:', error)
    return NextResponse.json(
      { error: 'Failed to delete bin location' },
      { status: 500 }
    )
  }
}

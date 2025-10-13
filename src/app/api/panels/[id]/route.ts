import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const panelId = parseInt(id)
    
    const panel = await prisma.panel.findUnique({
      where: { id: panelId },
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      }
    })

    if (!panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(panel)
  } catch (error) {
    console.error('Error fetching panel:', error)
    return NextResponse.json(
      { error: 'Failed to fetch panel' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const panelId = parseInt(id)
    const { type, width, height, glassType, locking, swingDirection, slidingDirection, isCorner, cornerDirection } = await request.json()

    const panel = await prisma.panel.update({
      where: { id: panelId },
      data: {
        type,
        width: parseFloat(width),
        height: parseFloat(height),
        glassType,
        locking,
        swingDirection,
        slidingDirection,
        isCorner: isCorner || false,
        cornerDirection: cornerDirection || 'Up'
      },
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      }
    })

    return NextResponse.json(panel)
  } catch (error) {
    console.error('Error updating panel:', error)
    return NextResponse.json(
      { error: 'Failed to update panel' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const panelId = parseInt(id)
    const updateData = await request.json()

    // Build update object with only provided fields
    const fieldsToUpdate: any = {}
    if (updateData.width !== undefined) fieldsToUpdate.width = parseFloat(updateData.width)
    if (updateData.height !== undefined) fieldsToUpdate.height = parseFloat(updateData.height)
    if (updateData.type !== undefined) fieldsToUpdate.type = updateData.type
    if (updateData.glassType !== undefined) fieldsToUpdate.glassType = updateData.glassType
    if (updateData.locking !== undefined) fieldsToUpdate.locking = updateData.locking
    if (updateData.swingDirection !== undefined) fieldsToUpdate.swingDirection = updateData.swingDirection
    if (updateData.slidingDirection !== undefined) fieldsToUpdate.slidingDirection = updateData.slidingDirection
    if (updateData.isCorner !== undefined) fieldsToUpdate.isCorner = updateData.isCorner
    if (updateData.cornerDirection !== undefined) fieldsToUpdate.cornerDirection = updateData.cornerDirection
    if (updateData.displayOrder !== undefined) fieldsToUpdate.displayOrder = parseInt(updateData.displayOrder)

    const panel = await prisma.panel.update({
      where: { id: panelId },
      data: fieldsToUpdate,
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      }
    })

    return NextResponse.json(panel)
  } catch (error) {
    console.error('Error updating panel:', error)
    return NextResponse.json(
      { error: 'Failed to update panel' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const panelId = parseInt(id)

    // First check if panel exists
    const panel = await prisma.panel.findUnique({
      where: { id: panelId }
    })

    if (!panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      )
    }

    // Delete the panel (this will cascade delete the componentInstance due to the schema)
    await prisma.panel.delete({
      where: { id: panelId }
    })

    return NextResponse.json({ message: 'Panel deleted successfully' })
  } catch (error) {
    console.error('Error deleting panel:', error)
    return NextResponse.json(
      { error: 'Failed to delete panel' },
      { status: 500 }
    )
  }
}
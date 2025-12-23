import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const openingId = parseInt(resolvedParams.id)
    
    if (isNaN(openingId)) {
      return NextResponse.json(
        { error: 'Invalid opening ID' },
        { status: 400 }
      )
    }

    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: true
              }
            }
          }
        },
        project: true
      }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(opening)
  } catch (error) {
    console.error('Error fetching opening:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opening' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const openingId = parseInt(resolvedParams.id)
    
    if (isNaN(openingId)) {
      return NextResponse.json(
        { error: 'Invalid opening ID' },
        { status: 400 }
      )
    }

    // Note: includeStarterChannels removed - now handled via category options
    const { name, roughWidth, roughHeight, finishedWidth, finishedHeight, price, multiplier, finishColor } = await request.json()

    const updateData: any = {
      name,
      roughWidth: roughWidth ? parseFloat(roughWidth) : null,
      roughHeight: roughHeight ? parseFloat(roughHeight) : null,
      finishedWidth: finishedWidth ? parseFloat(finishedWidth) : null,
      finishedHeight: finishedHeight ? parseFloat(finishedHeight) : null
    }

    if (price !== undefined) {
      updateData.price = parseFloat(price) || 0
    }

    if (multiplier !== undefined) {
      updateData.multiplier = parseFloat(multiplier) || 1.0
    }

    if (finishColor !== undefined) {
      updateData.finishColor = finishColor
    }

    const updatedOpening = await prisma.opening.update({
      where: { id: openingId },
      data: updateData,
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(updatedOpening)
  } catch (error) {
    console.error('Error updating opening:', error)
    return NextResponse.json(
      { error: 'Failed to update opening' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const openingId = parseInt(resolvedParams.id)
    
    if (isNaN(openingId)) {
      return NextResponse.json(
        { error: 'Invalid opening ID' },
        { status: 400 }
      )
    }

    // Check if opening exists
    const opening = await prisma.opening.findUnique({
      where: { id: openingId }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Delete the opening (cascade will handle related panels)
    await prisma.opening.delete({
      where: { id: openingId }
    })

    return NextResponse.json({ message: 'Opening deleted successfully' })
  } catch (error) {
    console.error('Error deleting opening:', error)
    return NextResponse.json(
      { error: 'Failed to delete opening' },
      { status: 500 }
    )
  }
}
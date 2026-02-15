import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked, createLockedError } from '@/lib/project-status'

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
    const {
      name,
      roughWidth,
      roughHeight,
      finishedWidth,
      finishedHeight,
      price,
      multiplier,
      finishColor,
      // Finished Opening Tolerance Fields
      isFinishedOpening,
      openingType,
      widthToleranceTotal,
      heightToleranceTotal
    } = await request.json()

    // Get existing opening data with project status
    const existingOpening = await prisma.opening.findUnique({
      where: { id: openingId },
      include: { project: { select: { status: true } } }
    })

    if (!existingOpening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Check if project is locked for editing
    if (isProjectLocked(existingOpening.project.status)) {
      return NextResponse.json(createLockedError(existingOpening.project.status), { status: 403 })
    }

    const updateData: any = {}

    // Only update fields that are explicitly provided
    if (name !== undefined) {
      updateData.name = name
    }

    // Handle tolerance fields
    if (isFinishedOpening !== undefined) {
      updateData.isFinishedOpening = Boolean(isFinishedOpening)
    }
    if (openingType !== undefined) {
      updateData.openingType = openingType && ['THINWALL', 'FRAMED'].includes(openingType) ? openingType : null
    }
    if (widthToleranceTotal !== undefined) {
      updateData.widthToleranceTotal = widthToleranceTotal !== null ? parseFloat(widthToleranceTotal) : null
    }
    if (heightToleranceTotal !== undefined) {
      updateData.heightToleranceTotal = heightToleranceTotal !== null ? parseFloat(heightToleranceTotal) : null
    }

    // Handle dimension fields
    let finalRoughWidth = roughWidth !== undefined ? (roughWidth ? parseFloat(roughWidth) : null) : existingOpening.roughWidth
    let finalRoughHeight = roughHeight !== undefined ? (roughHeight ? parseFloat(roughHeight) : null) : existingOpening.roughHeight

    if (roughWidth !== undefined) {
      updateData.roughWidth = finalRoughWidth
    }
    if (roughHeight !== undefined) {
      updateData.roughHeight = finalRoughHeight
    }

    // Determine if this should be a finished opening
    const finalIsFinished = isFinishedOpening !== undefined ? Boolean(isFinishedOpening) : existingOpening.isFinishedOpening
    const finalOpeningType = openingType !== undefined ? openingType : existingOpening.openingType

    // Calculate finished dimensions for finished openings
    if (finalIsFinished && finalRoughWidth !== null && finalRoughHeight !== null) {
      // Get tolerances - use new values if provided, else use existing overrides, else fetch defaults
      let widthTol = widthToleranceTotal !== undefined
        ? (widthToleranceTotal !== null ? parseFloat(widthToleranceTotal) : null)
        : existingOpening.widthToleranceTotal
      let heightTol = heightToleranceTotal !== undefined
        ? (heightToleranceTotal !== null ? parseFloat(heightToleranceTotal) : null)
        : existingOpening.heightToleranceTotal

      // If no overrides, use hardcoded defaults based on opening type
      if (widthTol === null || heightTol === null) {
        const defaults = {
          thinwallWidthTolerance: 1.0,
          thinwallHeightTolerance: 1.5,
          framedWidthTolerance: 0.5,
          framedHeightTolerance: 0.75
        }

        if (widthTol === null) {
          widthTol = finalOpeningType === 'FRAMED'
            ? defaults.framedWidthTolerance
            : defaults.thinwallWidthTolerance
        }
        if (heightTol === null) {
          heightTol = finalOpeningType === 'FRAMED'
            ? defaults.framedHeightTolerance
            : defaults.thinwallHeightTolerance
        }
      }

      // Calculate finished dimensions (rough - tolerance)
      updateData.finishedWidth = finalRoughWidth - widthTol
      updateData.finishedHeight = finalRoughHeight - heightTol
    } else {
      // Non-finished opening: use provided values directly
      if (finishedWidth !== undefined) {
        updateData.finishedWidth = finishedWidth ? parseFloat(finishedWidth) : null
      }
      if (finishedHeight !== undefined) {
        updateData.finishedHeight = finishedHeight ? parseFloat(finishedHeight) : null
      }
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

    // Check if opening exists and get project status
    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      include: { project: { select: { status: true } } }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Check if project is locked for editing
    if (isProjectLocked(opening.project.status)) {
      return NextResponse.json(createLockedError(opening.project.status), { status: 403 })
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
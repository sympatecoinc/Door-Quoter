import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateComponentSize } from '@/lib/component-validation'
import { isProjectLocked, createLockedError } from '@/lib/project-status'
import { recalculateTolerancesAfterDeletion } from '@/lib/tolerance-utils'

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
    const { type, width, height, glassType, locking, swingDirection, slidingDirection, isCorner, cornerDirection, skipValidation = false } = await request.json()

    // Check if project is locked by looking up panel -> opening -> project
    const panelForLockCheck = await prisma.panel.findUnique({
      where: { id: panelId },
      include: { opening: { include: { project: { select: { status: true } } } } }
    })

    if (panelForLockCheck && isProjectLocked(panelForLockCheck.opening.project.status)) {
      return NextResponse.json(createLockedError(panelForLockCheck.opening.project.status), { status: 403 })
    }

    // Validate for Finished Openings
    if (!skipValidation) {
      const currentPanel = await prisma.panel.findUnique({
        where: { id: panelId },
        include: {
          opening: {
            include: {
              panels: {
                select: {
                  id: true,
                  width: true,
                  componentInstance: {
                    select: {
                      product: {
                        select: { productType: true }
                      }
                    }
                  }
                }
              }
            }
          },
          componentInstance: {
            include: {
              product: {
                select: { minWidth: true, maxWidth: true, minHeight: true, maxHeight: true, productType: true }
              }
            }
          }
        }
      })

      if (currentPanel && currentPanel.opening.isFinishedOpening &&
          currentPanel.opening.finishedWidth && currentPanel.opening.finishedHeight) {

        const product = currentPanel.componentInstance?.product

        // Skip validation for CORNER_90 and FRAME products
        if (!product || (product.productType !== 'CORNER_90' && product.productType !== 'FRAME')) {
          const parsedWidth = parseFloat(width)
          const parsedHeight = parseFloat(height)

          // Skip validation if dimensions haven't actually changed
          const widthChanged = Math.abs(parsedWidth - currentPanel.width) > 0.001
          const heightChanged = Math.abs(parsedHeight - currentPanel.height) > 0.001

          if (widthChanged || heightChanged) {
            // Exclude current panel AND CORNER_90/FRAME panels from width calculation
            const otherPanelWidths = currentPanel.opening.panels
              .filter(p => {
                if (p.id === panelId) return false
                const pType = p.componentInstance?.product?.productType
                if (pType === 'CORNER_90' || pType === 'FRAME') return false
                return true
              })
              .map(p => p.width)

            const validationResult = validateComponentSize(
              parsedWidth,
              parsedHeight,
              {
                finishedWidth: currentPanel.opening.finishedWidth,
                finishedHeight: currentPanel.opening.finishedHeight,
                existingPanelWidths: otherPanelWidths
              },
              product || {}
            )

            if (!validationResult.valid) {
              return NextResponse.json(
                {
                  error: 'Component size validation failed',
                  validationErrors: validationResult.errors
                },
                { status: 400 }
              )
            }
          }
        }
      }
    }

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

    // Check if project is locked
    const panelForLockCheck = await prisma.panel.findUnique({
      where: { id: panelId },
      include: { opening: { include: { project: { select: { status: true } } } } }
    })

    if (panelForLockCheck && isProjectLocked(panelForLockCheck.opening.project.status)) {
      return NextResponse.json(createLockedError(panelForLockCheck.opening.project.status), { status: 403 })
    }

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

    // Validate for Finished Openings if width or height is being updated
    const skipValidation = updateData.skipValidation || false
    if (!skipValidation && (updateData.width !== undefined || updateData.height !== undefined)) {
      const currentPanel = await prisma.panel.findUnique({
        where: { id: panelId },
        include: {
          opening: {
            include: {
              panels: {
                select: {
                  id: true,
                  width: true,
                  componentInstance: {
                    select: {
                      product: {
                        select: { productType: true }
                      }
                    }
                  }
                }
              }
            }
          },
          componentInstance: {
            include: {
              product: {
                select: { minWidth: true, maxWidth: true, minHeight: true, maxHeight: true, productType: true }
              }
            }
          }
        }
      })

      if (currentPanel && currentPanel.opening.isFinishedOpening &&
          currentPanel.opening.finishedWidth && currentPanel.opening.finishedHeight) {

        const product = currentPanel.componentInstance?.product

        // Skip validation for CORNER_90 and FRAME products
        if (!product || (product.productType !== 'CORNER_90' && product.productType !== 'FRAME')) {
          // Use new value if provided, otherwise use current value
          const parsedWidth = updateData.width !== undefined ? parseFloat(updateData.width) : currentPanel.width
          const parsedHeight = updateData.height !== undefined ? parseFloat(updateData.height) : currentPanel.height

          // Skip validation if dimensions haven't actually changed
          const widthChanged = updateData.width !== undefined && Math.abs(parsedWidth - currentPanel.width) > 0.001
          const heightChanged = updateData.height !== undefined && Math.abs(parsedHeight - currentPanel.height) > 0.001

          if (widthChanged || heightChanged) {
            // Exclude current panel AND CORNER_90/FRAME panels from width calculation
            const otherPanelWidths = currentPanel.opening.panels
              .filter(p => {
                if (p.id === panelId) return false
                const pType = p.componentInstance?.product?.productType
                if (pType === 'CORNER_90' || pType === 'FRAME') return false
                return true
              })
              .map(p => p.width)

            const validationResult = validateComponentSize(
              parsedWidth,
              parsedHeight,
              {
                finishedWidth: currentPanel.opening.finishedWidth,
                finishedHeight: currentPanel.opening.finishedHeight,
                existingPanelWidths: otherPanelWidths
              },
              product || {}
            )

            if (!validationResult.valid) {
              return NextResponse.json(
                {
                  error: 'Component size validation failed',
                  validationErrors: validationResult.errors
                },
                { status: 400 }
              )
            }
          }
        }
      }
    }

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

    // First check if panel exists and get project status with tolerance data
    const panel = await prisma.panel.findUnique({
      where: { id: panelId },
      include: {
        componentInstance: {
          include: { product: true }
        },
        opening: {
          include: { project: { select: { status: true } } }
        }
      }
    })

    if (!panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      )
    }

    // Check if project is locked
    if (isProjectLocked(panel.opening.project.status)) {
      return NextResponse.json(createLockedError(panel.opening.project.status), { status: 403 })
    }

    const opening = panel.opening
    const wasToleranceProduct = panel.componentInstance &&
      opening.toleranceProductId === panel.componentInstance.productId

    // Delete the panel (this will cascade delete the componentInstance due to the schema)
    await prisma.panel.delete({
      where: { id: panelId }
    })

    // Recalculate tolerances if this panel had the tolerance-setting product
    if (wasToleranceProduct && opening.isFinishedOpening) {
      const toleranceUpdate = await recalculateTolerancesAfterDeletion(opening.id)
      if (toleranceUpdate) {
        await prisma.opening.update({
          where: { id: opening.id },
          data: {
            widthToleranceTotal: toleranceUpdate.widthToleranceTotal,
            heightToleranceTotal: toleranceUpdate.heightToleranceTotal,
            toleranceProductId: toleranceUpdate.toleranceProductId,
            finishedWidth: toleranceUpdate.finishedWidth,
            finishedHeight: toleranceUpdate.finishedHeight
          }
        })
      }
    }

    return NextResponse.json({ message: 'Panel deleted successfully' })
  } catch (error) {
    console.error('Error deleting panel:', error)
    return NextResponse.json(
      { error: 'Failed to delete panel' },
      { status: 500 }
    )
  }
}
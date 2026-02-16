import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateComponentSize } from '@/lib/component-validation'
import { isProjectLocked, createLockedError } from '@/lib/project-status'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const openingId = searchParams.get('openingId')

    const where = openingId ? { openingId: parseInt(openingId) } : {}

    const panels = await prisma.panel.findMany({
      where,
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        displayOrder: 'asc'
      }
    })

    return NextResponse.json(panels)
  } catch (error) {
    console.error('Error fetching panels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch panels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      openingId,
      type,
      width,
      height,
      glassType,
      locking,
      swingDirection = 'None',
      slidingDirection = 'Left',
      isCorner = false,
      cornerDirection = 'Up',
      quantity = 1,
      productId,
      skipValidation = false,
      parentPanelId = null  // For explicitly creating paired panels
    } = await request.json()

    if (!openingId || !type) {
      return NextResponse.json(
        { error: 'Opening ID and type are required' },
        { status: 400 }
      )
    }

    // Check if the opening's project is locked
    const openingWithProject = await prisma.opening.findUnique({
      where: { id: parseInt(openingId) },
      include: { project: { select: { status: true } } }
    })

    if (openingWithProject && isProjectLocked(openingWithProject.project.status)) {
      return NextResponse.json(createLockedError(openingWithProject.project.status), { status: 403 })
    }

    // Validate quantity
    const panelCount = parseInt(String(quantity)) || 1
    if (panelCount < 1 || panelCount > 50) {
      return NextResponse.json(
        { error: 'Quantity must be between 1 and 50' },
        { status: 400 }
      )
    }

    // Validate component size against opening dimensions
    if (!skipValidation) {
      const opening = await prisma.opening.findUnique({
        where: { id: parseInt(openingId) },
        include: {
          panels: {
            select: {
              id: true,
              width: true,
              componentInstance: {
                select: {
                  product: {
                    select: { productType: true, jambThickness: true }
                  }
                }
              }
            }
          }
        }
      })

      // Detect FRAME panel and compute interior dimensions for validation
      let jambThickness = 0
      if (opening?.panels) {
        for (const p of opening.panels) {
          if (p.componentInstance?.product?.productType === 'FRAME' &&
              p.componentInstance.product.jambThickness) {
            jambThickness = p.componentInstance.product.jambThickness
            break
          }
        }
      }

      const baseWidth = opening?.finishedWidth || opening?.roughWidth
      const baseHeight = opening?.finishedHeight || opening?.roughHeight
      const constraintWidth = jambThickness > 0 && baseWidth ? baseWidth - (2 * jambThickness) : baseWidth
      const constraintHeight = jambThickness > 0 && baseHeight ? baseHeight - jambThickness : baseHeight

      if (constraintWidth && constraintHeight) {
        // Get product constraints if productId is provided
        let productConstraints: { minWidth?: number | null, maxWidth?: number | null, minHeight?: number | null, maxHeight?: number | null } = {}
        let skipProductValidation = false

        if (productId) {
          const product = await prisma.product.findUnique({
            where: { id: parseInt(productId) },
            select: { minWidth: true, maxWidth: true, minHeight: true, maxHeight: true, productType: true }
          })
          if (product) {
            // Skip validation for CORNER_90 and FRAME products
            if (product.productType === 'CORNER_90' || product.productType === 'FRAME') {
              skipProductValidation = true
            } else {
              productConstraints = {
                minWidth: product.minWidth,
                maxWidth: product.maxWidth,
                minHeight: product.minHeight,
                maxHeight: product.maxHeight
              }
            }
          }
        }

        // Only validate non-corner/non-frame products
        if (!skipProductValidation) {
          const parsedWidth = parseFloat(width) || 0
          const parsedHeight = parseFloat(height) || 0

          // Filter out CORNER_90/FRAME panels from existing panels width calculation
          const existingWidths = opening.panels
            .filter(p => {
              const pType = p.componentInstance?.product?.productType
              return pType !== 'CORNER_90' && pType !== 'FRAME'
            })
            .map(p => p.width)

          // Account for multiple panels being created
          const totalNewWidth = parsedWidth * panelCount

          const validationResult = validateComponentSize(
            totalNewWidth,
            parsedHeight,
            {
              finishedWidth: constraintWidth,
              finishedHeight: constraintHeight,
              existingPanelWidths: existingWidths
            },
            productConstraints
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

    // Get the max displayOrder for this opening to append new panels at the end
    const maxOrderPanel = await prisma.panel.findFirst({
      where: { openingId: parseInt(openingId) },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    })

    let nextDisplayOrder = (maxOrderPanel?.displayOrder ?? -1) + 1

    // Create multiple panels if quantity > 1
    const panels: any[] = []
    for (let i = 0; i < panelCount; i++) {
      const panel = await prisma.panel.create({
        data: {
          openingId: parseInt(openingId),
          type,
          width: parseFloat(width) || 0,
          height: parseFloat(height) || 0,
          glassType: glassType || 'N/A',
          locking: locking || 'N/A',
          swingDirection,
          slidingDirection,
          isCorner,
          cornerDirection,
          displayOrder: nextDisplayOrder + i,
          parentPanelId: parentPanelId ? parseInt(parentPanelId) : null
        },
        include: {
          componentInstance: {
            include: {
              product: true
            }
          }
        }
      })
      panels.push(panel)
    }

    // Check if the product has a frame config and create frame panels automatically
    // Only for primary panels (not when parentPanelId is set, which means this IS a frame panel)
    if (productId && !parentPanelId) {
      const productWithFrame = await prisma.product.findUnique({
        where: { id: parseInt(productId) },
        include: { frameConfig: true }
      })

      // Only create frame panels if:
      // 1. The product has a frame config configured
      // 2. The frame product is NOT the same as the current product (prevent infinite recursion)
      if (productWithFrame?.frameConfig &&
          productWithFrame.frameConfig.id !== productWithFrame.id) {
        // Fetch the opening to get OPENING dimensions for frame panels
        const opening = await prisma.opening.findUnique({
          where: { id: parseInt(openingId) },
          select: {
            finishedWidth: true,
            finishedHeight: true,
            roughWidth: true,
            roughHeight: true,
            isFinishedOpening: true
          }
        })

        if (opening) {
          // Frames fill the full opening — use rough (opening) dimensions, not tolerance-reduced finished size
          const frameWidth = opening.roughWidth ?? opening.finishedWidth ?? 0
          const frameHeight = opening.roughHeight ?? opening.finishedHeight ?? 0

          // Store the primary panels count BEFORE adding frame panels
          const primaryPanelCount = panels.length

          // Create a frame panel for each primary panel created
          // Use index-based loop to avoid issues with array mutation
          for (let i = 0; i < primaryPanelCount; i++) {
            const primaryPanel = panels[i]
            const framePanel = await prisma.panel.create({
              data: {
                openingId: parseInt(openingId),
                type: 'Component',
                width: frameWidth,
                height: frameHeight,
                glassType: 'N/A',  // Frames don't have glass
                locking: 'N/A',
                swingDirection: 'None',
                slidingDirection: 'Left',
                isCorner: false,
                cornerDirection: 'Up',
                displayOrder: nextDisplayOrder + primaryPanelCount + i,  // Place after primary panels
                parentPanelId: primaryPanel.id  // Link to parent panel
              },
              include: {
                componentInstance: {
                  include: {
                    product: true
                  }
                }
              }
            })

            // Add frameConfigId to the panel response for the frontend to create component instance
            panels.push({
              ...framePanel,
              _frameConfigId: productWithFrame.frameConfig.id,
              _isFramePanel: true
            })
          }
        }
      }
    }

    // Return array of panels (consistent whether quantity is 1 or more)
    return NextResponse.json(panels, { status: 201 })
  } catch (error) {
    console.error('Error creating panel(s):', error)
    return NextResponse.json(
      { error: 'Failed to create panel(s)' },
      { status: 500 }
    )
  }
}
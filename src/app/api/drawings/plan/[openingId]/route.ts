import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData } from '@/lib/svg-renderer'
import { processParametricSVG } from '@/lib/parametric-svg-server'

/**
 * Extracts width and height from PNG image data (base64 or buffer)
 * PNG header structure: first 8 bytes are signature, then IHDR chunk contains width/height
 */
function getPngDimensions(base64Data: string): { width: number, height: number } | null {
  try {
    // Strip data URL prefix if present
    const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
    const buffer = Buffer.from(data, 'base64')

    // PNG signature check (first 8 bytes)
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== pngSignature[i]) {
        return null // Not a valid PNG
      }
    }

    // IHDR chunk starts at byte 8, width at byte 16, height at byte 20 (big-endian)
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    return { width, height }
  } catch (error) {
    console.error('Error reading PNG dimensions:', error)
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  try {
    const { openingId } = await params
    const id = parseInt(openingId)

    // Fetch opening data with all related panels and components
    const opening = await prisma.opening.findUnique({
      where: { id },
      include: {
        panels: {
          orderBy: {
            displayOrder: 'asc'
          },
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    planViews: {
                      orderBy: {
                        displayOrder: 'asc'
                      }
                    },
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Get plan view images from products, filtered by panel's swing/sliding direction
    const planViews: Array<{
      productName: string
      planViewName: string
      imageData: string
      fileName?: string
      fileType?: string
      orientation?: string
      width: number
      height: number
      productType: string
      cornerDirection?: string
      isCorner: boolean
      slidingDirection?: string
    }> = []

    for (const panel of opening.panels) {
      const product = panel.componentInstance?.product

      // Handle corners (they don't have plan view images but need to be markers)
      if (product?.productType === 'CORNER_90' && panel.isCorner) {
        console.log(`\n=== Adding CORNER marker for panel ${panel.id} ===`)
        console.log(`  Corner Direction: ${panel.cornerDirection}`)

        planViews.push({
          productName: product.name,
          planViewName: 'Corner',
          imageData: '', // Empty for corners
          fileName: undefined,
          fileType: undefined,
          orientation: 'bottom',
          width: 0,
          height: 0,
          productType: product.productType,
          cornerDirection: panel.cornerDirection,
          isCorner: true
        })
        continue
      }

      if (panel.componentInstance?.product?.planViews) {
        let matchingPlanView

        // Fixed Panels should use the first/only plan view regardless of swing direction
        if (product.productType === 'FIXED_PANEL' && product.planViews.length > 0) {
          matchingPlanView = product.planViews[0]
          console.log(`Using fixed panel plan view: ${matchingPlanView.name}`)
        } else if (product.productType === 'SLIDING_DOOR') {
          // For sliding doors, always use slidingDirection
          const panelDirection = panel.slidingDirection
          console.log(`Looking for sliding door plan view with direction: ${panelDirection}`)
          // Try exact match first, then fuzzy match (plan view name starts with direction)
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
          if (!matchingPlanView) {
            // Fuzzy match: plan view name starts with direction (e.g., "Right Sliding" starts with "Right")
            matchingPlanView = product.planViews.find(
              (pv: any) => pv.name.startsWith(panelDirection)
            )
          }
          if (!matchingPlanView) {
            // Additional fuzzy match: plan view name contains the direction
            matchingPlanView = product.planViews.find(
              (pv: any) => pv.name.toLowerCase().includes(panelDirection.toLowerCase())
            )
          }
          // Fallback to first available plan view if no match found
          if (!matchingPlanView && product.planViews.length > 0) {
            matchingPlanView = product.planViews[0]
            console.log(`Using fallback plan view: ${matchingPlanView.name}`)
          }
          if (matchingPlanView) {
            console.log(`Found matching plan view: ${matchingPlanView.name}`)
          } else {
            console.log(`No plan views available for sliding door`)
          }
        } else if (product.productType === 'SWING_DOOR') {
          // For swing doors, use swingDirection
          const panelDirection = panel.swingDirection
          console.log(`Looking for swing door plan view with direction: ${panelDirection}`)
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
          if (!matchingPlanView) {
            // Fuzzy match: plan view name contains the direction
            matchingPlanView = product.planViews.find(
              (pv: any) => pv.name.toLowerCase().includes(panelDirection.toLowerCase())
            )
          }
          // Fallback to first available plan view if no match found
          if (!matchingPlanView && product.planViews.length > 0) {
            matchingPlanView = product.planViews[0]
            console.log(`Using fallback plan view: ${matchingPlanView.name}`)
          }
          if (matchingPlanView) {
            console.log(`Found matching plan view: ${matchingPlanView.name}`)
          } else {
            console.log(`No plan views available for swing door`)
          }
        } else {
          // For other product types (e.g., CORNER_90), use fallback logic
          const panelDirection = panel.swingDirection !== 'None' ? panel.swingDirection : panel.slidingDirection
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
          // Fallback to first available plan view if no match found
          if (!matchingPlanView && product.planViews.length > 0) {
            matchingPlanView = product.planViews[0]
            console.log(`Using fallback plan view for ${product.productType}: ${matchingPlanView.name}`)
          }
        }

        if (matchingPlanView) {
          let imageData = matchingPlanView.imageData
          const fileName = matchingPlanView.fileName ?? undefined

          // Calculate display dimensions based on file type
          let displayWidth = panel.width
          let displayHeight = panel.width * 0.1  // Default fallback

          // If SVG, process parametrically and render to PNG server-side
          if (isSvgFile(fileName)) {
            try {
              console.log(`Processing SVG plan view for panel ${panel.id}: ${fileName}`)

              // Decode SVG data
              const svgString = decodeSvgData(imageData)

              // Extract original dimensions for calculating display height
              const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
              let svgWidthPx = 91.3353  // Default based on fixed panel SVG
              let svgHeightPx = 4.6139

              if (viewBoxMatch) {
                const viewBox = viewBoxMatch[1].split(/\s+/).map(parseFloat)
                svgWidthPx = viewBox[2]
                svgHeightPx = viewBox[3]
              }

              // Calculate the constant height based on the original aspect ratio
              // SVG is designed at 36" width, so calculate what the height represents
              const originalWidthInches = 36
              const aspectRatio = svgHeightPx / svgWidthPx
              const constantHeightInches = originalWidthInches * aspectRatio

              displayWidth = panel.width
              displayHeight = constantHeightInches

              console.log(`SVG original: ${svgWidthPx}px x ${svgHeightPx}px`)
              console.log(`SVG display: width scales to ${displayWidth}", height at ${displayHeight.toFixed(2)}"`)
              console.log(`SVG aspect ratio: ${aspectRatio.toFixed(4)}`)

              // Process SVG with parametric scaling (handles group transforms)
              console.log(`Applying parametric transforms for plan view`)
              const { scaledSVG } = processParametricSVG(svgString, {
                width: panel.width,
                height: constantHeightInches
              }, 'plan')

              // Render the processed SVG to PNG
              console.log(`Rendering processed SVG to PNG`)
              imageData = await renderSvgToPng(scaledSVG, {
                width: panel.width,
                height: constantHeightInches,
                mode: 'plan'
              })

              console.log(`✓ Successfully rendered SVG plan view to PNG for panel ${panel.id}`)
              console.log(`  PNG data length: ${imageData.length} characters`)
            } catch (error) {
              console.error(`✗ FAILED to render SVG plan view for panel ${panel.id}`)
              console.error(`  Error:`, error)
              console.error(`  Stack:`, (error as Error).stack)
              console.error(`  Falling back to original SVG data`)
              // Fall back to original image data on error
            }
          } else {
            // PNG files: calculate height based on actual PNG aspect ratio
            const pngDims = getPngDimensions(imageData)

            // Check if plan view has a reference width for calibrated scaling
            const referenceWidth = (matchingPlanView as any).referenceWidth as number | null

            if (referenceWidth && pngDims) {
              // Calibrated scaling: PNG displays proportionally to actual panel width
              // referenceWidth tells us what real-world width the PNG represents
              // This makes the PNG proportional to other panels in the opening

              // Scale factor: panel width relative to reference width
              const proportionalScale = panel.width / referenceWidth

              // Display at panel width (scaled proportionally from reference)
              // This makes a 36" swing door PNG appear same width as a 36" fixed panel SVG
              displayWidth = panel.width

              // Maintain PNG aspect ratio for height
              displayHeight = (displayWidth / pngDims.width) * pngDims.height

              console.log(`Processing PNG plan view for panel ${panel.id} with reference width calibration`)
              console.log(`PNG original: ${pngDims.width}px x ${pngDims.height}px`)
              console.log(`Reference width: ${referenceWidth}", Panel width: ${panel.width}"`)
              console.log(`Proportional scale: ${proportionalScale.toFixed(3)}`)
              console.log(`PNG display: ${displayWidth.toFixed(2)}" x ${displayHeight.toFixed(2)}"`)
            } else {
              // Fallback: Legacy scaling with hardcoded scale factors
              // Swing doors need different scaling based on whether they're standalone or with other panels
              let PNG_PLAN_VIEW_SCALE = 0.67
              if (product.productType === 'SWING_DOOR') {
                // Standalone swing doors need moderate scale
                // Swing doors with other panels need slightly smaller scale to stay proportional
                const isStandalone = opening.panels.length === 1
                PNG_PLAN_VIEW_SCALE = isStandalone ? 0.65 : 0.5
              }

              console.log(`Processing PNG plan view for panel ${panel.id} (${product.productType}, standalone: ${opening.panels.length === 1})`)
              displayWidth = panel.width * PNG_PLAN_VIEW_SCALE

              if (pngDims) {
                // Calculate display height maintaining the PNG's aspect ratio
                displayHeight = (displayWidth / pngDims.width) * pngDims.height
                console.log(`PNG original: ${pngDims.width}px x ${pngDims.height}px`)
                console.log(`PNG display: ${displayWidth.toFixed(2)}" x ${displayHeight.toFixed(2)}" (scaled ${PNG_PLAN_VIEW_SCALE})`)
              } else {
                // Fallback: use scaled width as height if dimensions can't be read
                displayHeight = displayWidth
                console.log(`PNG dimensions could not be read, using square fallback: ${displayWidth.toFixed(2)}" x ${displayHeight.toFixed(2)}"`)
              }
            }
          }

          const planViewData = {
            productName: panel.componentInstance.product.name,
            planViewName: matchingPlanView.name,
            imageData: imageData,
            fileName: fileName || undefined,
            fileType: (matchingPlanView as any).fileType || undefined,
            orientation: (matchingPlanView as any).orientation || 'bottom',
            width: displayWidth,
            height: displayHeight,
            productType: product.productType,
            cornerDirection: panel.isCorner ? panel.cornerDirection : undefined,
            isCorner: panel.isCorner || false,
            slidingDirection: product.productType === 'SLIDING_DOOR' ? panel.slidingDirection : undefined
          }

          console.log(`\n=== Adding plan view for panel ${panel.id} ===`)
          console.log(`  Product: ${planViewData.productName}`)
          console.log(`  Product Type: ${planViewData.productType}`)
          console.log(`  Is Corner: ${planViewData.isCorner}`)
          console.log(`  Corner Direction: ${planViewData.cornerDirection}`)

          planViews.push(planViewData)
        }
      }
    }

    if (planViews.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No plan views found for products in this opening'
        },
        { status: 404 }
      )
    }

    // Generate door schedule
    const doorSchedule = {
      headers: ['Opening Name', 'Dimensions', 'Direction', 'Glass', 'Hardware'],
      rows: opening.panels.map((panel) => {
        const product = panel.componentInstance?.product
        const componentInstance = panel.componentInstance

        // Format dimensions
        const dimensions = `${panel.width}" × ${panel.height}"`

        // Determine direction based on product type
        let direction = 'N/A'
        if (product?.productType === 'SWING_DOOR') {
          direction = panel.swingDirection || 'None'
        } else if (product?.productType === 'SLIDING_DOOR') {
          direction = panel.slidingDirection || 'Left'
        } else if (product?.productType === 'FIXED_PANEL') {
          direction = 'Fixed'
        }

        // Parse sub-option selections to get hardware options
        let hardwareOptions: string[] = []
        if (componentInstance?.subOptionSelections) {
          try {
            const selections = JSON.parse(componentInstance.subOptionSelections)

            // Get all selected option names from all categories
            product?.productSubOptions?.forEach((subOption: any) => {
              const categoryId = subOption.category.id
              const selectedOptionId = selections[categoryId]

              if (selectedOptionId) {
                const selectedOption = subOption.category.individualOptions.find(
                  (opt: any) => opt.id === selectedOptionId
                )
                if (selectedOption) {
                  hardwareOptions.push(selectedOption.name)
                }
              }
            })
          } catch (error) {
            console.error('Error parsing sub-option selections:', error)
          }
        }

        const hardwareText = hardwareOptions.length > 0 ? hardwareOptions.join(', ') : 'None'

        return [
          product?.name || 'Unknown',
          dimensions,
          direction,
          panel.glassType || 'N/A',
          hardwareText
        ]
      })
    }

    return NextResponse.json({
      success: true,
      planViews: planViews,
      door_schedule: doorSchedule
    })

  } catch (error) {
    console.error('Error fetching plan views:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plan views' },
      { status: 500 }
    )
  }
}
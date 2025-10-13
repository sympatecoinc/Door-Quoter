import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData } from '@/lib/svg-renderer'

export async function GET(request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  try {
    const { openingId } = await params
    const id = parseInt(openingId)

    // Fetch opening data with all related panels and components
    const opening = await prisma.opening.findUnique({
      where: { id },
      include: {
        panels: {
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
    }> = []

    for (const panel of opening.panels) {
      if (panel.componentInstance?.product?.planViews) {
        const product = panel.componentInstance.product
        let matchingPlanView

        // Fixed Panels should use the first/only plan view regardless of swing direction
        if (product.productType === 'FIXED_PANEL' && product.planViews.length > 0) {
          matchingPlanView = product.planViews[0]
          console.log(`Using fixed panel plan view: ${matchingPlanView.name}`)
        } else if (product.productType === 'SLIDING_DOOR') {
          // For sliding doors, always use slidingDirection
          const panelDirection = panel.slidingDirection
          console.log(`Looking for sliding door plan view with direction: ${panelDirection}`)
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
          if (matchingPlanView) {
            console.log(`Found matching plan view: ${matchingPlanView.name}`)
          } else {
            console.log(`No matching plan view found for sliding direction: ${panelDirection}`)
            console.log(`Available plan views:`, product.planViews.map((pv: any) => pv.name))
          }
        } else if (product.productType === 'SWING_DOOR') {
          // For swing doors, use swingDirection
          const panelDirection = panel.swingDirection
          console.log(`Looking for swing door plan view with direction: ${panelDirection}`)
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
          if (matchingPlanView) {
            console.log(`Found matching plan view: ${matchingPlanView.name}`)
          } else {
            console.log(`No matching plan view found for swing direction: ${panelDirection}`)
            console.log(`Available plan views:`, product.planViews.map((pv: any) => pv.name))
          }
        } else {
          // For other product types (e.g., CORNER_90), use fallback logic
          const panelDirection = panel.swingDirection !== 'None' ? panel.swingDirection : panel.slidingDirection
          matchingPlanView = product.planViews.find(
            (pv: any) => pv.name === panelDirection
          )
        }

        if (matchingPlanView) {
          let imageData = matchingPlanView.imageData
          const fileName = matchingPlanView.fileName ?? undefined

          // Calculate display dimensions based on file type
          let displayWidth = panel.width
          let displayHeight = panel.width * 0.1  // Default fallback

          // If SVG, render to PNG server-side
          if (isSvgFile(fileName)) {
            try {
              console.log(`Processing SVG plan view for panel ${panel.id}: ${fileName}`)

              // Decode SVG data
              const svgString = decodeSvgData(imageData)

              // Render to PNG at 300x300 square
              console.log(`Calling renderSvgToPng for SVG plan view`)
              imageData = await renderSvgToPng(svgString, {
                width: panel.width,
                height: 0,
                mode: 'plan'
              })

              // SVG plan views: width scales, height stays FIXED (doesn't scale)
              // Calculate the constant height based on the original 36" width aspect ratio
              const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
              if (viewBoxMatch) {
                const viewBox = viewBoxMatch[1].split(/\s+/).map(parseFloat)
                const svgWidthPx = viewBox[2]
                const svgHeightPx = viewBox[3]

                // Calculate the natural height at 36" width
                const originalWidthInches = 36
                const aspectRatio = svgHeightPx / svgWidthPx
                const constantHeightInches = originalWidthInches * aspectRatio

                displayWidth = panel.width
                displayHeight = constantHeightInches  // Stays constant regardless of width

                console.log(`SVG display: width scales to ${displayWidth}", height CONSTANT at ${displayHeight.toFixed(2)}"`)
              } else {
                displayWidth = panel.width
                displayHeight = 2.16  // Fallback constant height
              }

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
            // PNG files: scale proportionally (both width and height)
            console.log(`Processing PNG plan view for panel ${panel.id}`)
            displayWidth = panel.width
            displayHeight = panel.width  // Square aspect ratio for PNGs

            console.log(`PNG display (square): ${displayWidth}" x ${displayHeight}"`)
          }

          planViews.push({
            productName: panel.componentInstance.product.name,
            planViewName: matchingPlanView.name,
            imageData: imageData,
            fileName: fileName || undefined,
            fileType: (matchingPlanView as any).fileType || undefined,
            orientation: (matchingPlanView as any).orientation || 'bottom',
            width: displayWidth,
            height: displayHeight
          })
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
      headers: ['Opening Name', 'Direction', 'Glass', 'Hardware'],
      rows: opening.panels.map((panel) => {
        const product = panel.componentInstance?.product
        const componentInstance = panel.componentInstance

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
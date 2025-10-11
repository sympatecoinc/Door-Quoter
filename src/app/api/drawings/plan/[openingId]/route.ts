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
        } else {
          // For swing/sliding doors, match by direction
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

    return NextResponse.json({
      success: true,
      planViews: planViews
    })

  } catch (error) {
    console.error('Error fetching plan views:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plan views' },
      { status: 500 }
    )
  }
}
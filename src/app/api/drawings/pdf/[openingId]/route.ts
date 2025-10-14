import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData } from '@/lib/svg-renderer'
import {
  createSingleOpeningPDF,
  OpeningDrawingData,
  DrawingImageData
} from '@/lib/pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ openingId: string }> }
) {
  try {
    const { openingId } = await params
    const id = parseInt(openingId)

    // Fetch opening data with all related panels and components
    const opening = await prisma.opening.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            name: true
          }
        },
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
      return NextResponse.json({ error: 'Opening not found' }, { status: 404 })
    }

    console.log(`Generating PDF for opening ${opening.id}`)

    // Generate elevation images (same logic as elevation API)
    const elevationImages: DrawingImageData[] = []

    for (const panel of opening.panels) {
      const product = panel.componentInstance?.product

      // Handle corners (they don't have elevation images but need to be markers)
      if (product?.productType === 'CORNER_90' && panel.isCorner) {
        console.log(`Adding CORNER marker for panel ${panel.id}`)

        elevationImages.push({
          productName: product.name,
          imageData: '', // Empty for corners
          width: 0,
          height: 0,
          type: panel.type,
          glassType: panel.glassType,
          locking: panel.locking,
          swingDirection: undefined,
          slidingDirection: undefined,
          hardware: 'None',
          productType: product.productType,
          cornerDirection: panel.cornerDirection,
          isCorner: true
        })
        continue
      }

      if (panel.componentInstance?.product?.elevationImageData) {
        let imageData = panel.componentInstance.product.elevationImageData
        const fileName = panel.componentInstance.product.elevationFileName ?? undefined
        const componentInstance = panel.componentInstance

        // If SVG, render to PNG server-side
        if (isSvgFile(fileName)) {
          try {
            console.log(`Processing SVG elevation for panel ${panel.id}`)
            const svgString = decodeSvgData(imageData)
            imageData = await renderSvgToPng(svgString, {
              width: panel.width,
              height: panel.height,
              mode: 'elevation'
            })
            console.log(`Successfully rendered elevation SVG for panel ${panel.id}`)
          } catch (error) {
            console.error(`Error rendering elevation SVG for panel ${panel.id}:`, error)
          }
        }

        // Parse sub-option selections to get hardware options (same logic as plan API)
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

        elevationImages.push({
          productName: panel.componentInstance.product.name,
          imageData: imageData,
          width: panel.width,
          height: panel.height,
          type: panel.type,
          glassType: panel.glassType,
          locking: panel.locking,
          swingDirection: panel.swingDirection,
          slidingDirection: panel.slidingDirection,
          hardware: hardwareText,
          productType: product.productType
        })
      }
    }

    // Generate plan view images (same logic as plan API)
    const planViews: DrawingImageData[] = []

    for (const panel of opening.panels) {
      const product = panel.componentInstance?.product

      // Handle corners (they don't have plan view images but need to be markers)
      if (product?.productType === 'CORNER_90' && panel.isCorner) {
        console.log(`Adding CORNER marker for plan view, panel ${panel.id}, direction: ${panel.cornerDirection}`)

        planViews.push({
          productName: product.name,
          imageData: '', // Empty for corners
          width: 0,
          height: 0,
          orientation: 'bottom',
          planViewName: 'Corner',
          productType: product.productType,
          cornerDirection: panel.cornerDirection,
          isCorner: true
        })
        continue
      }

      if (panel.componentInstance?.product?.planViews) {
        let matchingPlanView

        // Fixed Panels use first plan view
        if (product.productType === 'FIXED_PANEL' && product.planViews.length > 0) {
          matchingPlanView = product.planViews[0]
          console.log(`Using fixed panel plan view: ${matchingPlanView.name}`)
        } else if (product.productType === 'SLIDING_DOOR') {
          // For sliding doors, always use slidingDirection
          const panelDirection = panel.slidingDirection
          console.log(`Looking for sliding door plan view with direction: ${panelDirection}`)
          matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
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
          matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
          if (matchingPlanView) {
            console.log(`Found matching plan view: ${matchingPlanView.name}`)
          } else {
            console.log(`No matching plan view found for swing direction: ${panelDirection}`)
            console.log(`Available plan views:`, product.planViews.map((pv: any) => pv.name))
          }
        } else {
          // For other product types (e.g., CORNER_90), use fallback logic
          const panelDirection =
            panel.swingDirection !== 'None' ? panel.swingDirection : panel.slidingDirection
          matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
        }

        if (matchingPlanView) {
          let imageData = matchingPlanView.imageData
          const fileName = matchingPlanView.fileName ?? undefined
          let displayWidth = panel.width
          let displayHeight = panel.width * 0.1 // Default fallback

          // If SVG, render to PNG server-side
          if (isSvgFile(fileName)) {
            try {
              console.log(`Processing SVG plan view for panel ${panel.id}: ${fileName}`)

              const svgString = decodeSvgData(imageData)

              // Render to PNG
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

              console.log(`Successfully rendered plan view SVG for panel ${panel.id}`)
            } catch (error) {
              console.error(`Error rendering plan view SVG for panel ${panel.id}:`, error)
            }
          } else {
            // PNG files: scale proportionally (both width and height)
            console.log(`Processing PNG plan view for panel ${panel.id}`)
            displayWidth = panel.width
            displayHeight = panel.width  // Square aspect ratio for PNGs

            console.log(`PNG display (square): ${displayWidth}" x ${displayHeight}"`)
          }

          const planViewOrientation = (matchingPlanView as any).orientation || 'bottom'
          console.log(`Adding plan view to array: ${matchingPlanView.name}, orientation: ${planViewOrientation}`)

          planViews.push({
            productName: panel.componentInstance.product.name,
            imageData: imageData,
            width: displayWidth,
            height: displayHeight,
            orientation: planViewOrientation,
            planViewName: matchingPlanView.name
          })

          console.log(`Plan view added. Total plan views: ${planViews.length}`)
        }
      }
    }

    // Calculate total width (sum of all panel widths) and total height (max panel height)
    const totalWidth = opening.panels.reduce((sum, panel) => sum + panel.width, 0)
    const totalHeight = Math.max(...opening.panels.map((panel) => panel.height))

    // Prepare opening data for PDF generation
    const openingData: OpeningDrawingData = {
      openingNumber: opening.id.toString(),
      openingName: opening.name || `Opening ${opening.id}`,
      totalWidth: totalWidth,
      totalHeight: totalHeight,
      elevationImages: elevationImages,
      planViews: planViews.length > 0 ? planViews : undefined
    }

    // Generate PDF
    const pdf = createSingleOpeningPDF(opening.project.name, openingData)

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    // Return PDF as downloadable file
    const filename = `Opening_${opening.id}_Shop_Drawings.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error generating opening PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

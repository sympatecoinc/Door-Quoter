import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData } from '@/lib/svg-renderer'
import {
  createMultiOpeningPDF,
  ProjectDrawingData,
  OpeningDrawingData,
  DrawingImageData
} from '@/lib/pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    console.log(`Generating complete shop drawing package for project ${projectId}`)

    // Fetch project with all openings and panels
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          orderBy: {
            id: 'asc'
          },
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
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.openings.length === 0) {
      return NextResponse.json(
        { error: 'Project has no openings' },
        { status: 400 }
      )
    }

    console.log(`Processing ${project.openings.length} openings`)

    // Process each opening
    const openingsData: OpeningDrawingData[] = []

    for (const opening of project.openings) {
      console.log(`Processing opening ${opening.id}`)

      // Generate elevation images
      const elevationImages: DrawingImageData[] = []

      for (const panel of opening.panels) {
        if (panel.componentInstance?.product?.elevationImageData) {
          let imageData = panel.componentInstance.product.elevationImageData
          const fileName = panel.componentInstance.product.elevationFileName ?? undefined
          const product = panel.componentInstance.product
          const componentInstance = panel.componentInstance

          // If SVG, render to PNG server-side
          if (isSvgFile(fileName)) {
            try {
              const svgString = decodeSvgData(imageData)
              imageData = await renderSvgToPng(svgString, {
                width: panel.width,
                height: panel.height,
                mode: 'elevation'
              })
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

      // Generate plan view images (using same logic as plan API)
      const planViews: DrawingImageData[] = []

      for (const panel of opening.panels) {
        if (panel.componentInstance?.product?.planViews) {
          const product = panel.componentInstance.product
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
            const panelDirection = panel.swingDirection !== 'None' ? panel.swingDirection : panel.slidingDirection
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

                // Decode SVG data
                const svgString = decodeSvgData(imageData)

                // Render to PNG at appropriate dimensions
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

      // Add opening data
      openingsData.push({
        openingNumber: opening.id.toString(),
        openingName: opening.name || `Opening ${opening.id}`,
        totalWidth: totalWidth,
        totalHeight: totalHeight,
        elevationImages: elevationImages,
        planViews: planViews.length > 0 ? planViews : undefined
      })
    }

    // Prepare project data for PDF generation
    const projectData: ProjectDrawingData = {
      projectName: project.name,
      projectId: project.id,
      openings: openingsData
    }

    console.log('Generating PDF document...')

    // Generate PDF
    const pdf = createMultiOpeningPDF(projectData)

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`)

    // Return PDF as downloadable file
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Shop_Drawings_Complete.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error generating project shop drawings PDF:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate shop drawings PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

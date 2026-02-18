import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData, injectHardwareImages, HardwareImagePlacement } from '@/lib/svg-renderer'
import { processParametricSVG } from '@/lib/parametric-svg-server'
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'
import path from 'path'
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

          // If SVG, render to PNG server-side with hardware injection
          if (isSvgFile(fileName)) {
            try {
              let svgString = decodeSvgData(imageData)

              // First, apply parametric scaling
              console.log(`  [PDF] Applying parametric scaling for panel ${panel.id}`)
              const { scaledSVG } = processParametricSVG(svgString, {
                width: panel.width,
                height: panel.height
              }, 'elevation')

              // Fetch and inject hardware images AFTER scaling
              let finalSvg = scaledSVG
              const hardwarePlacements: HardwareImagePlacement[] = []

              if (componentInstance?.subOptionSelections) {
                try {
                  const selections = JSON.parse(componentInstance.subOptionSelections)

                  // Fetch selected options with their images and category svgOriginId
                  for (const [categoryId, optionId] of Object.entries(selections)) {
                    if (!optionId) continue

                    const option = await prisma.individualOption.findUnique({
                      where: { id: Number(optionId) },
                      include: {
                        category: {
                          select: { svgOriginId: true }
                        }
                      }
                    })

                    if (option?.elevationImagePath && option?.category?.svgOriginId) {
                      const imagePath = path.join(
                        process.cwd(),
                        'uploads',
                        'option-images',
                        String(option.id),
                        option.elevationImagePath
                      )

                      if (fs.existsSync(imagePath)) {
                        // Check if hardware image is SVG
                        const isSvgHardware = option.elevationImagePath.toLowerCase().endsWith('.svg')

                        let hwImageData: string
                        if (isSvgHardware) {
                          hwImageData = fs.readFileSync(imagePath, 'utf-8')
                        } else {
                          const imageBuffer = fs.readFileSync(imagePath)
                          hwImageData = imageBuffer.toString('base64')
                        }

                        // For a 36" tall handle
                        const hwWidth = 164   // ~2 inches wide
                        const hwHeight = 2592 // 36 inches tall

                        hardwarePlacements.push({
                          originId: option.category.svgOriginId,
                          imageData: hwImageData,
                          width: hwWidth,
                          height: hwHeight,
                          isSvg: isSvgHardware
                        })

                        console.log(`    [PDF] → Hardware: ${option.name} @ ${option.category.svgOriginId}`)
                      }
                    }
                  }
                } catch (parseError) {
                  console.error('  [PDF] Error parsing hardware selections:', parseError)
                }
              }

              // Inject hardware images into the SCALED SVG
              if (hardwarePlacements.length > 0) {
                console.log(`  [PDF] Injecting ${hardwarePlacements.length} hardware image(s)`)
                finalSvg = injectHardwareImages(scaledSVG, hardwarePlacements)
              }

              // Render to PNG directly with Resvg
              const pixelsPerInch = 24
              const pngWidth = Math.round(panel.width * pixelsPerInch)

              const resvg = new Resvg(finalSvg, {
                background: '#ffffff',
                fitTo: {
                  mode: 'width',
                  value: pngWidth
                },
                font: {
                  loadSystemFonts: true
                }
              })

              const pngData = resvg.render()
              const pngBuffer = pngData.asPng()
              imageData = pngBuffer.toString('base64')

              console.log(`  [PDF] ✓ Rendered elevation PNG for panel ${panel.id}`)
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
            // Try exact match first, then partial match
            matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
            if (!matchingPlanView) {
              matchingPlanView = product.planViews.find((pv: any) =>
                pv.name.toLowerCase().includes(panelDirection.toLowerCase())
              )
            }
            if (!matchingPlanView && product.planViews.length > 0) {
              matchingPlanView = product.planViews[0]
              console.log(`Using fallback plan view: ${matchingPlanView.name}`)
            }
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
            // Try exact match first, then partial match
            matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
            if (!matchingPlanView) {
              matchingPlanView = product.planViews.find((pv: any) =>
                pv.name.toLowerCase().includes(panelDirection.toLowerCase())
              )
            }
            if (!matchingPlanView && product.planViews.length > 0) {
              matchingPlanView = product.planViews[0]
              console.log(`Using fallback plan view: ${matchingPlanView.name}`)
            }
            if (matchingPlanView) {
              console.log(`Found matching plan view: ${matchingPlanView.name}`)
            } else {
              console.log(`No matching plan view found for swing direction: ${panelDirection}`)
              console.log(`Available plan views:`, product.planViews.map((pv: any) => pv.name))
            }
          } else {
            // For other product types (e.g., CORNER_90), use fallback logic
            const panelDirection = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
            matchingPlanView = product.planViews.find((pv: any) => pv.name === panelDirection)
            if (!matchingPlanView && product.planViews.length > 0) {
              matchingPlanView = product.planViews[0]
            }
          }

          if (matchingPlanView) {
            let imageData = matchingPlanView.imageData
            const fileName = matchingPlanView.fileName ?? undefined
            let displayWidth = panel.width
            let displayHeight = panel.width * 0.1 // Default fallback

            // If SVG, render to PNG server-side with hardware injection
            if (isSvgFile(fileName)) {
              try {
                console.log(`[PDF] Processing SVG plan view for panel ${panel.id}: ${fileName}`)

                // Decode SVG data
                let svgString = decodeSvgData(imageData)

                // Extract original dimensions for calculating display height
                const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
                let svgWidthPx = 91.3353
                let svgHeightPx = 4.6139

                if (viewBoxMatch) {
                  const viewBox = viewBoxMatch[1].split(/\s+/).map(parseFloat)
                  svgWidthPx = viewBox[2]
                  svgHeightPx = viewBox[3]
                }

                // Calculate the constant height based on the original aspect ratio
                const originalWidthInches = 36
                const aspectRatio = svgHeightPx / svgWidthPx
                const constantHeightInches = originalWidthInches * aspectRatio

                displayWidth = panel.width
                displayHeight = constantHeightInches

                // Fetch hardware image placements for plan view
                const planHardwarePlacements: HardwareImagePlacement[] = []
                const componentInstance = panel.componentInstance

                if (componentInstance?.subOptionSelections) {
                  try {
                    const selections = JSON.parse(componentInstance.subOptionSelections)

                    for (const [categoryId, optionId] of Object.entries(selections)) {
                      if (!optionId) continue

                      const option = await prisma.individualOption.findUnique({
                        where: { id: Number(optionId) },
                        include: {
                          category: {
                            select: { svgOriginId: true }
                          }
                        }
                      })

                      if (option?.planImagePath && option?.category?.svgOriginId) {
                        const imagePath = path.join(
                          process.cwd(),
                          'uploads',
                          'option-images',
                          String(option.id),
                          option.planImagePath
                        )

                        if (fs.existsSync(imagePath)) {
                          const isSvgHardware = option.planImagePath.toLowerCase().endsWith('.svg')

                          let hwImageData: string
                          if (isSvgHardware) {
                            hwImageData = fs.readFileSync(imagePath, 'utf-8')
                          } else {
                            const imageBuffer = fs.readFileSync(imagePath)
                            hwImageData = imageBuffer.toString('base64')
                          }

                          planHardwarePlacements.push({
                            originId: option.category.svgOriginId,
                            imageData: hwImageData,
                            width: 50,
                            height: 30,
                            isSvg: isSvgHardware
                          })

                          console.log(`    [PDF] → Hardware (plan): ${option.name} @ ${option.category.svgOriginId}`)
                        }
                      }
                    }
                  } catch (parseError) {
                    console.error('  [PDF] Error parsing hardware selections for plan:', parseError)
                  }
                }

                // Apply parametric scaling FIRST
                console.log(`[PDF] Applying parametric transforms for plan view`)
                const { scaledSVG } = processParametricSVG(svgString, {
                  width: panel.width,
                  height: constantHeightInches
                }, 'plan')

                // NOW inject hardware images into the SCALED SVG
                let finalSvg = scaledSVG
                if (planHardwarePlacements.length > 0) {
                  console.log(`  [PDF] Injecting ${planHardwarePlacements.length} hardware image(s) into scaled plan view`)
                  finalSvg = injectHardwareImages(scaledSVG, planHardwarePlacements)
                }

                // Render the processed SVG to PNG
                imageData = await renderSvgToPng(finalSvg, {
                  width: panel.width,
                  height: constantHeightInches,
                  mode: 'plan'
                })

                console.log(`[PDF] ✓ Successfully rendered SVG plan view to PNG for panel ${panel.id}`)
              } catch (error) {
                console.error(`[PDF] ✗ FAILED to render SVG plan view for panel ${panel.id}`)
                console.error(`  Error:`, error)
                console.error(`  Stack:`, (error as Error).stack)
                // Fall back to original image data on error
              }
            } else {
              // PNG files: scale proportionally (both width and height)
              // Scale factor to reduce PNG plan view size (swing doors)
              const PNG_PLAN_VIEW_SCALE = 0.67  // Reduce by 33%

              console.log(`Processing PNG plan view for panel ${panel.id}`)
              displayWidth = panel.width * PNG_PLAN_VIEW_SCALE
              displayHeight = displayWidth  // Square aspect ratio for PNGs

              console.log(`PNG display (square, scaled ${PNG_PLAN_VIEW_SCALE}): ${displayWidth.toFixed(2)}" x ${displayHeight.toFixed(2)}"`)
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
        planViews: planViews.length > 0 ? planViews : undefined,
        // Framed opening fields
        roughWidth: opening.roughWidth ?? undefined,
        roughHeight: opening.roughHeight ?? undefined,
        finishedWidth: opening.finishedWidth ?? undefined,
        finishedHeight: opening.finishedHeight ?? undefined,
        openingType: opening.openingType ?? undefined,
        isFinishedOpening: opening.isFinishedOpening ?? false
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

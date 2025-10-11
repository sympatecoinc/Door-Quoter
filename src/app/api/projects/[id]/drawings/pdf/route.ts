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
            openingNumber: 'asc'
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
      console.log(`Processing opening ${opening.openingNumber}`)

      // Generate elevation images
      const elevationImages: DrawingImageData[] = []

      for (const panel of opening.panels) {
        if (panel.componentInstance?.product?.elevationImageData) {
          let imageData = panel.componentInstance.product.elevationImageData
          const fileName = panel.componentInstance.product.elevationFileName ?? undefined

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

          elevationImages.push({
            productName: panel.componentInstance.product.name,
            imageData: imageData,
            width: panel.width,
            height: panel.height
          })
        }
      }

      // Generate plan view images
      const planViews: DrawingImageData[] = []

      for (const panel of opening.panels) {
        if (panel.componentInstance?.product?.planViews) {
          const product = panel.componentInstance.product
          let matchingPlanView

          // Fixed Panels use first plan view
          if (product.productType === 'FIXED_PANEL' && product.planViews.length > 0) {
            matchingPlanView = product.planViews[0]
          } else {
            // For swing/sliding doors, match by direction
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
                const svgString = decodeSvgData(imageData)

                // Extract SVG viewBox for height
                const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
                if (viewBoxMatch) {
                  const viewBox = viewBoxMatch[1].split(/\s+/).map(parseFloat)
                  displayHeight = viewBox[3]
                }

                // Render to PNG
                imageData = await renderSvgToPng(svgString, {
                  width: panel.width,
                  height: 0,
                  mode: 'plan'
                })
              } catch (error) {
                console.error(`Error rendering plan view SVG for panel ${panel.id}:`, error)
              }
            }

            planViews.push({
              productName: panel.componentInstance.product.name,
              imageData: imageData,
              width: displayWidth,
              height: displayHeight
            })
          }
        }
      }

      // Add opening data
      openingsData.push({
        openingNumber: opening.openingNumber,
        openingName: opening.name || `Opening ${opening.openingNumber}`,
        totalWidth: opening.totalWidth,
        totalHeight: opening.height,
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

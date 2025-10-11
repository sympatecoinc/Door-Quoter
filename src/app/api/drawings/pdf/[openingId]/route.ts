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

    console.log(`Generating PDF for opening ${opening.openingNumber}`)

    // Generate elevation images (same logic as elevation API)
    const elevationImages: DrawingImageData[] = []

    for (const panel of opening.panels) {
      if (panel.componentInstance?.product?.elevationImageData) {
        let imageData = panel.componentInstance.product.elevationImageData
        const fileName = panel.componentInstance.product.elevationFileName ?? undefined

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

        elevationImages.push({
          productName: panel.componentInstance.product.name,
          imageData: imageData,
          width: panel.width,
          height: panel.height
        })
      }
    }

    // Generate plan view images (same logic as plan API)
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
              console.log(`Processing SVG plan view for panel ${panel.id}`)

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

              console.log(`Successfully rendered plan view SVG for panel ${panel.id}`)
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

    // Prepare opening data for PDF generation
    const openingData: OpeningDrawingData = {
      openingNumber: opening.openingNumber,
      openingName: opening.name || `Opening ${opening.openingNumber}`,
      totalWidth: opening.totalWidth,
      totalHeight: opening.height,
      elevationImages: elevationImages,
      planViews: planViews.length > 0 ? planViews : undefined
    }

    // Generate PDF
    const pdf = createSingleOpeningPDF(opening.project.name, openingData)

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    // Return PDF as downloadable file
    const filename = `Opening_${opening.openingNumber}_Shop_Drawings.pdf`

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

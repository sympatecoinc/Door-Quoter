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
        // Get the direction from the panel (swingDirection or slidingDirection)
        const panelDirection = panel.swingDirection !== 'None' ? panel.swingDirection : panel.slidingDirection

        // Find the plan view that matches this panel's direction
        const matchingPlanView = panel.componentInstance.product.planViews.find(
          (pv: any) => pv.name === panelDirection
        )

        if (matchingPlanView) {
          let imageData = matchingPlanView.imageData
          const fileName = matchingPlanView.fileName

          // If SVG, render to PNG server-side (SHOPGEN approach)
          if (isSvgFile(fileName)) {
            try {
              console.log(`Processing SVG plan view for panel ${panel.id}: ${fileName}`)

              // Decode SVG data
              const svgString = decodeSvgData(imageData)

              // Render to PNG with panel dimensions
              imageData = await renderSvgToPng(svgString, {
                width: panel.width,
                height: panel.height,
                mode: 'plan'
              })

              console.log(`Successfully rendered SVG plan view to PNG for panel ${panel.id}`)
            } catch (error) {
              console.error(`Error rendering SVG plan view for panel ${panel.id}:`, error)
              // Fall back to original image data on error
            }
          }

          planViews.push({
            productName: panel.componentInstance.product.name,
            planViewName: matchingPlanView.name,
            imageData: imageData,
            fileName: fileName || undefined,
            width: panel.width,
            height: panel.height
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
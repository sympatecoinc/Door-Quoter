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
          orderBy: {
            displayOrder: 'asc'
          },
          include: {
            componentInstance: {
              include: {
                product: true
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

    // Get elevation images from products with panel dimensions
    const elevationImages: Array<{
      productName: string
      imageData: string
      fileName?: string
      width: number
      height: number
      productType: string
      swingDirection?: string
      slidingDirection?: string
      isCorner: boolean
      cornerDirection?: string
    }> = []

    for (const panel of opening.panels) {
      const product = panel.componentInstance?.product

      // Handle corners (they don't have elevation images but need to be markers)
      if (product?.productType === 'CORNER_90' && panel.isCorner) {
        elevationImages.push({
          productName: product.name,
          imageData: '', // Empty for corners
          fileName: undefined,
          width: panel.width,
          height: panel.height,
          productType: product.productType,
          swingDirection: undefined,
          slidingDirection: undefined,
          isCorner: true,
          cornerDirection: panel.cornerDirection
        })
        continue
      }

      // Handle regular components with elevation images
      if (panel.componentInstance?.product?.elevationImageData) {
        let imageData = panel.componentInstance.product.elevationImageData
        const fileName = panel.componentInstance.product.elevationFileName ?? undefined

        // If SVG, render to PNG server-side (SHOPGEN approach)
        if (isSvgFile(fileName)) {
          try {
            console.log(`\n=== Processing SVG for panel ${panel.id} ===`)
            console.log(`  Product: ${product.name}`)
            console.log(`  File: ${fileName}`)
            console.log(`  Panel dimensions: ${panel.width}" x ${panel.height}"`)

            // Decode SVG data
            const svgString = decodeSvgData(imageData)

            // Render to PNG with panel dimensions
            imageData = await renderSvgToPng(svgString, {
              width: panel.width,
              height: panel.height,
              mode: 'elevation'
            })

            console.log(`  ✓ Successfully rendered SVG to PNG for panel ${panel.id}`)
          } catch (error) {
            console.error(`  ✗ Error rendering SVG for panel ${panel.id}:`, error)
            // Fall back to original image data on error
          }
        }

        elevationImages.push({
          productName: product.name,
          imageData: imageData,
          fileName: fileName || undefined,
          width: panel.width,
          height: panel.height,
          productType: product.productType,
          swingDirection: panel.swingDirection !== 'None' ? panel.swingDirection : undefined,
          slidingDirection: panel.slidingDirection !== 'Left' && panel.slidingDirection ? panel.slidingDirection : undefined,
          isCorner: false,
          cornerDirection: undefined
        })
      }
    }

    if (elevationImages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No elevation images found for products in this opening'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      elevationImages: elevationImages
    })

  } catch (error) {
    console.error('Error fetching elevation images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch elevation images' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { renderSvgToPng, isSvgFile, decodeSvgData, injectHardwareImages, HardwareImagePlacement } from '@/lib/svg-renderer'
import fs from 'fs'
import path from 'path'

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
            let svgString = decodeSvgData(imageData)

            // Import processParametricSVG for manual control
            const { processParametricSVG } = await import('@/lib/parametric-svg-server')

            // First, apply parametric scaling to position elements correctly
            console.log(`  Applying parametric scaling before hardware injection`)
            const { scaledSVG } = processParametricSVG(svgString, {
              width: panel.width,
              height: panel.height
            }, 'elevation')

            // Now fetch and inject hardware images AFTER scaling
            // This ensures hardware is placed at the correctly scaled origin positions
            let finalSvg = scaledSVG
            const hardwarePlacements: HardwareImagePlacement[] = []
            if (panel.componentInstance?.subOptionSelections) {
              try {
                const selections = JSON.parse(panel.componentInstance.subOptionSelections)
                console.log(`  Hardware selections:`, selections)

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
                    // Read the image file
                    const imagePath = path.join(
                      process.cwd(),
                      'uploads',
                      'option-images',
                      String(option.id),
                      option.elevationImagePath
                    )

                    if (fs.existsSync(imagePath)) {
                      // Check if hardware image is SVG
                      const isSvg = option.elevationImagePath.toLowerCase().endsWith('.svg')

                      let imageData: string
                      if (isSvg) {
                        // Read SVG as text
                        imageData = fs.readFileSync(imagePath, 'utf-8')
                      } else {
                        // Read PNG/JPEG as base64
                        const imageBuffer = fs.readFileSync(imagePath)
                        imageData = imageBuffer.toString('base64')
                      }

                      // Get image dimensions (default to reasonable size if not available)
                      // SVG units: ~72 pixels per inch for height, ~82 pixels per inch for width
                      // For a 36" tall handle:
                      const imageWidth = 164   // ~2 inches wide
                      const imageHeight = 2592 // 36 inches tall (36 * 72)

                      hardwarePlacements.push({
                        originId: option.category.svgOriginId,
                        imageData: imageData,
                        width: imageWidth,
                        height: imageHeight,
                        isSvg: isSvg
                      })

                      console.log(`    → Hardware: ${option.name} @ ${option.category.svgOriginId}`)
                    } else {
                      console.log(`    → Image not found: ${imagePath}`)
                    }
                  }
                }
              } catch (parseError) {
                console.error('  Error parsing hardware selections:', parseError)
              }
            }

            // Inject hardware images into the SCALED SVG
            if (hardwarePlacements.length > 0) {
              console.log(`  Injecting ${hardwarePlacements.length} hardware image(s) into scaled SVG`)
              finalSvg = injectHardwareImages(scaledSVG, hardwarePlacements)
            }

            // Render to PNG - pass the already-scaled SVG directly to resvg
            // We skip parametric processing in renderSvgToPng since we already did it
            const { Resvg } = await import('@resvg/resvg-js')
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

            console.log(`  ✓ Rendered to PNG: ${pngData.width}x${pngData.height}`)

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
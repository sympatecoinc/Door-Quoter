import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    }> = []

    for (const panel of opening.panels) {
      if (panel.componentInstance?.product?.elevationImageData) {
        elevationImages.push({
          productName: panel.componentInstance.product.name,
          imageData: panel.componentInstance.product.elevationImageData,
          fileName: panel.componentInstance.product.elevationFileName || undefined,
          width: panel.width,
          height: panel.height
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
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all plan views for a product
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    const planViews = await prisma.productPlanView.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' }
    })

    return NextResponse.json(planViews)
  } catch (error) {
    console.error('Error fetching plan views:', error)
    return NextResponse.json(
      { error: 'Failed to fetch plan views' },
      { status: 500 }
    )
  }
}

// POST create a new plan view for a product
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const { name, imageData, fileName, fileType, orientation } = await request.json()

    if (!name || !imageData) {
      return NextResponse.json(
        { error: 'Name and image data are required' },
        { status: 400 }
      )
    }

    // Auto-detect file type from data URL or filename if not provided
    let detectedFileType = fileType
    if (!detectedFileType && imageData) {
      // Check if it's a data URL
      if (imageData.startsWith('data:')) {
        const match = imageData.match(/^data:([^;]+);/)
        if (match) {
          detectedFileType = match[1]
        }
      }
      // Fallback to filename extension
      if (!detectedFileType && fileName) {
        const ext = fileName.toLowerCase().split('.').pop()
        if (ext === 'svg') detectedFileType = 'image/svg+xml'
        else if (ext === 'png') detectedFileType = 'image/png'
        else if (ext === 'jpg' || ext === 'jpeg') detectedFileType = 'image/jpeg'
      }
    }

    // Get the current max display order for this product
    const maxOrder = await prisma.productPlanView.aggregate({
      where: { productId },
      _max: { displayOrder: true }
    })

    const planView = await prisma.productPlanView.create({
      data: {
        productId,
        name,
        imageData,
        fileName,
        fileType: detectedFileType || 'image/png',
        orientation: orientation || 'bottom',
        displayOrder: (maxOrder._max.displayOrder || 0) + 1
      }
    })

    return NextResponse.json(planView, { status: 201 })
  } catch (error) {
    console.error('Error creating plan view:', error)
    return NextResponse.json(
      { error: 'Failed to create plan view' },
      { status: 500 }
    )
  }
}
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

// Helper to detect file type from data URL or filename
function detectFileType(dataUrl: string | null, fileName: string | null): string | null {
  if (dataUrl?.startsWith('data:')) {
    const match = dataUrl.match(/^data:([^;]+);/)
    if (match) return match[1]
  }
  if (fileName) {
    const ext = fileName.toLowerCase().split('.').pop()
    if (ext === 'svg') return 'image/svg+xml'
    if (ext === 'png') return 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  }
  return null
}

// POST create a new view for a product (plan + elevation images)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const {
      name,
      // Plan view fields
      imageData,
      fileName,
      fileType,
      orientation,
      referenceWidth,
      // Elevation view fields
      elevationImageData,
      elevationFileName,
      elevationFileType
    } = await request.json()

    if (!name || !imageData) {
      return NextResponse.json(
        { error: 'Name and plan image data are required' },
        { status: 400 }
      )
    }

    // Auto-detect file types
    const detectedPlanFileType = fileType || detectFileType(imageData, fileName) || 'image/png'
    const detectedElevationFileType = elevationFileType || detectFileType(elevationImageData, elevationFileName)

    // Get the current max display order for this product
    const maxOrder = await prisma.productPlanView.aggregate({
      where: { productId },
      _max: { displayOrder: true }
    })

    const planView = await prisma.productPlanView.create({
      data: {
        productId,
        name,
        // Plan view data
        imageData,
        fileName,
        fileType: detectedPlanFileType,
        orientation: orientation || 'bottom',
        referenceWidth: referenceWidth ? parseFloat(referenceWidth) : null,
        // Elevation view data
        elevationImageData: elevationImageData || null,
        elevationFileName: elevationFileName || null,
        elevationFileType: detectedElevationFileType || null,
        displayOrder: (maxOrder._max.displayOrder || 0) + 1
      }
    })

    return NextResponse.json(planView, { status: 201 })
  } catch (error) {
    console.error('Error creating view:', error)
    return NextResponse.json(
      { error: 'Failed to create view' },
      { status: 500 }
    )
  }
}
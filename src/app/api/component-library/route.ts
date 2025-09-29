import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProductType } from '@prisma/client'

// GET /api/component-library - List all components
export async function GET() {
  try {
    const components = await prisma.componentLibrary.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            panels: true
          }
        }
      }
    })

    return NextResponse.json(components)
  } catch (error) {
    console.error('Error fetching component library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component library' },
      { status: 500 }
    )
  }
}

// POST /api/component-library - Create new component
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      hasSwingDirection = false,
      hasSlidingDirection = false,
      elevationImageData,
      planImageData,
      elevationFileName,
      planFileName,
      isParametric = true,
      productType = 'SWING_DOOR'
    } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Component name is required' },
        { status: 400 }
      )
    }

    // Check if component name already exists
    const existingComponent = await prisma.componentLibrary.findUnique({
      where: { name }
    })

    if (existingComponent) {
      return NextResponse.json(
        { error: 'Component name already exists' },
        { status: 400 }
      )
    }

    // Validate productType
    if (!Object.values(ProductType).includes(productType)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

    const component = await prisma.componentLibrary.create({
      data: {
        name,
        description,
        hasSwingDirection,
        hasSlidingDirection,
        elevationImageData,
        planImageData,
        elevationFileName,
        planFileName,
        isParametric,
        productType
      }
    })

    return NextResponse.json(component, { status: 201 })
  } catch (error) {
    console.error('Error creating component:', error)
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    )
  }
}
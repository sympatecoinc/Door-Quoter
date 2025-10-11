import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where = projectId ? { projectId: parseInt(projectId) } : {}

    const openings = await prisma.opening.findMany({
      where,
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: { include: { productSubOptions: { include: { category: { include: { individualOptions: true } } } } } }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(openings)
  } catch (error) {
    console.error('Error fetching openings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch openings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      name,
      openingNumber, // Support both field names for backward compatibility
      roughWidth,
      roughHeight,
      finishedWidth,
      finishedHeight,
      width, // Support the form field name
      height, // Support the form field name
      finishColor,
      price = 0,
      multiplier
    } = await request.json()

    // Use name if provided, otherwise use openingNumber
    const openingName = name || openingNumber

    if (!projectId || !openingName) {
      return NextResponse.json(
        { error: 'Project ID and opening name are required' },
        { status: 400 }
      )
    }

    // Validate finish color - required field with specific values
    if (!finishColor || !['Black', 'Clear', 'Other'].includes(finishColor)) {
      return NextResponse.json(
        { error: 'Finish color is required and must be Black, Clear, or Other' },
        { status: 400 }
      )
    }

    // Check if opening name already exists for this project
    const existingOpening = await prisma.opening.findFirst({
      where: {
        projectId: parseInt(projectId),
        name: openingName
      }
    })

    if (existingOpening) {
      return NextResponse.json(
        { error: 'Opening name already exists for this project' },
        { status: 400 }
      )
    }

    // Build the data object with optional size fields
    const openingData: any = {
      projectId: parseInt(projectId),
      name: openingName,
      finishColor: finishColor,
      price: parseFloat(price) || 0
    }

    if (multiplier !== undefined) {
      openingData.multiplier = parseFloat(multiplier) || 1.0
    }

    // Add size fields only if they have values
    if (roughWidth && roughWidth !== '') {
      openingData.roughWidth = parseFloat(roughWidth)
    }
    if (roughHeight && roughHeight !== '') {
      openingData.roughHeight = parseFloat(roughHeight)
    }
    if (finishedWidth && finishedWidth !== '') {
      openingData.finishedWidth = parseFloat(finishedWidth)
    }
    if (finishedHeight && finishedHeight !== '') {
      openingData.finishedHeight = parseFloat(finishedHeight)
    }
    
    // Support simplified width/height fields from form
    if (width && width !== '' && !roughWidth) {
      openingData.roughWidth = parseFloat(width)
      openingData.finishedWidth = parseFloat(width)
    }
    if (height && height !== '' && !roughHeight) {
      openingData.roughHeight = parseFloat(height)
      openingData.finishedHeight = parseFloat(height)
    }

    const opening = await prisma.opening.create({
      data: openingData,
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: { include: { productSubOptions: { include: { category: { include: { individualOptions: true } } } } } }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(opening, { status: 201 })
  } catch (error) {
    console.error('Error creating opening:', error)
    return NextResponse.json(
      { error: 'Failed to create opening' },
      { status: 500 }
    )
  }
}
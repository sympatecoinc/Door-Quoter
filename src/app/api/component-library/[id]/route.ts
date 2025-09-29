import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProductType } from '@prisma/client'

// GET /api/component-library/[id] - Get single component
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const componentId = parseInt(id)

    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid component ID' },
        { status: 400 }
      )
    }

    const component = await prisma.componentLibrary.findUnique({
      where: { id: componentId },
      include: {
        panels: {
          include: {
            opening: {
              include: {
                project: true
              }
            }
          }
        }
      }
    })

    if (!component) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(component)
  } catch (error) {
    console.error('Error fetching component:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component' },
      { status: 500 }
    )
  }
}

// PUT /api/component-library/[id] - Update component
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const componentId = parseInt(id)

    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid component ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
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
    } = body

    // Check if component exists
    const existingComponent = await prisma.componentLibrary.findUnique({
      where: { id: componentId }
    })

    if (!existingComponent) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with existing component
    if (name && name !== existingComponent.name) {
      const nameConflict = await prisma.componentLibrary.findUnique({
        where: { name }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Component name already exists' },
          { status: 400 }
        )
      }
    }

    // Validate productType if provided
    if (productType && !Object.values(ProductType).includes(productType)) {
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

    const component = await prisma.componentLibrary.update({
      where: { id: componentId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(hasSwingDirection !== undefined && { hasSwingDirection }),
        ...(hasSlidingDirection !== undefined && { hasSlidingDirection }),
        ...(elevationImageData !== undefined && { elevationImageData }),
        ...(planImageData !== undefined && { planImageData }),
        ...(elevationFileName !== undefined && { elevationFileName }),
        ...(planFileName !== undefined && { planFileName }),
        ...(isParametric !== undefined && { isParametric }),
        ...(productType !== undefined && { productType })
      }
    })

    return NextResponse.json(component)
  } catch (error) {
    console.error('Error updating component:', error)
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    )
  }
}

// DELETE /api/component-library/[id] - Delete component
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const componentId = parseInt(id)

    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid component ID' },
        { status: 400 }
      )
    }

    // Check if component exists
    const existingComponent = await prisma.componentLibrary.findUnique({
      where: { id: componentId },
      include: {
        _count: {
          select: {
            panels: true
          }
        }
      }
    })

    if (!existingComponent) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      )
    }

    // Check if component is being used by panels
    if (existingComponent._count.panels > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete component. It is currently used by ${existingComponent._count.panels} panel(s).`
        },
        { status: 400 }
      )
    }

    await prisma.componentLibrary.delete({
      where: { id: componentId }
    })

    return NextResponse.json({ message: 'Component deleted successfully' })
  } catch (error) {
    console.error('Error deleting component:', error)
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    )
  }
}
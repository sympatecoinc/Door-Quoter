import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productBOMs: true,
        productSubOptions: {
          include: {
            category: {
              include: {
                individualOptions: true
              }
            }
          }
        },
        _count: {
          select: {
            productBOMs: true,
            productSubOptions: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const {
      name,
      description,
      type,
      productType,
      withTrim,
      glassWidthFormula,
      glassHeightFormula,
      glassQuantityFormula,
      elevationImageData,
      elevationFileName
    } = await request.json()

    // Prepare update data
    const updateData: any = {}

    // Only update fields that are provided
    if (name !== undefined) {
      if (!name) {
        return NextResponse.json(
          { error: 'Product name is required' },
          { status: 400 }
        )
      }
      updateData.name = name
    }
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type || 'Product'
    if (withTrim !== undefined) updateData.withTrim = withTrim
    if (productType !== undefined) {
      // Validate productType
      const validProductTypes = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL', 'CORNER_90']
      if (!validProductTypes.includes(productType)) {
        return NextResponse.json(
          { error: 'Invalid product type. Must be one of: Swing Door, Sliding Door, Fixed Panel, 90 Degree Corner' },
          { status: 400 }
        )
      }
      updateData.productType = productType
    }
    if (glassWidthFormula !== undefined) updateData.glassWidthFormula = glassWidthFormula
    if (glassHeightFormula !== undefined) updateData.glassHeightFormula = glassHeightFormula
    if (glassQuantityFormula !== undefined) updateData.glassQuantityFormula = glassQuantityFormula
    if (elevationImageData !== undefined) updateData.elevationImageData = elevationImageData
    if (elevationFileName !== undefined) updateData.elevationFileName = elevationFileName

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        productBOMs: true,
        productSubOptions: {
          include: {
            category: {
              include: {
                individualOptions: true
              }
            }
          }
        },
        _count: {
          select: {
            productBOMs: true,
            productSubOptions: true
          }
        }
      }
    })

    // Update or create corresponding ComponentLibrary entry if elevation image is provided
    if (elevationImageData !== undefined ||
        name !== undefined || description !== undefined || productType !== undefined || withTrim !== undefined) {

      const componentName = `${product.name} (${product.withTrim})`

      // Check if ComponentLibrary entry exists
      const existingComponent = await prisma.componentLibrary.findFirst({
        where: {
          OR: [
            { name: componentName },
            { name: { contains: product.name } }
          ]
        }
      })

      const componentData: any = {}
      if (name !== undefined || withTrim !== undefined) componentData.name = componentName
      if (description !== undefined) componentData.description = description
      if (productType !== undefined) {
        componentData.productType = productType
        componentData.hasSwingDirection = productType === 'SWING_DOOR'
        componentData.hasSlidingDirection = productType === 'SLIDING_DOOR'
      }
      if (elevationImageData !== undefined) {
        componentData.elevationImageData = elevationImageData
        componentData.elevationFileName = elevationFileName
      }

      if (existingComponent) {
        // Update existing component
        await prisma.componentLibrary.update({
          where: { id: existingComponent.id },
          data: componentData
        })
      } else if (elevationImageData) {
        // Create new component only if elevation image is provided
        await prisma.componentLibrary.create({
          data: {
            name: componentName,
            description: product.description,
            productType: product.productType,
            hasSwingDirection: product.productType === 'SWING_DOOR',
            hasSlidingDirection: product.productType === 'SLIDING_DOOR',
            elevationImageData,
            elevationFileName,
            isParametric: true
          }
        })
      }
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    // Check if product is used in any projects
    const componentInstances = await prisma.componentInstance.findMany({
      where: { productId: productId },
      include: {
        panel: {
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

    if (componentInstances.length > 0) {
      // Product is used in projects, offer to archive instead
      const projects = componentInstances.map(ci => ci.panel.opening.project.name)
      const uniqueProjects = [...new Set(projects)]
      
      return NextResponse.json(
        { 
          error: 'Product is used in projects and cannot be deleted',
          message: `This product is used in ${uniqueProjects.length} project(s): ${uniqueProjects.join(', ')}. You can archive it instead to keep it available in existing projects but hide it from new selections.`,
          usedInProjects: uniqueProjects,
          canArchive: true
        },
        { status: 400 }
      )
    }

    // Product is not used in any projects, safe to delete
    await prisma.product.delete({
      where: { id: productId }
    })

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
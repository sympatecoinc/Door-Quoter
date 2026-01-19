import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productBOMs: {
          include: {
            option: true
          }
        },
        productSubOptions: {
          include: {
            category: {
              include: {
                individualOptions: {
                  include: {
                    variants: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
                    }
                  }
                }
              }
            },
            standardOption: true
          }
        },
        planViews: {
          orderBy: {
            displayOrder: 'asc'
          }
        },
        pairedProduct: {
          select: {
            id: true,
            name: true,
            productType: true
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
      productCategory,
      defaultWidth,
      glassWidthFormula,
      glassHeightFormula,
      glassQuantityFormula,
      elevationImageData,
      elevationFileName,
      installationPrice,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      pairedProductId,
      widthTolerance,
      heightTolerance
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
    if (productType !== undefined) {
      // Validate productType
      const validProductTypes = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL', 'CORNER_90', 'FRAME']
      if (!validProductTypes.includes(productType)) {
        return NextResponse.json(
          { error: 'Invalid product type. Must be one of: Swing Door, Sliding Door, Fixed Panel, 90 Degree Corner, Frame' },
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
    if (installationPrice !== undefined) updateData.installationPrice = installationPrice

    // Size constraint fields - allow null to clear the constraint
    if (minWidth !== undefined) updateData.minWidth = minWidth !== null && minWidth !== '' ? parseFloat(minWidth) : null
    if (maxWidth !== undefined) updateData.maxWidth = maxWidth !== null && maxWidth !== '' ? parseFloat(maxWidth) : null
    if (minHeight !== undefined) updateData.minHeight = minHeight !== null && minHeight !== '' ? parseFloat(minHeight) : null
    if (maxHeight !== undefined) updateData.maxHeight = maxHeight !== null && maxHeight !== '' ? parseFloat(maxHeight) : null

    // Paired product - auto-add another product when this one is added (e.g., door adds frame)
    if (pairedProductId !== undefined) {
      // Validate paired product exists if setting (allow null to clear)
      if (pairedProductId !== null) {
        const pairedProduct = await prisma.product.findUnique({
          where: { id: parseInt(pairedProductId) }
        })
        if (!pairedProduct) {
          return NextResponse.json(
            { error: 'Paired product not found' },
            { status: 400 }
          )
        }
        // Prevent self-referencing
        if (parseInt(pairedProductId) === productId) {
          return NextResponse.json(
            { error: 'A product cannot be paired with itself' },
            { status: 400 }
          )
        }
        updateData.pairedProductId = parseInt(pairedProductId)
      } else {
        updateData.pairedProductId = null
      }
    }

    // Product category for streamlined opening flow
    if (productCategory !== undefined) {
      const validCategories = ['THINWALL', 'TRIMMED', 'BOTH']
      if (validCategories.includes(productCategory)) {
        updateData.productCategory = productCategory
      }
    }

    // Default width for component creation
    if (defaultWidth !== undefined) {
      updateData.defaultWidth = defaultWidth !== null && defaultWidth !== '' ? parseFloat(defaultWidth) : null
    }

    // Product tolerance fields - allow null to clear the tolerance
    const toleranceEligibleTypes = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL']
    const currentProductType = productType || (await prisma.product.findUnique({ where: { id: productId }, select: { productType: true } }))?.productType

    if (toleranceEligibleTypes.includes(currentProductType || '')) {
      if (widthTolerance !== undefined) {
        updateData.widthTolerance = widthTolerance !== null && widthTolerance !== '' ? parseFloat(widthTolerance) : null
      }
      if (heightTolerance !== undefined) {
        updateData.heightTolerance = heightTolerance !== null && heightTolerance !== '' ? parseFloat(heightTolerance) : null
      }
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        productBOMs: {
          include: {
            option: true
          }
        },
        productSubOptions: {
          include: {
            category: {
              include: {
                individualOptions: {
                  include: {
                    variants: {
                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
                    }
                  }
                }
              }
            },
            standardOption: true
          }
        },
        pairedProduct: {
          select: {
            id: true,
            name: true,
            productType: true
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
        name !== undefined || description !== undefined || productType !== undefined) {

      const componentName = product.name

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
      if (name !== undefined) componentData.name = componentName
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
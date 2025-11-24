import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    
    const products = await prisma.product.findMany({
      where: includeArchived ? {} : { archived: false },
      include: {
        productSubOptions: {
          include: {
            category: true
          }
        },
        productBOMs: true,
        planViews: {
          orderBy: {
            displayOrder: 'asc'
          }
        },
        _count: {
          select: {
            productBOMs: true,
            productSubOptions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      description,
      type = 'Product',
      productType = 'SWING_DOOR',
      elevationImageData,
      planImageData,
      elevationFileName,
      planFileName
    } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      )
    }

    // Validate productType
    const validProductTypes = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL', 'CORNER_90']
    if (!validProductTypes.includes(productType)) {
      return NextResponse.json(
        { error: 'Invalid product type. Must be one of: Swing Door, Sliding Door, Fixed Panel, 90 Degree Corner' },
        { status: 400 }
      )
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        description,
        type,
        productType
      }
    })

    // Only create ComponentLibrary entry if images are actually provided
    // This allows products to be created without images initially

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
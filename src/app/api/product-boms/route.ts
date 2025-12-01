import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    const where = productId ? { productId: parseInt(productId) } : {}

    const productBOMs = await prisma.productBOM.findMany({
      where,
      include: {
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(productBOMs)
  } catch (error) {
    console.error('Error fetching product BOMs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product BOMs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      productId,
      partType,
      partName,
      description,
      formula,
      variable,
      unit,
      quantity,
      stockLength,
      partNumber,
      cost,
      addFinishToPartNumber,
      addToPackingList
    } = await request.json()

    if (!productId || !partName) {
      return NextResponse.json(
        { error: 'Product ID and part name are required' },
        { status: 400 }
      )
    }

    const productBOM = await prisma.productBOM.create({
      data: {
        productId: parseInt(productId),
        partType: partType || 'Hardware',
        partName,
        description: description || null,
        formula: formula || null,
        variable: variable || null,
        unit: unit || null,
        quantity: quantity || null,
        stockLength: stockLength || null,
        partNumber: partNumber || null,
        cost: cost || null,
        addFinishToPartNumber: addFinishToPartNumber || false,
        addToPackingList: addToPackingList || false
      },
      include: {
        product: true
      }
    })

    return NextResponse.json(productBOM, { status: 201 })
  } catch (error) {
    console.error('Error creating product BOM:', error)
    return NextResponse.json(
      { error: 'Failed to create product BOM' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      partType,
      partName,
      description,
      formula,
      variable,
      unit,
      quantity,
      stockLength,
      partNumber,
      cost,
      addFinishToPartNumber,
      addToPackingList
    } = await request.json()

    if (!id || !partName) {
      return NextResponse.json(
        { error: 'ID and part name are required' },
        { status: 400 }
      )
    }

    const productBOM = await prisma.productBOM.update({
      where: { id: parseInt(id) },
      data: {
        partType: partType || 'Hardware',
        partName,
        description: description || null,
        formula: formula || null,
        variable: variable || null,
        unit: unit || null,
        quantity: quantity || null,
        stockLength: stockLength || null,
        partNumber: partNumber || null,
        cost: cost || null,
        addFinishToPartNumber: addFinishToPartNumber !== undefined ? addFinishToPartNumber : undefined,
        addToPackingList: addToPackingList !== undefined ? addToPackingList : undefined
      },
      include: {
        product: true
      }
    })

    return NextResponse.json(productBOM)
  } catch (error) {
    console.error('Error updating product BOM:', error)
    return NextResponse.json(
      { error: 'Failed to update product BOM' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    await prisma.productBOM.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ message: 'Product BOM deleted successfully' })
  } catch (error) {
    console.error('Error deleting product BOM:', error)
    return NextResponse.json(
      { error: 'Failed to delete product BOM' },
      { status: 500 }
    )
  }
}
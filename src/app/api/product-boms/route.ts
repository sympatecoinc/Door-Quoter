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
      optionId,
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
      isMilled,
      addFinishToPartNumber,
      addToPackingList,
      quantityMode,
      minQuantity,
      maxQuantity,
      defaultQuantity
    } = await request.json()

    if (!productId || !partName) {
      return NextResponse.json(
        { error: 'Product ID and part name are required' },
        { status: 400 }
      )
    }

    // Validate RANGE mode has min/max
    if (quantityMode === 'RANGE') {
      if (minQuantity === undefined || minQuantity === null ||
          maxQuantity === undefined || maxQuantity === null) {
        return NextResponse.json(
          { error: 'RANGE mode requires minQuantity and maxQuantity' },
          { status: 400 }
        )
      }
    }

    // If optionId is provided, check if BOM already exists for this option
    if (optionId) {
      const existingBom = await prisma.productBOM.findFirst({
        where: {
          productId: parseInt(productId),
          optionId: parseInt(optionId)
        }
      })
      if (existingBom) {
        // Update existing instead of creating duplicate
        const updatedBOM = await prisma.productBOM.update({
          where: { id: existingBom.id },
          data: {
            partType: partType || 'Extrusion',
            partName,
            description: description || null,
            formula: formula || null,
            variable: variable || null,
            unit: unit || null,
            quantity: quantity || null,
            stockLength: stockLength || null,
            partNumber: partNumber || null,
            cost: cost || null,
            isMilled: isMilled !== undefined ? isMilled : true,
            addFinishToPartNumber: addFinishToPartNumber || false,
            addToPackingList: addToPackingList || false,
            quantityMode: quantityMode || 'FIXED',
            minQuantity: minQuantity || null,
            maxQuantity: maxQuantity || null,
            defaultQuantity: defaultQuantity || null
          },
          include: { product: true, option: true }
        })
        return NextResponse.json(updatedBOM)
      }
    }

    const productBOM = await prisma.productBOM.create({
      data: {
        productId: parseInt(productId),
        optionId: optionId ? parseInt(optionId) : null,
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
        isMilled: isMilled !== undefined ? isMilled : true,
        addFinishToPartNumber: addFinishToPartNumber || false,
        addToPackingList: addToPackingList || false,
        quantityMode: quantityMode || 'FIXED',
        minQuantity: minQuantity || null,
        maxQuantity: maxQuantity || null,
        defaultQuantity: defaultQuantity || null
      },
      include: {
        product: true,
        option: true
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
      isMilled,
      addFinishToPartNumber,
      addToPackingList,
      quantityMode,
      minQuantity,
      maxQuantity,
      defaultQuantity
    } = await request.json()

    if (!id || !partName) {
      return NextResponse.json(
        { error: 'ID and part name are required' },
        { status: 400 }
      )
    }

    // Validate RANGE mode has min/max
    if (quantityMode === 'RANGE') {
      if (minQuantity === undefined || minQuantity === null ||
          maxQuantity === undefined || maxQuantity === null) {
        return NextResponse.json(
          { error: 'RANGE mode requires minQuantity and maxQuantity' },
          { status: 400 }
        )
      }
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
        isMilled: isMilled !== undefined ? isMilled : undefined,
        addFinishToPartNumber: addFinishToPartNumber !== undefined ? addFinishToPartNumber : undefined,
        addToPackingList: addToPackingList !== undefined ? addToPackingList : undefined,
        quantityMode: quantityMode !== undefined ? quantityMode : undefined,
        minQuantity: minQuantity !== undefined ? minQuantity : undefined,
        maxQuantity: maxQuantity !== undefined ? maxQuantity : undefined,
        defaultQuantity: defaultQuantity !== undefined ? defaultQuantity : undefined
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
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    // Get the original product with all its relations
    const originalProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        productBOMs: true,
        productSubOptions: {
          include: {
            category: true
          }
        }
      }
    })

    if (!originalProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Create the duplicated product
    const duplicatedProduct = await prisma.product.create({
      data: {
        name: `${originalProduct.name} (Copy)`,
        description: originalProduct.description,
        type: originalProduct.type,
        archived: false, // New products should not be archived
        withTrim: originalProduct.withTrim,
        // Duplicate all BOM parts
        productBOMs: {
          create: originalProduct.productBOMs.map(bom => ({
            partType: bom.partType,
            partName: bom.partName,
            description: bom.description,
            formula: bom.formula,
            variable: bom.variable,
            unit: bom.unit,
            quantity: bom.quantity,
            stockLength: bom.stockLength,
            partNumber: bom.partNumber,
            cost: bom.cost
          }))
        },
        // Duplicate all linked categories
        productSubOptions: {
          create: originalProduct.productSubOptions.map(option => ({
            categoryId: option.categoryId
          }))
        }
      },
      include: {
        productBOMs: true,
        productSubOptions: {
          include: {
            category: true
          }
        },
        _count: {
          select: {
            productSubOptions: true
          }
        }
      }
    })

    return NextResponse.json(duplicatedProduct)
  } catch (error) {
    console.error('Error duplicating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
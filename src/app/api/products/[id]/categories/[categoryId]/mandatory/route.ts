import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id, categoryId } = await params
    const productId = parseInt(id)
    const categoryIdInt = parseInt(categoryId)
    const { isMandatory } = await request.json()

    // Verify the product-category link exists
    const productSubOption = await prisma.productSubOption.findUnique({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: categoryIdInt
        }
      }
    })

    if (!productSubOption) {
      return NextResponse.json(
        { error: 'Category not linked to this product' },
        { status: 404 }
      )
    }

    // Update the mandatory flag
    const updated = await prisma.productSubOption.update({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: categoryIdInt
        }
      },
      data: {
        isMandatory: Boolean(isMandatory)
      },
      include: {
        category: {
          include: {
            individualOptions: true
          }
        },
        standardOption: true
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating mandatory status:', error)
    return NextResponse.json(
      { error: 'Failed to update mandatory status' },
      { status: 500 }
    )
  }
}

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
    const { standardOptionId } = await request.json()

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

    // If setting a standard, verify the option belongs to this category
    if (standardOptionId) {
      const option = await prisma.individualOption.findFirst({
        where: {
          id: standardOptionId,
          categoryId: categoryIdInt
        }
      })

      if (!option) {
        return NextResponse.json(
          { error: 'Option does not belong to this category' },
          { status: 400 }
        )
      }
    }

    // Update the standard option
    const updated = await prisma.productSubOption.update({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: categoryIdInt
        }
      },
      data: {
        standardOptionId: standardOptionId || null
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
    console.error('Error updating standard hardware:', error)
    return NextResponse.json(
      { error: 'Failed to update standard hardware' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id, categoryId } = await params
    const productId = parseInt(id)
    const categoryIdInt = parseInt(categoryId)

    const productSubOption = await prisma.productSubOption.findUnique({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: categoryIdInt
        }
      },
      include: {
        standardOption: true,
        category: {
          include: {
            individualOptions: true
          }
        }
      }
    })

    if (!productSubOption) {
      return NextResponse.json(
        { error: 'Category not linked to this product' },
        { status: 404 }
      )
    }

    return NextResponse.json(productSubOption)
  } catch (error) {
    console.error('Error fetching standard hardware:', error)
    return NextResponse.json(
      { error: 'Failed to fetch standard hardware' },
      { status: 500 }
    )
  }
}

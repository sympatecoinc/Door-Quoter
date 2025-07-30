import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const { categoryId } = await request.json()

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    // Check if the link already exists
    const existingLink = await prisma.productSubOption.findUnique({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: parseInt(categoryId)
        }
      }
    })

    if (existingLink) {
      return NextResponse.json(
        { error: 'Category is already linked to this product' },
        { status: 400 }
      )
    }

    // Create the link
    const productSubOption = await prisma.productSubOption.create({
      data: {
        productId: productId,
        categoryId: parseInt(categoryId)
      },
      include: {
        category: {
          include: {
            individualOptions: true
          }
        },
        product: true
      }
    })

    return NextResponse.json(productSubOption, { status: 201 })
  } catch (error) {
    console.error('Error linking category to product:', error)
    return NextResponse.json(
      { error: 'Failed to link category to product' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    // Delete the link
    await prisma.productSubOption.delete({
      where: {
        productId_categoryId: {
          productId: productId,
          categoryId: parseInt(categoryId)
        }
      }
    })

    return NextResponse.json({ message: 'Category unlinked successfully' })
  } catch (error) {
    console.error('Error unlinking category from product:', error)
    return NextResponse.json(
      { error: 'Failed to unlink category from product' },
      { status: 500 }
    )
  }
}
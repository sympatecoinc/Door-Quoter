import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const productId = parseInt(id)
    const { archived } = await request.json()

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        archived: archived
      },
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

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error archiving product:', error)
    return NextResponse.json(
      { error: 'Failed to archive product' },
      { status: 500 }
    )
  }
}
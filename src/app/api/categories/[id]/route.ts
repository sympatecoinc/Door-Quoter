import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const categoryId = parseInt(id)
    
    const category = await prisma.subOptionCategory.findUnique({
      where: { id: categoryId },
      include: {
        individualOptions: {
          include: {
            linkedParts: {
              include: {
                masterPart: {
                  select: {
                    id: true,
                    partNumber: true,
                    baseName: true,
                    description: true,
                    unit: true,
                    cost: true,
                    partType: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            individualOptions: true,
            productSubOptions: true
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Enrich options with master part type info
    const partNumbers = category.individualOptions
      .map(opt => opt.partNumber)
      .filter((pn): pn is string => !!pn)

    const masterParts = partNumbers.length > 0
      ? await prisma.masterPart.findMany({
          where: { partNumber: { in: partNumbers } },
          select: { partNumber: true, partType: true }
        })
      : []

    const partTypeMap = new Map(masterParts.map(mp => [mp.partNumber, mp.partType]))

    const enrichedOptions = category.individualOptions.map(opt => ({
      ...opt,
      masterPartType: opt.partNumber ? partTypeMap.get(opt.partNumber) || null : null
    }))

    return NextResponse.json({
      ...category,
      individualOptions: enrichedOptions
    })
  } catch (error) {
    console.error('Error fetching category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const categoryId = parseInt(id)
    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      )
    }

    const category = await prisma.subOptionCategory.update({
      where: { id: categoryId },
      data: {
        name,
        description
      },
      include: {
        individualOptions: true,
        _count: {
          select: {
            individualOptions: true,
            productSubOptions: true
          }
        }
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const categoryId = parseInt(id)

    // Check if category has linked products
    const productLinks = await prisma.productSubOption.findMany({
      where: { categoryId: categoryId }
    })

    if (productLinks.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that is linked to products. Unlink from products first.' },
        { status: 400 }
      )
    }

    // Delete the category (individual options will be deleted due to cascade)
    await prisma.subOptionCategory.delete({
      where: { id: categoryId }
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
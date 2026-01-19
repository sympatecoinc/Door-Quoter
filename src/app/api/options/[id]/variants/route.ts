import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List all variants for an option
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)

    if (isNaN(optionId)) {
      return NextResponse.json({ error: 'Invalid option ID' }, { status: 400 })
    }

    // Check if option exists
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId }
    })

    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 })
    }

    // Fetch all variants for this option
    const variants = await prisma.optionVariant.findMany({
      where: { optionId },
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
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
    })

    return NextResponse.json(variants)
  } catch (error) {
    console.error('Error fetching option variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new variant for an option
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)

    if (isNaN(optionId)) {
      return NextResponse.json({ error: 'Invalid option ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, isDefault, sortOrder } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Variant name is required' }, { status: 400 })
    }

    // Check if option exists
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId }
    })

    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 })
    }

    // If this is set as default, unset other defaults for this option
    if (isDefault) {
      await prisma.optionVariant.updateMany({
        where: { optionId, isDefault: true },
        data: { isDefault: false }
      })
    }

    // Get max sortOrder if not provided
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const maxSortOrder = await prisma.optionVariant.aggregate({
        where: { optionId },
        _max: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1
    }

    // Create the variant
    const newVariant = await prisma.optionVariant.create({
      data: {
        optionId,
        name: name.trim(),
        isDefault: isDefault || false,
        sortOrder: finalSortOrder
      },
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
    })

    return NextResponse.json(newVariant)
  } catch (error) {
    console.error('Error creating option variant:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

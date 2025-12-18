import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List all parts attached to a glass type
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const glassTypeId = parseInt(resolvedParams.id)

    if (isNaN(glassTypeId)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    // Check if glass type exists
    const glassType = await prisma.glassType.findUnique({
      where: { id: glassTypeId }
    })

    if (!glassType) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 })
    }

    // Fetch all parts attached to this glass type
    const parts = await prisma.glassTypePart.findMany({
      where: { glassTypeId },
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
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching glass type parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new part to a glass type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const glassTypeId = parseInt(resolvedParams.id)

    if (isNaN(glassTypeId)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    const body = await request.json()
    const { masterPartId, formula, quantity, addFinishToPartNumber, addToPackingList } = body

    if (!masterPartId) {
      return NextResponse.json({ error: 'Master part ID is required' }, { status: 400 })
    }

    // Check if glass type exists
    const glassType = await prisma.glassType.findUnique({
      where: { id: glassTypeId }
    })

    if (!glassType) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 })
    }

    // Check if master part exists
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId }
    })

    if (!masterPart) {
      return NextResponse.json({ error: 'Master part not found' }, { status: 404 })
    }

    // Check if this part is already attached to this glass type
    const existingPart = await prisma.glassTypePart.findUnique({
      where: {
        glassTypeId_masterPartId: {
          glassTypeId,
          masterPartId
        }
      }
    })

    if (existingPart) {
      return NextResponse.json({ error: 'This part is already attached to this glass type' }, { status: 409 })
    }

    // Create the glass type part
    const newPart = await prisma.glassTypePart.create({
      data: {
        glassTypeId,
        masterPartId,
        formula: formula?.trim() || null,
        quantity: quantity ? parseFloat(quantity) : null,
        addFinishToPartNumber: addFinishToPartNumber ?? false,
        addToPackingList: addToPackingList ?? true
      },
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
    })

    return NextResponse.json(newPart)
  } catch (error) {
    console.error('Error creating glass type part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a glass type part
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const glassTypeId = parseInt(resolvedParams.id)

    if (isNaN(glassTypeId)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    const body = await request.json()
    const { partId, formula, quantity, addFinishToPartNumber, addToPackingList } = body

    if (!partId) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 })
    }

    // Check if the glass type part exists
    const existingPart = await prisma.glassTypePart.findFirst({
      where: {
        id: partId,
        glassTypeId
      }
    })

    if (!existingPart) {
      return NextResponse.json({ error: 'Glass type part not found' }, { status: 404 })
    }

    // Update the part
    const updatedPart = await prisma.glassTypePart.update({
      where: { id: partId },
      data: {
        formula: formula?.trim() || null,
        quantity: quantity !== undefined && quantity !== null && quantity !== '' ? parseFloat(quantity) : null,
        addFinishToPartNumber: addFinishToPartNumber ?? existingPart.addFinishToPartNumber,
        addToPackingList: addToPackingList ?? existingPart.addToPackingList
      },
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
    })

    return NextResponse.json(updatedPart)
  } catch (error) {
    console.error('Error updating glass type part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a part from a glass type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const glassTypeId = parseInt(resolvedParams.id)

    if (isNaN(glassTypeId)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    // Get partId from query params
    const { searchParams } = new URL(request.url)
    const partId = parseInt(searchParams.get('partId') || '')

    if (isNaN(partId)) {
      return NextResponse.json({ error: 'Valid part ID is required' }, { status: 400 })
    }

    // Check if the glass type part exists
    const existingPart = await prisma.glassTypePart.findFirst({
      where: {
        id: partId,
        glassTypeId
      }
    })

    if (!existingPart) {
      return NextResponse.json({ error: 'Glass type part not found' }, { status: 404 })
    }

    // Delete the part
    await prisma.glassTypePart.delete({
      where: { id: partId }
    })

    return NextResponse.json({ message: 'Glass type part deleted successfully' })
  } catch (error) {
    console.error('Error deleting glass type part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

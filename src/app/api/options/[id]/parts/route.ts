import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - List all linked parts for an option
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

    // Fetch all linked parts for this option
    const parts = await prisma.optionLinkedPart.findMany({
      where: { optionId },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            description: true,
            unit: true,
            cost: true,
            partType: true,
            addFinishToPartNumber: true,
            addToPackingList: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(parts)
  } catch (error) {
    console.error('Error fetching option linked parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new linked part to an option
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
    const { masterPartId, quantity } = body

    if (!masterPartId) {
      return NextResponse.json({ error: 'Master part ID is required' }, { status: 400 })
    }

    // Check if option exists
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId }
    })

    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 })
    }

    // Check if master part exists
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId }
    })

    if (!masterPart) {
      return NextResponse.json({ error: 'Master part not found' }, { status: 404 })
    }

    // Check if this part is already linked to this option
    const existingPart = await prisma.optionLinkedPart.findUnique({
      where: {
        optionId_masterPartId: {
          optionId,
          masterPartId
        }
      }
    })

    if (existingPart) {
      return NextResponse.json({ error: 'This part is already linked to this option' }, { status: 409 })
    }

    // Create the linked part
    const newPart = await prisma.optionLinkedPart.create({
      data: {
        optionId,
        masterPartId,
        quantity: quantity ? parseFloat(quantity) : 1
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
            partType: true,
            addFinishToPartNumber: true,
            addToPackingList: true
          }
        }
      }
    })

    return NextResponse.json(newPart)
  } catch (error) {
    console.error('Error creating option linked part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a linked part (quantity)
export async function PUT(
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
    const { partId, quantity } = body

    if (!partId) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 })
    }

    // Check if the linked part exists
    const existingPart = await prisma.optionLinkedPart.findFirst({
      where: {
        id: partId,
        optionId
      }
    })

    if (!existingPart) {
      return NextResponse.json({ error: 'Linked part not found' }, { status: 404 })
    }

    // Update the part
    const updatedPart = await prisma.optionLinkedPart.update({
      where: { id: partId },
      data: {
        quantity: quantity !== undefined && quantity !== null && quantity !== '' ? parseFloat(quantity) : 1
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
            partType: true,
            addFinishToPartNumber: true,
            addToPackingList: true
          }
        }
      }
    })

    return NextResponse.json(updatedPart)
  } catch (error) {
    console.error('Error updating option linked part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a linked part from an option
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const optionId = parseInt(resolvedParams.id)

    if (isNaN(optionId)) {
      return NextResponse.json({ error: 'Invalid option ID' }, { status: 400 })
    }

    // Get partId from query params
    const { searchParams } = new URL(request.url)
    const partId = parseInt(searchParams.get('partId') || '')

    if (isNaN(partId)) {
      return NextResponse.json({ error: 'Valid part ID is required' }, { status: 400 })
    }

    // Check if the linked part exists
    const existingPart = await prisma.optionLinkedPart.findFirst({
      where: {
        id: partId,
        optionId
      }
    })

    if (!existingPart) {
      return NextResponse.json({ error: 'Linked part not found' }, { status: 404 })
    }

    // Delete the part
    await prisma.optionLinkedPart.delete({
      where: { id: partId }
    })

    return NextResponse.json({ message: 'Linked part deleted successfully' })
  } catch (error) {
    console.error('Error deleting option linked part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

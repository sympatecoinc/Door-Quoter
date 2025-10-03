import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    const glassType = await prisma.glassType.findUnique({
      where: { id }
    })

    if (!glassType) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 })
    }

    return NextResponse.json(glassType)
  } catch (error) {
    console.error('Error fetching glass type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, pricePerSqFt } = body

    if (!name || !name.trim()) {
      return NextResponse.json({
        error: 'Glass type name is required'
      }, { status: 400 })
    }

    if (pricePerSqFt === undefined || pricePerSqFt === null || isNaN(parseFloat(pricePerSqFt.toString()))) {
      return NextResponse.json({
        error: 'Valid price per square foot is required'
      }, { status: 400 })
    }

    // Check if glass type exists
    const existingGlassType = await prisma.glassType.findUnique({
      where: { id }
    })

    if (!existingGlassType) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 })
    }

    // Check if new name conflicts with another glass type
    if (name.trim() !== existingGlassType.name) {
      const nameConflict = await prisma.glassType.findUnique({
        where: { name: name.trim() }
      })

      if (nameConflict) {
        return NextResponse.json({
          error: 'Glass type with this name already exists'
        }, { status: 409 })
      }
    }

    const updatedGlassType = await prisma.glassType.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pricePerSqFt: parseFloat(pricePerSqFt.toString())
      }
    })

    return NextResponse.json(updatedGlassType)
  } catch (error) {
    console.error('Error updating glass type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid glass type ID' }, { status: 400 })
    }

    // Check if glass type exists
    const existingGlassType = await prisma.glassType.findUnique({
      where: { id }
    })

    if (!existingGlassType) {
      return NextResponse.json({ error: 'Glass type not found' }, { status: 404 })
    }

    await prisma.glassType.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Glass type deleted successfully' })
  } catch (error) {
    console.error('Error deleting glass type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

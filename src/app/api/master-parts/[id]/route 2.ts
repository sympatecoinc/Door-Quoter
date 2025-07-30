import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const part = await prisma.masterPart.findUnique({
      where: { id }
    })

    if (!part) {
      return NextResponse.json({ error: 'Master part not found' }, { status: 404 })
    }

    return NextResponse.json(part)
  } catch (error) {
    console.error('Error fetching master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    const body = await request.json()
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const { partNumber, baseName, description, unit, cost, partType, orientation, isOption } = body

    if (!partNumber || !baseName) {
      return NextResponse.json({ 
        error: 'Part number and base name are required' 
      }, { status: 400 })
    }

    // Prevent glass from being created as a master part
    if (partType === 'Glass') {
      return NextResponse.json({ 
        error: 'Glass cannot be created as a master part as it is not a stocked item' 
      }, { status: 400 })
    }

    // Check if part number already exists on another part
    const existingPart = await prisma.masterPart.findFirst({
      where: { 
        partNumber,
        id: { not: id }
      }
    })

    if (existingPart) {
      return NextResponse.json({ 
        error: 'Part number already exists on another part' 
      }, { status: 409 })
    }

    // Get the old part number before updating
    const oldPart = await prisma.masterPart.findUnique({
      where: { id },
      select: { partNumber: true }
    })

    const updatedPart = await prisma.masterPart.update({
      where: { id },
      data: {
        partNumber,
        baseName,
        description,
        unit: (partType === 'Extrusion') ? 'IN' : unit, // Always set unit to 'IN' for extrusions
        cost: (partType === 'Extrusion') ? null : (cost ? parseFloat(cost) : null),
        partType: partType || 'Hardware',
        orientation: (partType === 'Extrusion') ? orientation : null,
        isOption: (partType === 'Hardware') ? (isOption || false) : false // Only hardware can be options
      }
    })

    // Update related ProductBOMs with the new cost and part data
    if (oldPart && oldPart.partNumber) {
      // Update related ProductBOMs with new data
      const updateData: any = {
        partNumber: partNumber,
        partName: baseName
      }
      
      // Only update cost for non-extrusion parts
      if (cost && partType !== 'Extrusion') {
        updateData.cost = parseFloat(cost)
      }
      
      await prisma.productBOM.updateMany({
        where: { 
          partNumber: oldPart.partNumber
        },
        data: updateData
      })
    }

    return NextResponse.json(updatedPart)
  } catch (error) {
    console.error('Error updating master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.masterPart.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Master part deleted successfully' })
  } catch (error) {
    console.error('Error deleting master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
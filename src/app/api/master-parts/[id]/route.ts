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

    const { partNumber, baseName, description, unit, cost, weightPerUnit, weightPerFoot, partType, isOption, addFinishToPartNumber, addToPackingList } = body

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

    // Validate cost requirements: Hardware, Fastener, and Packaging parts require cost, Extrusions don't
    if (partType === 'Hardware' || partType === 'Fastener' || partType === 'Packaging') {
      if (!cost || isNaN(parseFloat(cost.toString()))) {
        return NextResponse.json({
          error: `${partType} parts require a valid cost`
        }, { status: 400 })
      }
      // Validate weight if provided
      if (weightPerUnit && isNaN(parseFloat(weightPerUnit.toString()))) {
        return NextResponse.json({
          error: 'Weight must be a valid number'
        }, { status: 400 })
      }
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
        weightPerUnit: ((partType === 'Hardware' || partType === 'Fastener' || partType === 'Packaging') && weightPerUnit) ? parseFloat(weightPerUnit) : null,
        weightPerFoot: (partType === 'Extrusion' && weightPerFoot) ? parseFloat(weightPerFoot) : null,
        partType: partType || 'Hardware',
        isOption: (partType === 'Hardware') ? (isOption || false) : false, // Only hardware can be options
        addFinishToPartNumber: (partType === 'Hardware') ? (addFinishToPartNumber || false) : false,
        addToPackingList: (partType === 'Hardware') ? (addToPackingList || false) : false
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

    // Automatically sync related IndividualOptions if this is an option part
    if (updatedPart.isOption && updatedPart.partType === 'Hardware') {
      try {
        // Find all IndividualOptions that match by partNumber or description pattern
        const descriptionPattern = `${updatedPart.partNumber} - `

        const relatedOptions = await prisma.individualOption.findMany({
          where: {
            OR: [
              { partNumber: updatedPart.partNumber },
              { partNumber: oldPart?.partNumber }, // Match old part number if changed
              { description: { startsWith: descriptionPattern } }
            ]
          }
        })

        // Update each related option with current master part data
        if (relatedOptions.length > 0) {
          await Promise.all(relatedOptions.map(option =>
            prisma.individualOption.update({
              where: { id: option.id },
              data: {
                name: updatedPart.baseName,
                description: `${updatedPart.partNumber} - ${updatedPart.baseName}`,
                price: updatedPart.cost || 0,
                partNumber: updatedPart.partNumber,
                addFinishToPartNumber: updatedPart.addFinishToPartNumber || false,
                addToPackingList: updatedPart.addToPackingList || false
              }
            })
          ))
        }
      } catch (syncError) {
        console.error('Error auto-syncing options:', syncError)
        // Don't fail the master part update if sync fails
      }
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

    // Get the master part to find its part number
    const masterPart = await prisma.masterPart.findUnique({
      where: { id }
    })

    if (!masterPart) {
      return NextResponse.json({ error: 'Master part not found' }, { status: 404 })
    }

    // Delete related IndividualOptions (category options) that match this part number
    await prisma.individualOption.deleteMany({
      where: {
        partNumber: masterPart.partNumber
      }
    })

    // Delete related ProductBOM entries that use this part number
    await prisma.productBOM.deleteMany({
      where: {
        partNumber: masterPart.partNumber
      }
    })

    // Delete the master part itself
    await prisma.masterPart.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Master part and all related records deleted successfully' })
  } catch (error) {
    console.error('Error deleting master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
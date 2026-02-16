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

    const { partNumber, baseName, description, unit, cost, weightPerUnit, weightPerFoot, perimeterInches, customPricePerLb, partType, isOption, isMillFinish, addFinishToPartNumber, appendDirectionToPartNumber, addToPackingList, pickListStation, includeInJambKit } = body

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

    // Validate weight if provided (cost is optional - managed in inventory)
    if (weightPerUnit && isNaN(parseFloat(weightPerUnit.toString()))) {
      return NextResponse.json({
        error: 'Weight must be a valid number'
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

    // Get the old part data before updating
    const oldPart = await prisma.masterPart.findUnique({
      where: { id },
      select: { partNumber: true, isMillFinish: true }
    })

    const switchingToMillFinish = partType === 'Extrusion' && isMillFinish && oldPart && !oldPart.isMillFinish

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
        perimeterInches: (partType === 'Extrusion' && perimeterInches !== undefined) ? (perimeterInches ? parseFloat(perimeterInches) : null) : undefined,
        customPricePerLb: (partType === 'Extrusion' && customPricePerLb !== undefined) ? (customPricePerLb ? parseFloat(customPricePerLb) : null) : undefined,
        partType: partType || 'Hardware',
        isOption: (partType === 'Hardware' || partType === 'Extrusion' || partType === 'CutStock') ? (isOption || false) : false,
        isMillFinish: (partType === 'Extrusion') ? (isMillFinish || false) : false,
        addFinishToPartNumber: (partType === 'Hardware') ? (addFinishToPartNumber || false) : false,
        appendDirectionToPartNumber: (partType === 'Hardware') ? (appendDirectionToPartNumber || false) : false,
        addToPackingList: (partType === 'Hardware') ? (addToPackingList || false) : false,
        pickListStation: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? (pickListStation || null) : null,
        includeInJambKit: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? (includeInJambKit || false) : false
      }
    })

    // Consolidate finished variants into mill finish when switching to isMillFinish
    if (switchingToMillFinish) {
      try {
        // Get all active variants with a finish (non-mill) for this part
        const finishedVariants = await prisma.extrusionVariant.findMany({
          where: {
            masterPartId: id,
            isActive: true,
            finishPricingId: { not: null }
          }
        })

        if (finishedVariants.length > 0) {
          // Group finished variants by stock length and sum inventory
          const inventoryByLength = new Map<number, { qtyOnHand: number; qtyReserved: number }>()
          for (const v of finishedVariants) {
            const existing = inventoryByLength.get(v.stockLength) || { qtyOnHand: 0, qtyReserved: 0 }
            existing.qtyOnHand += v.qtyOnHand
            existing.qtyReserved += v.qtyReserved
            inventoryByLength.set(v.stockLength, existing)
          }

          // For each length, upsert a mill finish variant with consolidated qty
          for (const [stockLength, totals] of inventoryByLength) {
            const existingMill = await prisma.extrusionVariant.findFirst({
              where: {
                masterPartId: id,
                stockLength,
                finishPricingId: null
              }
            })

            if (existingMill) {
              // Add consolidated inventory to existing mill variant
              await prisma.extrusionVariant.update({
                where: { id: existingMill.id },
                data: {
                  qtyOnHand: existingMill.qtyOnHand + totals.qtyOnHand,
                  qtyReserved: existingMill.qtyReserved + totals.qtyReserved,
                  isActive: true
                }
              })
            } else {
              // Create new mill finish variant with consolidated inventory
              await prisma.extrusionVariant.create({
                data: {
                  masterPartId: id,
                  stockLength,
                  finishPricingId: null,
                  qtyOnHand: totals.qtyOnHand,
                  qtyReserved: totals.qtyReserved
                }
              })
            }
          }

          // Deactivate all finished (non-mill) variants
          await prisma.extrusionVariant.updateMany({
            where: {
              masterPartId: id,
              isActive: true,
              finishPricingId: { not: null }
            },
            data: { isActive: false }
          })
        }
      } catch (consolidateError) {
        console.error('Error consolidating variants to mill finish:', consolidateError)
        // Don't fail the master part update if consolidation fails
      }
    }

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
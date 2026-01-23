import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const partNumber = searchParams.get('partNumber')
    const search = searchParams.get('search')
    const optionsOnly = searchParams.get('optionsOnly') === 'true'
    
    if (partNumber) {
      // Legacy support: Search for parts by partial part number match only
      const parts = await prisma.masterPart.findMany({
        where: {
          partNumber: {
            contains: partNumber,
            mode: 'insensitive'
          }
        },
        orderBy: { partNumber: 'asc' }
      })
      return NextResponse.json(parts)
    } else if (search) {
      // Enhanced search: Search across multiple fields
      const parts = await prisma.masterPart.findMany({
        where: {
          OR: [
            {
              partNumber: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              baseName: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              partType: {
                contains: search,
                mode: 'insensitive'
              }
            }
          ]
        },
        orderBy: { partNumber: 'asc' }
      })
      return NextResponse.json(parts)
    } else if (optionsOnly) {
      // Get parts marked as available for category options (Hardware, Extrusion, and CutStock types)
      const parts = await prisma.masterPart.findMany({
        where: {
          partType: { in: ['Hardware', 'Extrusion', 'CutStock'] },
          isOption: true
        },
        orderBy: { partNumber: 'asc' }
      })
      return NextResponse.json(parts)
    } else {
      // Get all master parts with both pricing rules and stock length rules for price range calculation
      const parts = await prisma.masterPart.findMany({
        include: {
          pricingRules: {
            select: {
              basePrice: true,
              isActive: true
            },
            where: {
              isActive: true
            }
          },
          stockLengthRules: {
            select: {
              basePrice: true,
              isActive: true
            },
            where: {
              isActive: true
            }
          }
        },
        orderBy: { partNumber: 'asc' }
      })
      return NextResponse.json(parts)
    }
  } catch (error) {
    console.error('Error fetching master parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { partNumber, baseName, description, unit, cost, weightPerUnit, weightPerFoot, perimeterInches, customPricePerLb, partType, isOption, addFinishToPartNumber, appendDirectionToPartNumber, addToPackingList, pickListStation, includeInJambKit } = body

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

    // Check if part number already exists
    const existingPart = await prisma.masterPart.findUnique({
      where: { partNumber }
    })

    if (existingPart) {
      return NextResponse.json({ 
        error: 'Part number already exists' 
      }, { status: 409 })
    }

    const newPart = await prisma.masterPart.create({
      data: {
        partNumber,
        baseName,
        description,
        unit: (partType === 'Extrusion') ? 'IN' : (unit || 'EA'), // Extrusions use 'IN', Hardware/Fastener default to 'EA'
        cost: (partType === 'Extrusion') ? null : (cost ? parseFloat(cost) : null),
        weightPerUnit: ((partType === 'Hardware' || partType === 'Fastener' || partType === 'Packaging') && weightPerUnit) ? parseFloat(weightPerUnit) : null,
        weightPerFoot: (partType === 'Extrusion' && weightPerFoot) ? parseFloat(weightPerFoot) : null,
        perimeterInches: (partType === 'Extrusion' && perimeterInches) ? parseFloat(perimeterInches) : null,
        customPricePerLb: (partType === 'Extrusion' && customPricePerLb) ? parseFloat(customPricePerLb) : null,
        partType: partType || 'Hardware',
        isOption: (partType === 'Hardware' || partType === 'Extrusion' || partType === 'CutStock') ? (isOption || false) : false,
        addFinishToPartNumber: (partType === 'Hardware') ? (addFinishToPartNumber || false) : false,
        appendDirectionToPartNumber: (partType === 'Hardware') ? (appendDirectionToPartNumber || false) : false,
        addToPackingList: (partType === 'Hardware') ? (addToPackingList || false) : false,
        pickListStation: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? (pickListStation || null) : null,
        includeInJambKit: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? (includeInJambKit || false) : false
      }
    })

    // Create inventory notification for the new part
    await prisma.inventoryNotification.create({
      data: {
        type: 'new_part_added',
        message: `New part ${newPart.partNumber} has been added`,
        masterPartId: newPart.id,
        actionType: 'setup_part'
      }
    })

    return NextResponse.json(newPart)
  } catch (error) {
    console.error('Error creating master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
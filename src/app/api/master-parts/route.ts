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
            contains: partNumber
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
                contains: search
              }
            },
            {
              baseName: {
                contains: search
              }
            },
            {
              description: {
                contains: search
              }
            },
            {
              partType: {
                contains: search
              }
            }
          ]
        },
        orderBy: { partNumber: 'asc' }
      })
      return NextResponse.json(parts)
    } else if (optionsOnly) {
      // Get only hardware parts marked as available for category options
      const parts = await prisma.masterPart.findMany({
        where: {
          partType: 'Hardware',
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
    const { partNumber, baseName, description, unit, cost, weightPerUnit, weightPerFoot, partType, isOption } = body

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

    // Validate cost requirements: Hardware parts require cost, Extrusions don't
    if (partType === 'Hardware') {
      if (!cost || isNaN(parseFloat(cost.toString()))) {
        return NextResponse.json({
          error: 'Hardware parts require a valid cost'
        }, { status: 400 })
      }
      // Validate weight if provided
      if (weightPerUnit && isNaN(parseFloat(weightPerUnit.toString()))) {
        return NextResponse.json({
          error: 'Weight must be a valid number'
        }, { status: 400 })
      }
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
        unit: (partType === 'Extrusion') ? 'IN' : unit, // Always set unit to 'IN' for extrusions
        cost: (partType === 'Extrusion') ? null : (cost ? parseFloat(cost) : null),
        weightPerUnit: (partType === 'Hardware' && weightPerUnit) ? parseFloat(weightPerUnit) : null,
        weightPerFoot: (partType === 'Extrusion' && weightPerFoot) ? parseFloat(weightPerFoot) : null,
        partType: partType || 'Hardware',
        isOption: (partType === 'Hardware') ? (isOption || false) : false // Only hardware can be options
      }
    })

    return NextResponse.json(newPart)
  } catch (error) {
    console.error('Error creating master part:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
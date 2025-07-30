import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const masterPartId = searchParams.get('masterPartId')
    
    if (!masterPartId) {
      return NextResponse.json({ error: 'masterPartId is required' }, { status: 400 })
    }
    
    const rules = await prisma.pricingRule.findMany({
      where: { masterPartId: parseInt(masterPartId) },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true
          }
        }
      },
      orderBy: [
        { partType: 'asc' },
        { name: 'asc' }
      ]
    })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching pricing rules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      basePrice, 
      formula, 
      minQuantity, 
      maxQuantity, 
      partType, 
      category, 
      isActive,
      masterPartId
    } = body

    if (!name || !masterPartId) {
      return NextResponse.json({ 
        error: 'Name and master part ID are required' 
      }, { status: 400 })
    }

    const newRule = await prisma.pricingRule.create({
      data: {
        name,
        description,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        formula,
        minQuantity: minQuantity ? parseFloat(minQuantity) : null,
        maxQuantity: maxQuantity ? parseFloat(maxQuantity) : null,
        partType: partType || 'Extrusion', // Default to Extrusion since Hardware parts don't use pricing rules
        category,
        isActive: isActive !== false,
        masterPartId: parseInt(masterPartId)
      },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true
          }
        }
      }
    })

    return NextResponse.json(newRule)
  } catch (error) {
    console.error('Error creating pricing rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
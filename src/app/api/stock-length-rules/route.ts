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
    
    const rules = await prisma.stockLengthRule.findMany({
      where: { masterPartId: parseInt(masterPartId) },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            unit: true
          }
        }
      },
      orderBy: [
        { appliesTo: 'asc' },
        { minHeight: 'asc' }
      ]
    })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching stock length rules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      minHeight,
      maxHeight,
      stockLength,
      appliesTo,
      partType,
      isActive,
      basePrice,
      weightPerFoot,
      masterPartId
    } = body

    if (!name || !masterPartId) {
      return NextResponse.json({
        error: 'Name and master part ID are required'
      }, { status: 400 })
    }

    // Validate that stockLength is provided
    if (!stockLength) {
      return NextResponse.json({
        error: 'Stock length is required'
      }, { status: 400 })
    }

    // Validate pricing
    if (!basePrice) {
      return NextResponse.json({
        error: 'Base price is required'
      }, { status: 400 })
    }

    const newRule = await prisma.stockLengthRule.create({
      data: {
        name,
        minHeight: minHeight ? Number(minHeight) : null,
        maxHeight: maxHeight ? Number(maxHeight) : null,
        stockLength: stockLength ? Number(stockLength) : null,
        appliesTo: appliesTo || 'height',
        partType: partType || 'Extrusion',
        isActive: isActive !== false,
        basePrice: basePrice ? Number(basePrice) : null,
        weightPerFoot: weightPerFoot ? Number(weightPerFoot) : null,
        masterPartId: Number(masterPartId)
      },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            unit: true
          }
        }
      }
    })

    return NextResponse.json(newRule)
  } catch (error) {
    console.error('Error creating stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
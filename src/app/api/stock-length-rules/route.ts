import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Auto-create ExtrusionVariants for inventory tracking
    const stockLengthValue = Number(stockLength)
    const masterPartIdValue = Number(masterPartId)

    // Check if master part is mill finish only
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartIdValue },
      select: { isMillFinish: true }
    })

    // Create Mill finish variant (finishPricingId: null) if it doesn't exist
    const existingMillVariant = await prisma.extrusionVariant.findFirst({
      where: {
        masterPartId: masterPartIdValue,
        stockLength: stockLengthValue,
        finishPricingId: null
      }
    })

    if (!existingMillVariant) {
      await prisma.extrusionVariant.create({
        data: {
          masterPartId: masterPartIdValue,
          stockLength: stockLengthValue,
          finishPricingId: null,
          qtyOnHand: 0,
          isActive: true
        }
      })
    }

    // Only create color variants if the part is NOT mill finish only
    if (!masterPart?.isMillFinish) {
      const activeFinishes = await prisma.extrusionFinishPricing.findMany({
        where: { isActive: true },
        select: { id: true }
      })

      for (const finish of activeFinishes) {
        const existingVariant = await prisma.extrusionVariant.findFirst({
          where: {
            masterPartId: masterPartIdValue,
            stockLength: stockLengthValue,
            finishPricingId: finish.id
          }
        })

        if (!existingVariant) {
          await prisma.extrusionVariant.create({
            data: {
              masterPartId: masterPartIdValue,
              stockLength: stockLengthValue,
              finishPricingId: finish.id,
              qtyOnHand: 0,
              isActive: true
            }
          })
        }
      }
    }

    return NextResponse.json(newRule)
  } catch (error) {
    console.error('Error creating stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
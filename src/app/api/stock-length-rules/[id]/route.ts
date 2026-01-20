import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const rule = await prisma.stockLengthRule.findUnique({
      where: { id },
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

    if (!rule) {
      return NextResponse.json({ error: 'Stock length rule not found' }, { status: 404 })
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)
    const body = await request.json()

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

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

    if (!name) {
      return NextResponse.json({
        error: 'Name is required'
      }, { status: 400 })
    }

    // Validate that stockLength is provided
    if (!stockLength) {
      return NextResponse.json({
        error: 'Stock length is required'
      }, { status: 400 })
    }

    // Get old rule to check if stockLength changed
    const oldRule = await prisma.stockLengthRule.findUnique({
      where: { id }
    })

    const updatedRule = await prisma.stockLengthRule.update({
      where: { id },
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

    // Sync ExtrusionVariant if stockLength changed
    const newStockLength = Number(stockLength)
    const masterPartIdValue = Number(masterPartId)

    if (oldRule && oldRule.stockLength !== newStockLength) {
      // Update old variant's stockLength to new value (if it exists)
      const oldVariant = await prisma.extrusionVariant.findUnique({
        where: {
          masterPartId_stockLength_finishPricingId: {
            masterPartId: oldRule.masterPartId,
            stockLength: oldRule.stockLength!,
            finishPricingId: null as any
          }
        }
      })

      if (oldVariant) {
        // Check if new stockLength variant already exists
        const newVariantExists = await prisma.extrusionVariant.findUnique({
          where: {
            masterPartId_stockLength_finishPricingId: {
              masterPartId: masterPartIdValue,
              stockLength: newStockLength,
              finishPricingId: null as any
            }
          }
        })

        if (!newVariantExists) {
          await prisma.extrusionVariant.update({
            where: { id: oldVariant.id },
            data: { stockLength: newStockLength }
          })
        }
      }
    } else if (!oldRule?.stockLength) {
      // Create variant if it doesn't exist
      const existingVariant = await prisma.extrusionVariant.findUnique({
        where: {
          masterPartId_stockLength_finishPricingId: {
            masterPartId: masterPartIdValue,
            stockLength: newStockLength,
            finishPricingId: null as any
          }
        }
      })

      if (!existingVariant) {
        await prisma.extrusionVariant.create({
          data: {
            masterPartId: masterPartIdValue,
            stockLength: newStockLength,
            finishPricingId: null,
            qtyOnHand: 0,
            isActive: true
          }
        })
      }
    }

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Get the rule first to find associated variant
    const rule = await prisma.stockLengthRule.findUnique({
      where: { id }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Stock length rule not found' }, { status: 404 })
    }

    // Check if there's inventory for this stock length
    if (rule.stockLength) {
      const variantsWithInventory = await prisma.extrusionVariant.findMany({
        where: {
          masterPartId: rule.masterPartId,
          stockLength: rule.stockLength,
          qtyOnHand: { gt: 0 }
        }
      })

      if (variantsWithInventory.length > 0) {
        const totalQty = variantsWithInventory.reduce((sum, v) => sum + v.qtyOnHand, 0)
        return NextResponse.json({
          error: `Cannot delete: ${totalQty} units still in inventory for this stock length. Set inventory to 0 first.`
        }, { status: 400 })
      }
    }

    // Delete the rule
    await prisma.stockLengthRule.delete({
      where: { id }
    })

    // Also delete the associated ExtrusionVariant (Mill finish only, qty should be 0)
    if (rule.stockLength) {
      await prisma.extrusionVariant.deleteMany({
        where: {
          masterPartId: rule.masterPartId,
          stockLength: rule.stockLength,
          finishPricingId: null
        }
      })
    }

    return NextResponse.json({ message: 'Stock length rule deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
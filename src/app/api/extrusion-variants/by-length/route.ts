import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE - Remove orphaned variants for a specific masterPartId and stockLength
// Only allowed if: no active rule exists AND all variants have qtyOnHand = 0
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const masterPartId = searchParams.get('masterPartId')
    const stockLength = searchParams.get('stockLength')

    if (!masterPartId || !stockLength) {
      return NextResponse.json(
        { error: 'masterPartId and stockLength are required' },
        { status: 400 }
      )
    }

    const masterPartIdNum = parseInt(masterPartId)
    const stockLengthNum = parseInt(stockLength)

    if (isNaN(masterPartIdNum) || isNaN(stockLengthNum)) {
      return NextResponse.json(
        { error: 'Invalid masterPartId or stockLength' },
        { status: 400 }
      )
    }

    // Check if there's an active rule for this length
    const activeRule = await prisma.stockLengthRule.findFirst({
      where: {
        masterPartId: masterPartIdNum,
        stockLength: stockLengthNum,
        isActive: true
      }
    })

    if (activeRule) {
      return NextResponse.json(
        { error: 'Cannot remove length with active stock length rule. Remove the rule in Master Parts first.' },
        { status: 400 }
      )
    }

    // Find all active variants at this length
    const variants = await prisma.extrusionVariant.findMany({
      where: {
        masterPartId: masterPartIdNum,
        stockLength: stockLengthNum,
        isActive: true
      }
    })

    if (variants.length === 0) {
      return NextResponse.json(
        { error: 'No orphaned variants found at this length' },
        { status: 404 }
      )
    }

    // Check if any variant has stock
    const hasStock = variants.some(v => v.qtyOnHand > 0)
    if (hasStock) {
      return NextResponse.json(
        { error: 'Cannot remove length with existing stock. Set quantities to 0 first.' },
        { status: 400 }
      )
    }

    // Soft delete all variants at this length
    const result = await prisma.extrusionVariant.updateMany({
      where: {
        masterPartId: masterPartIdNum,
        stockLength: stockLengthNum,
        isActive: true
      },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: `Removed ${result.count} orphaned variant(s) at ${stockLengthNum}" length`,
      variantsRemoved: result.count
    })
  } catch (error) {
    console.error('Error removing orphaned extrusion variants:', error)
    return NextResponse.json(
      { error: 'Failed to remove variants' },
      { status: 500 }
    )
  }
}

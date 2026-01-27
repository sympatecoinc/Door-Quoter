import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface AddLineRequest {
  masterPartId: number
  quantity: number
  notes?: string
}

// POST - Add a line to an existing draft PO
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const poId = parseInt(id, 10)

    if (isNaN(poId)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      )
    }

    const body: AddLineRequest = await request.json()
    const { masterPartId, quantity, notes } = body

    if (!masterPartId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Master part ID and positive quantity are required' },
        { status: 400 }
      )
    }

    // Get the existing PO
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        vendor: { select: { id: true, displayName: true } },
        lines: { orderBy: { lineNum: 'desc' }, take: 1 }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Only allow adding to Draft POs
    if (purchaseOrder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only add lines to Draft purchase orders' },
        { status: 400 }
      )
    }

    // Get the master part with pricing data
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId },
      select: {
        id: true,
        partNumber: true,
        baseName: true,
        description: true,
        partType: true,
        cost: true,
        weightPerFoot: true,
        customPricePerLb: true,
        quickbooksItem: true,
        extrusionVariants: {
          where: { isActive: true },
          orderBy: { stockLength: 'desc' },
          take: 1,
          select: {
            pricePerPiece: true,
            stockLength: true,
            finishPricing: {
              select: { finishType: true, finishCode: true }
            }
          }
        },
        pricingRules: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { basePrice: true }
        },
        stockLengthRules: {
          where: { isActive: true },
          orderBy: { stockLength: 'desc' },
          take: 1,
          select: { stockLength: true, basePrice: true }
        }
      }
    })

    if (!masterPart) {
      return NextResponse.json(
        { error: 'Master part not found' },
        { status: 404 }
      )
    }

    // Calculate unit price using same logic as quick-create
    let unitPrice = 0
    const isExtrusion = masterPart.partType?.toLowerCase() === 'extrusion'

    // 1. First check masterPart.cost
    if (masterPart.cost && masterPart.cost > 0) {
      unitPrice = masterPart.cost
    }

    // 2. For extrusions, calculate price from weight and material price per lb
    if (isExtrusion && unitPrice === 0) {
      const weightPerFoot = masterPart.weightPerFoot
      const customPricePerLb = masterPart.customPricePerLb

      let stockLengthInches = 0
      if (masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
        stockLengthInches = masterPart.stockLengthRules[0].stockLength || 0
      } else if (masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        stockLengthInches = masterPart.extrusionVariants[0].stockLength || 0
      }

      if (weightPerFoot && weightPerFoot > 0 && stockLengthInches > 0) {
        const materialPricePerLbSetting = await prisma.globalSetting.findUnique({
          where: { key: 'materialPricePerLb' }
        })
        const globalPricePerLb = materialPricePerLbSetting
          ? parseFloat(materialPricePerLbSetting.value)
          : 1.5

        const pricePerLb = customPricePerLb ?? globalPricePerLb
        const basePricePerFoot = weightPerFoot * pricePerLb
        unitPrice = basePricePerFoot * (stockLengthInches / 12)
      }

      // Fallback to ExtrusionVariant.pricePerPiece
      if (unitPrice === 0 && masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        const variant = masterPart.extrusionVariants[0]
        if (variant.pricePerPiece && variant.pricePerPiece > 0) {
          unitPrice = variant.pricePerPiece
        }
      }

      // Fallback to stockLengthRule.basePrice
      if (unitPrice === 0 && masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
        const rule = masterPart.stockLengthRules[0]
        if (rule.basePrice && rule.basePrice > 0) {
          unitPrice = rule.basePrice
        }
      }
    }

    // 3. Check PricingRule.basePrice
    if (unitPrice === 0 && masterPart.pricingRules && masterPart.pricingRules.length > 0) {
      const rule = masterPart.pricingRules[0]
      if (rule.basePrice && rule.basePrice > 0) {
        unitPrice = rule.basePrice
      }
    }

    // Check for last PO price from this vendor
    const lastPOLine = await prisma.purchaseOrderLine.findFirst({
      where: {
        purchaseOrder: {
          vendorId: purchaseOrder.vendorId,
          status: { not: 'CANCELLED' }
        },
        OR: [
          { itemRefName: masterPart.partNumber },
          { description: { contains: masterPart.partNumber } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: { unitPrice: true }
    })

    if (lastPOLine && lastPOLine.unitPrice > 0) {
      unitPrice = lastPOLine.unitPrice
    }

    // Build description and itemRefName
    let lineDescription = `${masterPart.partNumber} - ${masterPart.description || masterPart.baseName}`
    let lineItemRefName = masterPart.partNumber

    if (isExtrusion) {
      // Get stock length
      let stockLengthInches = 0
      if (masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
        stockLengthInches = masterPart.stockLengthRules[0].stockLength || 0
      } else if (masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        stockLengthInches = masterPart.extrusionVariants[0].stockLength || 0
      }

      // Get finish code from extrusionVariant
      let finishCode = ''
      if (masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        const variant = masterPart.extrusionVariants[0]
        if (variant.finishPricing?.finishCode) {
          finishCode = variant.finishPricing.finishCode
        }
      }

      // Check if base part number already has finish suffix, extract it
      const partNumber = masterPart.partNumber
      const finishSuffixes = ['-BL', '-C2', '-AL', '-WH', '-BR', '-MF']
      let basePartNumber = partNumber
      for (const suffix of finishSuffixes) {
        if (partNumber.endsWith(suffix)) {
          basePartNumber = partNumber.slice(0, -suffix.length)
          if (!finishCode) {
            finishCode = suffix.slice(1) // Remove the leading dash
          }
          break
        }
      }

      // Build full part number: basePartNumber-finishCode-stockLength
      // e.g., 48349-BL-144
      const fullPartParts = [basePartNumber]
      if (finishCode) {
        fullPartParts.push(finishCode)
      }
      if (stockLengthInches > 0) {
        fullPartParts.push(String(stockLengthInches))
      }
      lineItemRefName = fullPartParts.join('-')

      // Build description: Base Description - Full Part#
      const baseDescription = masterPart.description || masterPart.baseName
      lineDescription = `${baseDescription} - ${lineItemRefName}`
    }

    // Get next line number
    const nextLineNum = (purchaseOrder.lines[0]?.lineNum || 0) + 1

    // Calculate amount
    const amount = quantity * unitPrice

    // Add the line and update totals in a transaction
    const [newLine, updatedPO] = await prisma.$transaction([
      prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: poId,
          lineNum: nextLineNum,
          quickbooksItemId: masterPart.quickbooksItem?.id || null,
          itemRefId: masterPart.quickbooksItem?.quickbooksId || null,
          itemRefName: lineItemRefName,
          description: lineDescription,
          quantity,
          unitPrice,
          amount,
          quantityReceived: 0,
          quantityRemaining: quantity,
          notes: notes || null
        }
      }),
      prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          subtotal: { increment: amount },
          totalAmount: { increment: amount },
          memo: notes
            ? `${purchaseOrder.memo || ''}\n${notes}`.trim()
            : purchaseOrder.memo
        },
        include: {
          vendor: { select: { displayName: true } }
        }
      })
    ])

    return NextResponse.json({
      purchaseOrder: {
        id: updatedPO.id,
        poNumber: updatedPO.poNumber,
        vendorId: updatedPO.vendorId,
        vendorName: updatedPO.vendor.displayName,
        status: updatedPO.status,
        totalAmount: updatedPO.totalAmount
      },
      addedLine: {
        id: newLine.id,
        partNumber: lineItemRefName,
        quantity: newLine.quantity,
        unitPrice: newLine.unitPrice,
        amount: newLine.amount
      }
    })
  } catch (error) {
    console.error('Error adding line to PO:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add line to purchase order' },
      { status: 500 }
    )
  }
}

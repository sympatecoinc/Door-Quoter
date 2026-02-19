import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  generatePONumber,
  getStoredRealmId,
  pushVendorToQB,
  createQBPurchaseOrder,
  localPOToQB,
  localPOLineToQB,
  getDefaultExpenseAccount,
  createQBItemForPOLine,
  QBPOLine
} from '@/lib/quickbooks'
import type { QuickPORequest, QuickPOResponse } from '@/components/purchasing-dashboard/types'

// POST - Quick create a purchase order from inventory alert
export async function POST(request: NextRequest) {
  try {
    const body: QuickPORequest = await request.json()
    const { masterPartId, quantity, vendorId, notes, variantId } = body

    if (!masterPartId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Master part ID and positive quantity are required' },
        { status: 400 }
      )
    }

    // Get the master part with vendor info, extrusion data, and pricing rules
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
        vendorId: true,
        vendor: true,
        quickbooksItem: true,
        extrusionVariants: {
          where: variantId ? { id: variantId } : { isActive: true },
          orderBy: variantId ? undefined : { stockLength: 'desc' as const },
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

    // Determine vendor: use provided vendorId, or fall back to part's preferred vendor
    const finalVendorId = vendorId || masterPart.vendorId

    if (!finalVendorId) {
      return NextResponse.json(
        { error: 'No vendor specified and part has no preferred vendor' },
        { status: 400 }
      )
    }

    // Get the vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: finalVendorId }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // Look up unit price - check multiple sources in priority order
    let unitPrice = 0
    const isExtrusion = masterPart.partType?.toLowerCase() === 'extrusion'

    // Debug: log all available pricing data
    console.log(`[Quick PO] Pricing data for ${masterPart.partNumber}:`, {
      partType: masterPart.partType,
      isExtrusion,
      cost: masterPart.cost,
      weightPerFoot: masterPart.weightPerFoot,
      customPricePerLb: masterPart.customPricePerLb,
      stockLengthRulesCount: masterPart.stockLengthRules?.length || 0,
      stockLengthRules: masterPart.stockLengthRules,
      extrusionVariantsCount: masterPart.extrusionVariants?.length || 0,
      extrusionVariants: masterPart.extrusionVariants,
      pricingRulesCount: masterPart.pricingRules?.length || 0
    })

    // 1. First check masterPart.cost
    if (masterPart.cost && masterPart.cost > 0) {
      unitPrice = masterPart.cost
      console.log(`[Quick PO] Using masterPart.cost: $${unitPrice} for ${masterPart.partNumber}`)
    }

    // 2. For extrusions, calculate price from weight and material price per lb
    if (isExtrusion && unitPrice === 0) {
      const weightPerFoot = masterPart.weightPerFoot
      const customPricePerLb = masterPart.customPricePerLb

      // Get stock length from stockLengthRules or extrusionVariants
      let stockLengthInches = 0
      if (masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
        stockLengthInches = masterPart.stockLengthRules[0].stockLength || 0
      } else if (masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        stockLengthInches = masterPart.extrusionVariants[0].stockLength || 0
      }

      if (weightPerFoot && weightPerFoot > 0 && stockLengthInches > 0) {
        // Get global material price per lb
        const materialPricePerLbSetting = await prisma.globalSetting.findUnique({
          where: { key: 'materialPricePerLb' }
        })
        const globalPricePerLb = materialPricePerLbSetting
          ? parseFloat(materialPricePerLbSetting.value)
          : 1.5 // Default fallback

        const pricePerLb = customPricePerLb ?? globalPricePerLb
        const basePricePerFoot = weightPerFoot * pricePerLb
        unitPrice = basePricePerFoot * (stockLengthInches / 12)

        console.log(`[Quick PO] Calculated extrusion price: weightPerFoot=${weightPerFoot}, pricePerLb=${pricePerLb}, stockLength=${stockLengthInches}" => $${unitPrice.toFixed(2)} for ${masterPart.partNumber}`)
      }

      // Fallback to ExtrusionVariant.pricePerPiece if calculation didn't work
      if (unitPrice === 0 && masterPart.extrusionVariants && masterPart.extrusionVariants.length > 0) {
        const variant = masterPart.extrusionVariants[0]
        if (variant.pricePerPiece && variant.pricePerPiece > 0) {
          unitPrice = variant.pricePerPiece
          console.log(`[Quick PO] Using extrusion variant pricePerPiece: $${unitPrice} for ${masterPart.partNumber}`)
        }
      }

      // Fallback to stockLengthRule.basePrice
      if (unitPrice === 0 && masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
        const rule = masterPart.stockLengthRules[0]
        if (rule.basePrice && rule.basePrice > 0) {
          unitPrice = rule.basePrice
          console.log(`[Quick PO] Using stockLengthRule basePrice: $${unitPrice} for ${masterPart.partNumber}`)
        }
      }
    }

    // 3. Check PricingRule.basePrice
    if (unitPrice === 0 && masterPart.pricingRules && masterPart.pricingRules.length > 0) {
      const rule = masterPart.pricingRules[0]
      if (rule.basePrice && rule.basePrice > 0) {
        unitPrice = rule.basePrice
        console.log(`[Quick PO] Using pricing rule basePrice: $${unitPrice} for ${masterPart.partNumber}`)
      }
    }

    if (unitPrice === 0) {
      console.log(`[Quick PO] WARNING: No price found for ${masterPart.partNumber} (partType: ${masterPart.partType})`)
    } else {
      console.log(`[Quick PO] Final unitPrice: $${unitPrice.toFixed(2)} for ${masterPart.partNumber}`)
    }

    // Check for last PO price from this vendor (overrides default cost)
    const lastPOLine = await prisma.purchaseOrderLine.findFirst({
      where: {
        purchaseOrder: {
          vendorId: finalVendorId,
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

    // Generate PO number
    const poNumber = await generatePONumber()

    // Calculate amounts
    const amount = quantity * unitPrice
    const subtotal = amount

    // Build memo with context
    const memo = notes || `Quick PO for ${masterPart.partNumber} from inventory alert`

    // Build description and itemRefName for the PO line
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

    // Create the purchase order
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: finalVendorId,
        status: 'DRAFT',
        txnDate: new Date(),
        memo,
        subtotal,
        totalAmount: subtotal,
        lines: {
          create: [{
            lineNum: 1,
            quickbooksItemId: masterPart.quickbooksItem?.id || null,
            itemRefId: masterPart.quickbooksItem?.quickbooksId || null,
            itemRefName: lineItemRefName,
            description: lineDescription,
            quantity,
            unitPrice,
            amount,
            quantityReceived: 0,
            quantityRemaining: quantity
          }]
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'DRAFT',
            notes: 'Quick PO created from inventory alert'
          }
        }
      },
      include: {
        vendor: {
          select: {
            displayName: true
          }
        }
      }
    })

    // Push to QuickBooks
    let qbWarning: string | undefined
    const realmId = await getStoredRealmId()
    if (realmId) {
      try {
        // Auto-push vendor to QuickBooks if it doesn't have a QB ID
        let vendorQBId = vendor.quickbooksId
        if (!vendorQBId) {
          console.log(`[Quick PO] Vendor "${vendor.displayName}" not synced to QB - pushing now...`)
          const syncedVendor = await pushVendorToQB(vendor.id)
          vendorQBId = syncedVendor.quickbooksId
          console.log(`[Quick PO] Vendor synced to QB with ID: ${vendorQBId}`)
        }

        // Get default expense account for lines without items
        const defaultExpenseAccountId = await getDefaultExpenseAccount(realmId)

        // Get the PO with lines for QB conversion
        const poWithLines = await prisma.purchaseOrder.findUnique({
          where: { id: purchaseOrder.id },
          include: {
            lines: { include: { quickbooksItem: true } }
          }
        })

        if (poWithLines) {
          // Create QB items on-the-fly for lines without item references
          for (const line of poWithLines.lines) {
            const hasQBItem = line.quickbooksItem?.quickbooksId || line.itemRefId
            if (!hasQBItem && line.description) {
              try {
                console.log(`[Quick PO] Creating QB item for line: "${line.description}"`)
                const { qbItemId, localItemId } = await createQBItemForPOLine(
                  realmId,
                  line.description,
                  line.unitPrice
                )

                // Update the local line with the new item reference
                await prisma.purchaseOrderLine.update({
                  where: { id: line.id },
                  data: {
                    quickbooksItemId: localItemId,
                    itemRefId: qbItemId,
                    itemRefName: line.description
                  }
                })

                // Update the in-memory line object for QB conversion
                line.itemRefId = qbItemId
                line.itemRefName = line.description
              } catch (itemError) {
                console.error(`[Quick PO] Failed to create QB item:`, itemError)
              }
            }
          }

          // Refresh lines after updates
          const refreshedPO = await prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrder.id },
            include: { lines: { include: { quickbooksItem: true } } }
          })

          if (refreshedPO) {
            // Convert lines to QB format
            const qbLines: QBPOLine[] = refreshedPO.lines.map(line => {
              return localPOLineToQB({
                itemRefId: line.quickbooksItem?.quickbooksId || line.itemRefId,
                itemRefName: line.quickbooksItem?.name || line.itemRefName,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                amount: line.amount
              }, defaultExpenseAccountId || undefined)
            })

            // Create QB PO
            const qbPO = localPOToQB(refreshedPO, vendorQBId!, qbLines)
            qbPO.DocNumber = poNumber

            const createdQBPO = await createQBPurchaseOrder(realmId, qbPO)

            // Update local PO with QB data
            await prisma.purchaseOrder.update({
              where: { id: purchaseOrder.id },
              data: {
                quickbooksId: createdQBPO.Id,
                syncToken: createdQBPO.SyncToken,
                docNumber: createdQBPO.DocNumber,
                totalAmount: createdQBPO.TotalAmt ?? subtotal,
                lastSyncedAt: new Date()
              }
            })

            console.log(`[Quick PO] PO ${poNumber} synced to QuickBooks with ID: ${createdQBPO.Id}`)
          }
        }
      } catch (qbError) {
        console.error('[Quick PO] Failed to push PO to QuickBooks:', qbError)
        qbWarning = `Purchase order created locally but failed to sync to QuickBooks. Error: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    const response: QuickPOResponse = {
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vendorId: purchaseOrder.vendorId,
        vendorName: purchaseOrder.vendor.displayName,
        status: purchaseOrder.status,
        totalAmount: purchaseOrder.totalAmount
      },
      warning: qbWarning
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating quick PO:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePONumber } from '@/lib/quickbooks'
import type { QuickPORequest, QuickPOResponse } from '@/components/purchasing-dashboard/types'

// POST - Quick create a purchase order from inventory alert
export async function POST(request: NextRequest) {
  try {
    const body: QuickPORequest = await request.json()
    const { masterPartId, quantity, vendorId, notes } = body

    if (!masterPartId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Master part ID and positive quantity are required' },
        { status: 400 }
      )
    }

    // Get the master part with vendor info
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId },
      include: {
        vendor: true,
        quickbooksItem: true
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

    // Look up last unit price from previous POs for this part and vendor
    let unitPrice = masterPart.cost || 0

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
            itemRefName: masterPart.partNumber,
            description: masterPart.description || masterPart.baseName,
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

    const response: QuickPOResponse = {
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vendorId: purchaseOrder.vendorId,
        vendorName: purchaseOrder.vendor.displayName,
        status: purchaseOrder.status,
        totalAmount: purchaseOrder.totalAmount
      }
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

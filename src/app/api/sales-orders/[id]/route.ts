import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { releaseInventory } from '@/lib/sales-order-parts'

// GET - Get single sales order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const salesOrderId = parseInt(id)

    if (isNaN(salesOrderId)) {
      return NextResponse.json({ error: 'Invalid sales order ID' }, { status: 400 })
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            quickbooksId: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        lines: {
          orderBy: { lineNum: 'asc' }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    return NextResponse.json(salesOrder)
  } catch (error) {
    console.error('Error fetching sales order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales order' },
      { status: 500 }
    )
  }
}

// PUT - Update sales order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const salesOrderId = parseInt(id)

    if (isNaN(salesOrderId)) {
      return NextResponse.json({ error: 'Invalid sales order ID' }, { status: 400 })
    }

    const existingSO = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { customer: true }
    })

    if (!existingSO) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      customerId,
      txnDate,
      dueDate,
      shipDate,
      customerMemo,
      privateNote,
      billAddrLine1,
      billAddrLine2,
      billAddrCity,
      billAddrState,
      billAddrPostalCode,
      billAddrCountry,
      shipAddrLine1,
      shipAddrLine2,
      shipAddrCity,
      shipAddrState,
      shipAddrPostalCode,
      shipAddrCountry,
      lines
    } = body

    // Calculate totals
    let subtotal = 0
    const processedLines = lines?.map((line: any, index: number) => {
      const amount = line.quantity * line.unitPrice
      subtotal += amount
      return {
        lineNum: index + 1,
        itemRefId: line.itemRefId || null,
        itemRefName: line.itemRefName || null,
        description: line.description || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount
      }
    }) || []

    // Update sales order - delete old lines and create new ones
    const updatedSO = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.salesOrderLine.deleteMany({
        where: { salesOrderId }
      })

      // Update SO and create new lines
      return tx.salesOrder.update({
        where: { id: salesOrderId },
        data: {
          customerId: customerId || existingSO.customerId,
          txnDate: txnDate ? new Date(txnDate) : existingSO.txnDate,
          dueDate: dueDate ? new Date(dueDate) : null,
          shipDate: shipDate ? new Date(shipDate) : null,
          customerMemo: customerMemo ?? existingSO.customerMemo,
          privateNote: privateNote ?? existingSO.privateNote,
          billAddrLine1: billAddrLine1 ?? existingSO.billAddrLine1,
          billAddrLine2: billAddrLine2 ?? existingSO.billAddrLine2,
          billAddrCity: billAddrCity ?? existingSO.billAddrCity,
          billAddrState: billAddrState ?? existingSO.billAddrState,
          billAddrPostalCode: billAddrPostalCode ?? existingSO.billAddrPostalCode,
          billAddrCountry: billAddrCountry ?? existingSO.billAddrCountry,
          shipAddrLine1: shipAddrLine1 ?? existingSO.shipAddrLine1,
          shipAddrLine2: shipAddrLine2 ?? existingSO.shipAddrLine2,
          shipAddrCity: shipAddrCity ?? existingSO.shipAddrCity,
          shipAddrState: shipAddrState ?? existingSO.shipAddrState,
          shipAddrPostalCode: shipAddrPostalCode ?? existingSO.shipAddrPostalCode,
          shipAddrCountry: shipAddrCountry ?? existingSO.shipAddrCountry,
          subtotal,
          totalAmount: subtotal,
          lines: {
            create: processedLines
          }
        },
        include: {
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
              phone: true,
              quickbooksId: true
            }
          },
          project: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          lines: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    })

    return NextResponse.json({ salesOrder: updatedSO })
  } catch (error) {
    console.error('Error updating sales order:', error)
    return NextResponse.json(
      { error: 'Failed to update sales order' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel sales order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const salesOrderId = parseInt(id)

    if (isNaN(salesOrderId)) {
      return NextResponse.json({ error: 'Invalid sales order ID' }, { status: 400 })
    }

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: {
        invoices: {
          where: {
            status: { notIn: ['VOIDED'] }
          }
        }
      }
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Check if there are active invoices
    if (salesOrder.invoices.length > 0) {
      return NextResponse.json(
        { error: 'Cannot cancel sales order with active invoices. Void the invoices first.' },
        { status: 400 }
      )
    }

    // Check for in-flight parts — block if any have entered fulfillment
    const inFlightCount = await prisma.salesOrderPart.count({
      where: {
        salesOrderId,
        status: { in: ['PICKED', 'PACKED', 'SHIPPED'] }
      }
    })

    if (inFlightCount > 0) {
      return NextResponse.json(
        { error: `Cannot cancel — ${inFlightCount} part(s) have entered fulfillment (picked/packed/shipped). Handle these parts before cancelling.` },
        { status: 400 }
      )
    }

    // Release inventory reservations and cancel in a transaction
    await prisma.$transaction(async (tx) => {
      await releaseInventory(salesOrderId, tx)

      await tx.salesOrder.update({
        where: { id: salesOrderId },
        data: { status: 'CANCELLED' }
      })
    })

    // If sales order is synced to QuickBooks, void the Estimate in QB (non-blocking)
    let qbWarning: string | null = null
    if (salesOrder.quickbooksId) {
      try {
        const { getStoredRealmId, getQBEstimate, voidQBEstimate } = await import('@/lib/quickbooks')
        const realmId = await getStoredRealmId()
        if (realmId) {
          const qbEstimate = await getQBEstimate(realmId, salesOrder.quickbooksId)
          await voidQBEstimate(realmId, salesOrder.quickbooksId, qbEstimate.SyncToken!)
          console.log(`[QB Sync] Voided estimate ${salesOrder.orderNumber} in QuickBooks`)
        }
      } catch (qbError) {
        console.error(`[QB Sync] Failed to void estimate ${salesOrder.orderNumber} in QB:`, qbError)
        qbWarning = `Sales order cancelled locally but QuickBooks void failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    return NextResponse.json({
      success: true,
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error cancelling sales order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel sales order' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  updateQBInvoice,
  voidQBInvoice,
  fetchQBInvoice,
  localSOToQBInvoice,
  localSOLineToQB,
  QBInvoiceLine
} from '@/lib/quickbooks'

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
      lines,
      pushToQuickBooks
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

    // Push to QuickBooks if requested
    let qbWarning: string | null = null
    if (pushToQuickBooks && updatedSO.quickbooksId) {
      try {
        const realmId = await getStoredRealmId()
        if (!realmId) {
          qbWarning = 'QuickBooks not connected. Changes saved locally only.'
        } else if (!updatedSO.customer.quickbooksId) {
          qbWarning = 'Customer not synced to QuickBooks. Changes saved locally only.'
        } else {
          // Get current QB invoice for sync token
          const currentQBInvoice = await fetchQBInvoice(realmId, updatedSO.quickbooksId)

          // Convert lines to QB format
          const qbLines: QBInvoiceLine[] = updatedSO.lines.map(line => localSOLineToQB(line))

          // Build update object
          const qbInvoice = localSOToQBInvoice(updatedSO, updatedSO.customer.quickbooksId, qbLines)
          qbInvoice.Id = currentQBInvoice.Id
          qbInvoice.SyncToken = currentQBInvoice.SyncToken
          qbInvoice.sparse = true

          const updated = await updateQBInvoice(realmId, qbInvoice)

          // Update local sync info
          await prisma.salesOrder.update({
            where: { id: salesOrderId },
            data: {
              syncToken: updated.SyncToken,
              lastSyncedAt: new Date()
            }
          })
        }
      } catch (qbError) {
        console.error('QuickBooks sync error:', qbError)
        qbWarning = `Changes saved locally but QuickBooks sync failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Fetch final state
    const finalSO = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
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

    return NextResponse.json({
      salesOrder: finalSO,
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error updating sales order:', error)
    return NextResponse.json(
      { error: 'Failed to update sales order' },
      { status: 500 }
    )
  }
}

// DELETE - Void/delete sales order
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
      where: { id: salesOrderId }
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Void in QuickBooks if synced
    let qbWarning: string | null = null
    if (salesOrder.quickbooksId && salesOrder.syncToken) {
      try {
        const realmId = await getStoredRealmId()
        if (realmId) {
          await voidQBInvoice(realmId, salesOrder.quickbooksId, salesOrder.syncToken)
        }
      } catch (qbError) {
        console.error('QuickBooks void error:', qbError)
        qbWarning = `Sales order voided locally but QuickBooks void failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Update status to voided (soft delete)
    await prisma.salesOrder.update({
      where: { id: salesOrderId },
      data: { status: 'VOIDED' }
    })

    return NextResponse.json({
      success: true,
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error voiding sales order:', error)
    return NextResponse.json(
      { error: 'Failed to void sales order' },
      { status: 500 }
    )
  }
}

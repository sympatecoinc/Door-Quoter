import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch single invoice with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoiceId = parseInt(id)

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            projectId: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
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

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
      { status: 500 }
    )
  }
}

// PUT - Update invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoiceId = parseInt(id)

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
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

    // Get current invoice
    const currentInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, lines: true }
    })

    if (!currentInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Calculate totals from lines
    let subtotal = 0
    const processedLines = lines.map((line: any, index: number) => {
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
    })

    // Update invoice with lines in a transaction
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Delete existing lines
      await tx.invoiceLine.deleteMany({
        where: { invoiceId }
      })

      // Update invoice and create new lines
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          txnDate: txnDate ? new Date(txnDate) : currentInvoice.txnDate,
          dueDate: dueDate ? new Date(dueDate) : currentInvoice.dueDate,
          shipDate: shipDate ? new Date(shipDate) : currentInvoice.shipDate,
          customerMemo: customerMemo ?? currentInvoice.customerMemo,
          privateNote: privateNote ?? currentInvoice.privateNote,
          billAddrLine1: billAddrLine1 ?? currentInvoice.billAddrLine1,
          billAddrLine2: billAddrLine2 ?? currentInvoice.billAddrLine2,
          billAddrCity: billAddrCity ?? currentInvoice.billAddrCity,
          billAddrState: billAddrState ?? currentInvoice.billAddrState,
          billAddrPostalCode: billAddrPostalCode ?? currentInvoice.billAddrPostalCode,
          billAddrCountry: billAddrCountry ?? currentInvoice.billAddrCountry,
          shipAddrLine1: shipAddrLine1 ?? currentInvoice.shipAddrLine1,
          shipAddrLine2: shipAddrLine2 ?? currentInvoice.shipAddrLine2,
          shipAddrCity: shipAddrCity ?? currentInvoice.shipAddrCity,
          shipAddrState: shipAddrState ?? currentInvoice.shipAddrState,
          shipAddrPostalCode: shipAddrPostalCode ?? currentInvoice.shipAddrPostalCode,
          shipAddrCountry: shipAddrCountry ?? currentInvoice.shipAddrCountry,
          subtotal,
          totalAmount: subtotal,
          balance: subtotal, // Balance will be updated by QB sync
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
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
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

    // Push to QuickBooks if requested and already synced
    let qbWarning: string | null = null
    if (pushToQuickBooks && currentInvoice.quickbooksId) {
      try {
        const { getStoredRealmId, updateQBInvoice, localInvoiceToQB, localInvoiceLineToQB, fetchQBInvoice } = await import('@/lib/quickbooks')
        const realmId = await getStoredRealmId()
        if (!realmId) {
          qbWarning = 'QuickBooks not connected. Invoice saved locally only.'
        } else if (!currentInvoice.customer.quickbooksId) {
          qbWarning = 'Customer not synced to QuickBooks.'
        } else {
          // Get current QB invoice for sync token
          const qbCurrentInvoice = await fetchQBInvoice(realmId, currentInvoice.quickbooksId)

          // Convert lines to QB format
          const qbLines = updatedInvoice.lines.map(line => localInvoiceLineToQB(line))

          // Create updated invoice object
          const qbInvoice = localInvoiceToQB(updatedInvoice, currentInvoice.customer.quickbooksId, qbLines)
          qbInvoice.Id = currentInvoice.quickbooksId
          qbInvoice.SyncToken = qbCurrentInvoice.SyncToken

          // Update in QB
          const savedInvoice = await updateQBInvoice(realmId, qbInvoice)

          // Update local with new sync token
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              syncToken: savedInvoice.SyncToken,
              lastSyncedAt: new Date()
            }
          })
        }
      } catch (qbError) {
        console.error('QuickBooks sync error:', qbError)
        qbWarning = `Invoice saved locally but QuickBooks sync failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Fetch final invoice
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
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
      invoice: finalInvoice,
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

// DELETE - Void invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const invoiceId = parseInt(id)

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Void in QuickBooks if synced
    let qbWarning: string | null = null
    if (invoice.quickbooksId) {
      try {
        const { getStoredRealmId, voidQBInvoice, fetchQBInvoice } = await import('@/lib/quickbooks')
        const realmId = await getStoredRealmId()
        if (realmId) {
          // Get current sync token
          const qbInvoice = await fetchQBInvoice(realmId, invoice.quickbooksId)
          await voidQBInvoice(realmId, invoice.quickbooksId, qbInvoice.SyncToken)
        }
      } catch (qbError) {
        console.error('QuickBooks void error:', qbError)
        qbWarning = `Invoice voided locally but QuickBooks void failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Update local invoice status to VOIDED
    const voidedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOIDED'
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true
          }
        }
      }
    })

    return NextResponse.json({
      invoice: voidedInvoice,
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error voiding invoice:', error)
    return NextResponse.json(
      { error: 'Failed to void invoice' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { generateInvoiceNumber, pushInvoiceToQB } from '@/lib/quickbooks'

// POST - Create an invoice from a sales order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const soId = parseInt(id)

    if (isNaN(soId)) {
      return NextResponse.json({ error: 'Invalid sales order ID' }, { status: 400 })
    }

    // Get session for createdBy tracking
    const sessionToken = await getSessionToken()
    let userId: number | null = null
    if (sessionToken) {
      const session = await getSessionWithUser(sessionToken)
      if (session?.user) {
        userId = session.user.id
      }
    }

    const body = await request.json()
    const { pushToQuickBooks = true } = body

    // Get the sales order with all details
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: soId },
      include: {
        customer: true,
        lines: {
          orderBy: { lineNum: 'asc' }
        }
      }
    })

    if (!salesOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Check if SO is in a valid status to invoice
    if (salesOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot create invoice for a cancelled sales order' },
        { status: 400 }
      )
    }

    if (salesOrder.status === 'FULLY_INVOICED') {
      return NextResponse.json(
        { error: 'Sales order is already fully invoiced' },
        { status: 400 }
      )
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber()

    // Copy line items from SO
    const invoiceLines = salesOrder.lines.map((line, index) => ({
      lineNum: index + 1,
      itemRefId: line.itemRefId,
      itemRefName: line.itemRefName,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount
    }))

    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: salesOrder.customerId,
        salesOrderId: soId,
        status: 'DRAFT',
        txnDate: new Date(),
        dueDate: salesOrder.dueDate,
        shipDate: salesOrder.shipDate,
        customerMemo: salesOrder.customerMemo,
        privateNote: salesOrder.privateNote,
        billAddrLine1: salesOrder.billAddrLine1,
        billAddrLine2: salesOrder.billAddrLine2,
        billAddrCity: salesOrder.billAddrCity,
        billAddrState: salesOrder.billAddrState,
        billAddrPostalCode: salesOrder.billAddrPostalCode,
        billAddrCountry: salesOrder.billAddrCountry,
        shipAddrLine1: salesOrder.shipAddrLine1,
        shipAddrLine2: salesOrder.shipAddrLine2,
        shipAddrCity: salesOrder.shipAddrCity,
        shipAddrState: salesOrder.shipAddrState,
        shipAddrPostalCode: salesOrder.shipAddrPostalCode,
        shipAddrCountry: salesOrder.shipAddrCountry,
        subtotal: salesOrder.subtotal,
        taxAmount: salesOrder.taxAmount,
        totalAmount: salesOrder.totalAmount,
        balance: salesOrder.totalAmount,
        createdById: userId,
        lines: {
          create: invoiceLines
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

    // Update sales order status
    await prisma.salesOrder.update({
      where: { id: soId },
      data: {
        status: 'FULLY_INVOICED'
      }
    })

    // Push to QuickBooks if requested
    let qbWarning: string | null = null
    if (pushToQuickBooks) {
      try {
        if (!salesOrder.customer?.quickbooksId) {
          qbWarning = 'Customer not synced to QuickBooks. Invoice created locally only.'
        } else {
          await pushInvoiceToQB(invoice.id)
        }
      } catch (qbError) {
        console.error('QuickBooks sync error:', qbError)
        qbWarning = `Invoice created locally but QuickBooks sync failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Fetch final invoice with QB data
    const finalInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
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
    console.error('Error creating invoice from sales order:', error)
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

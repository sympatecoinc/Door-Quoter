import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import {
  generateSONumber,
  getStoredRealmId,
  createQBInvoice,
  localSOToQBInvoice,
  localSOLineToQB,
  QBInvoiceLine
} from '@/lib/quickbooks'

// GET - List sales orders with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const customerId = searchParams.get('customerId') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { docNumber: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
        { project: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = parseInt(customerId)
    }

    // Get total count for pagination
    const total = await prisma.salesOrder.count({ where })

    // Get sales orders
    const salesOrders = await prisma.salesOrder.findMany({
      where,
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
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            lines: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit
    })

    return NextResponse.json({
      salesOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching sales orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales orders' },
      { status: 500 }
    )
  }
}

// POST - Create a new sales order
export async function POST(request: NextRequest) {
  try {
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
    const {
      customerId,
      projectId,
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

    if (!customerId) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 })
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Generate SO number
    const orderNumber = await generateSONumber()

    // Calculate totals
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

    // Create sales order with lines
    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId,
        projectId: projectId || null,
        status: 'DRAFT',
        txnDate: txnDate ? new Date(txnDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        shipDate: shipDate ? new Date(shipDate) : null,
        customerMemo: customerMemo || null,
        privateNote: privateNote || null,
        billAddrLine1: billAddrLine1 || customer.address || null,
        billAddrLine2: billAddrLine2 || null,
        billAddrCity: billAddrCity || customer.city || null,
        billAddrState: billAddrState || customer.state || null,
        billAddrPostalCode: billAddrPostalCode || customer.zipCode || null,
        billAddrCountry: billAddrCountry || customer.country || null,
        shipAddrLine1: shipAddrLine1 || null,
        shipAddrLine2: shipAddrLine2 || null,
        shipAddrCity: shipAddrCity || null,
        shipAddrState: shipAddrState || null,
        shipAddrPostalCode: shipAddrPostalCode || null,
        shipAddrCountry: shipAddrCountry || null,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
        balance: subtotal,
        createdById: userId,
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

    // Push to QuickBooks if requested
    let qbWarning: string | null = null
    if (pushToQuickBooks) {
      try {
        const realmId = await getStoredRealmId()
        if (!realmId) {
          qbWarning = 'QuickBooks not connected. Sales order saved locally only.'
        } else if (!customer.quickbooksId) {
          qbWarning = 'Customer not synced to QuickBooks. Please sync customer first.'
        } else {
          // Convert lines to QB format
          const qbLines: QBInvoiceLine[] = salesOrder.lines.map(line => localSOLineToQB(line))

          // Create invoice in QB
          const qbInvoice = localSOToQBInvoice(salesOrder, customer.quickbooksId, qbLines)
          const createdInvoice = await createQBInvoice(realmId, qbInvoice)

          // Update local SO with QB data
          await prisma.salesOrder.update({
            where: { id: salesOrder.id },
            data: {
              quickbooksId: createdInvoice.Id,
              syncToken: createdInvoice.SyncToken,
              docNumber: createdInvoice.DocNumber,
              lastSyncedAt: new Date()
            }
          })
        }
      } catch (qbError) {
        console.error('QuickBooks sync error:', qbError)
        qbWarning = `Sales order saved locally but QuickBooks sync failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Fetch updated SO
    const finalSO = await prisma.salesOrder.findUnique({
      where: { id: salesOrder.id },
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
    console.error('Error creating sales order:', error)
    return NextResponse.json(
      { error: 'Failed to create sales order' },
      { status: 500 }
    )
  }
}

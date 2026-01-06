import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import {
  generateSONumber,
  getStoredRealmId,
  createQBInvoice,
  pushCustomerToQB,
  localSOToQBInvoice,
  localSOLineToQB,
  QBInvoiceLine
} from '@/lib/quickbooks'

// POST - Create a sales order from a project quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    // Get project with all details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: true,
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: true
                  }
                }
              }
            }
          }
        },
        salesOrders: {
          where: {
            status: { not: 'VOIDED' }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if project status allows sales order creation
    const allowedStatuses = ['QUOTE_ACCEPTED', 'ACTIVE']
    if (!allowedStatuses.includes(project.status)) {
      return NextResponse.json(
        { error: `Cannot create sales order from project with status: ${project.status}. Project must be Quote Accepted or Active.` },
        { status: 400 }
      )
    }

    // Check if sales order already exists for this project
    if (project.salesOrders.length > 0) {
      return NextResponse.json(
        { error: 'A sales order already exists for this project', existingOrderNumber: project.salesOrders[0].orderNumber },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { pushToQuickBooks = true } = body

    // Generate SO number
    const orderNumber = await generateSONumber()

    // Build line items from openings
    const lines: any[] = []
    let subtotal = 0

    for (const opening of project.openings) {
      // Create a line for each opening
      const openingTotal = opening.price || 0
      subtotal += openingTotal

      // Get panel descriptions
      const panelDescriptions = opening.panels.map(panel => {
        const productName = panel.componentInstance?.product?.name || panel.type
        return `${productName} (${panel.width}"W x ${panel.height}"H)`
      }).join(', ')

      lines.push({
        lineNum: lines.length + 1,
        description: `${opening.name}: ${panelDescriptions}`,
        quantity: 1,
        unitPrice: openingTotal,
        amount: openingTotal
      })
    }

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'Project has no openings to create sales order from' },
        { status: 400 }
      )
    }

    // Get due date (30 days from now by default)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    // Create the sales order
    const salesOrder = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId: project.customerId,
        projectId: project.id,
        status: 'DRAFT',
        txnDate: new Date(),
        dueDate,
        shipDate: project.shipDate,
        customerMemo: `Quote for ${project.name}`,
        billAddrLine1: project.customer.address,
        billAddrCity: project.customer.city,
        billAddrState: project.customer.state,
        billAddrPostalCode: project.customer.zipCode,
        billAddrCountry: project.customer.country || 'USA',
        shipAddrLine1: project.shippingAddress,
        shipAddrCity: project.shippingCity,
        shipAddrState: project.shippingState,
        shipAddrPostalCode: project.shippingZipCode,
        subtotal,
        taxAmount: subtotal * (project.taxRate || 0),
        totalAmount: subtotal * (1 + (project.taxRate || 0)),
        balance: subtotal * (1 + (project.taxRate || 0)),
        createdById: userId,
        lines: {
          create: lines
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
        } else {
          // Ensure customer is synced to QB
          let customerQBId = salesOrder.customer.quickbooksId
          if (!customerQBId) {
            try {
              const syncedCustomer = await pushCustomerToQB(salesOrder.customerId)
              customerQBId = syncedCustomer.quickbooksId
            } catch (custError) {
              console.error('Failed to sync customer:', custError)
              qbWarning = 'Failed to sync customer to QuickBooks. Sales order saved locally only.'
            }
          }

          if (customerQBId) {
            // Convert lines to QB format
            const qbLines: QBInvoiceLine[] = salesOrder.lines.map(line => localSOLineToQB(line))

            // Create invoice in QB
            const qbInvoice = localSOToQBInvoice(salesOrder, customerQBId, qbLines)
            const createdInvoice = await createQBInvoice(realmId, qbInvoice)

            // Update local SO with QB data
            await prisma.salesOrder.update({
              where: { id: salesOrder.id },
              data: {
                quickbooksId: createdInvoice.Id,
                syncToken: createdInvoice.SyncToken,
                docNumber: createdInvoice.DocNumber,
                status: 'SENT',
                lastSyncedAt: new Date()
              }
            })
          }
        }
      } catch (qbError) {
        console.error('QuickBooks sync error:', qbError)
        qbWarning = `Sales order saved locally but QuickBooks sync failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Fetch final state
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
    console.error('Error creating sales order from project:', error)
    return NextResponse.json(
      { error: 'Failed to create sales order' },
      { status: 500 }
    )
  }
}

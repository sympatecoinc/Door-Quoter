import { Prisma } from '@prisma/client'
import { generateSONumber } from '@/lib/quickbooks'

export interface CreateSalesOrderOptions {
  projectId: number
  userId?: number | null
}

export interface CreateSalesOrderResult {
  success: boolean
  salesOrder?: any
  error?: string
}

/**
 * Creates a Sales Order from a project's openings.
 * Can be used within a transaction or standalone.
 *
 * @param prisma - Prisma client or transaction client
 * @param options - Options including projectId and optional userId
 * @returns Result object with success status and salesOrder or error
 */
export async function createSalesOrderFromProject(
  prisma: Prisma.TransactionClient | any,
  options: CreateSalesOrderOptions
): Promise<CreateSalesOrderResult> {
  const { projectId, userId } = options

  // Get project with all details needed for SO creation
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
      },
      quoteVersions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { totalPrice: true }
      }
    }
  })

  if (!project) {
    return { success: false, error: 'Project not found' }
  }

  // Check if project has a customer assigned
  if (!project.customerId) {
    return {
      success: false,
      error: 'Cannot create sales order without a customer assigned. Please assign a customer to this project first.'
    }
  }

  // Check if sales order already exists for this project
  if (project.salesOrders.length > 0) {
    // Sales order already exists - this is not an error for auto-create
    // Just skip creation silently
    return {
      success: true,
      salesOrder: project.salesOrders[0],
      error: undefined
    }
  }

  // Build line items from openings
  const lines: any[] = []

  // Require a quote to exist - cannot create SO without a generated quote
  const latestQuote = project.quoteVersions?.[0]
  if (!latestQuote?.totalPrice) {
    return {
      success: false,
      error: 'Cannot create sales order without a quote. Please generate a quote first.'
    }
  }

  const subtotal = Number(latestQuote.totalPrice)

  // Build line items for each opening
  // Distribute the subtotal proportionally based on opening prices
  const totalOpeningCost = project.openings.reduce((sum, o) => sum + (o.price || 0), 0)

  for (const opening of project.openings) {
    const openingCost = opening.price || 0
    // Calculate this opening's proportional share of the subtotal
    const openingTotal = totalOpeningCost > 0
      ? (openingCost / totalOpeningCost) * subtotal
      : subtotal / project.openings.length

    // Get panel descriptions
    const panelDescriptions = opening.panels.map((panel: any) => {
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
    return { success: false, error: 'Project has no openings to create sales order from' }
  }

  // Generate SO number
  const orderNumber = await generateSONumber()

  // Get due date (30 days from now by default)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create the sales order
  const salesOrder = await prisma.salesOrder.create({
    data: ({
      orderNumber,
      customerId: project.customerId ?? undefined,
      projectId: project.id,
      status: 'DRAFT',
      txnDate: new Date(),
      dueDate,
      shipDate: project.shipDate,
      customerMemo: `Quote for ${project.name}`,
      billAddrLine1: project.customer?.address,
      billAddrCity: project.customer?.city,
      billAddrState: project.customer?.state,
      billAddrPostalCode: project.customer?.zipCode,
      billAddrCountry: project.customer?.country || 'USA',
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
    }) as any,
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

  return { success: true, salesOrder }
}

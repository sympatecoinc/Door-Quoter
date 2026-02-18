import { Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'
import { buildSalesOrderLinesFromProject } from '@/lib/sales-order'

/**
 * Generate next Change Order number (format: CO-YYYY-NNNN)
 */
export async function generateCONumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || defaultPrisma
  const year = new Date().getFullYear()
  const prefix = `CO-${year}-`

  const lastCO = await db.changeOrder.findFirst({
    where: {
      changeOrderNumber: { startsWith: prefix }
    },
    orderBy: { changeOrderNumber: 'desc' }
  })

  let nextNum = 1
  if (lastCO) {
    const lastNumStr = lastCO.changeOrderNumber.replace(prefix, '')
    const lastNum = parseInt(lastNumStr, 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }

  return `${prefix}${nextNum.toString().padStart(4, '0')}`
}

export interface CreateChangeOrderOptions {
  salesOrderId: number
  newProjectId: number
  previousProjectId: number
  userId?: number | null
  reason?: string | null
}

export interface CreateChangeOrderResult {
  success: boolean
  changeOrder?: any
  error?: string
}

/**
 * Creates a Change Order by comparing two project revisions.
 * Updates the existing Sales Order to point to the new revision with recalculated line items.
 */
export async function createChangeOrderFromRevision(
  prisma: Prisma.TransactionClient | any,
  options: CreateChangeOrderOptions
): Promise<CreateChangeOrderResult> {
  const { salesOrderId, newProjectId, previousProjectId, userId, reason } = options

  // Fetch both project revisions with openings
  const [newProject, previousProject, salesOrder] = await Promise.all([
    prisma.project.findUnique({
      where: { id: newProjectId },
      include: {
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: { product: { select: { name: true } } }
                }
              }
            }
          }
        },
        quoteVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalPrice: true }
        }
      }
    }),
    prisma.project.findUnique({
      where: { id: previousProjectId },
      include: {
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: { product: { select: { name: true } } }
                }
              }
            }
          }
        },
        quoteVersions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalPrice: true }
        }
      }
    }),
    prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { lines: true }
    })
  ])

  if (!newProject) {
    return { success: false, error: 'New project revision not found' }
  }
  if (!previousProject) {
    return { success: false, error: 'Previous project revision not found' }
  }
  if (!salesOrder) {
    return { success: false, error: 'Sales order not found' }
  }

  // Build maps of openings by name for comparison
  const previousOpenings = new Map<string, any>()
  for (const opening of previousProject.openings) {
    previousOpenings.set(opening.name, opening)
  }

  const newOpenings = new Map<string, any>()
  for (const opening of newProject.openings) {
    newOpenings.set(opening.name, opening)
  }

  // Compare openings and build change order lines
  const coLines: any[] = []
  let lineNum = 0
  const processedNames = new Set<string>()

  // Check new openings against previous
  for (const [name, newOpening] of newOpenings) {
    processedNames.add(name)
    const prevOpening = previousOpenings.get(name)
    lineNum++

    const panelDesc = newOpening.panels.map((p: any) => {
      const productName = p.componentInstance?.product?.name || p.type
      return `${productName} (${p.width}"W x ${p.height}"H)`
    }).join(', ')

    if (!prevOpening) {
      // ADDED - opening exists in new but not old
      coLines.push({
        lineNum,
        changeType: 'ADDED',
        description: `${name}: ${panelDesc}`,
        previousQty: null,
        previousPrice: null,
        previousAmount: null,
        newQty: 1,
        newPrice: newOpening.price || 0,
        newAmount: newOpening.price || 0,
        deltaAmount: newOpening.price || 0,
      })
    } else {
      // Exists in both - check if modified
      const prevPrice = prevOpening.price || 0
      const newPrice = newOpening.price || 0
      const delta = newPrice - prevPrice

      if (Math.abs(delta) > 0.01) {
        // MODIFIED
        coLines.push({
          lineNum,
          changeType: 'MODIFIED',
          description: `${name}: ${panelDesc}`,
          previousQty: 1,
          previousPrice: prevPrice,
          previousAmount: prevPrice,
          newQty: 1,
          newPrice: newPrice,
          newAmount: newPrice,
          deltaAmount: delta,
        })
      }
      // UNCHANGED openings are skipped (not added to CO lines)
    }
  }

  // Check for removed openings (in previous but not in new)
  for (const [name, prevOpening] of previousOpenings) {
    if (!processedNames.has(name)) {
      lineNum++
      const panelDesc = prevOpening.panels.map((p: any) => {
        const productName = p.componentInstance?.product?.name || p.type
        return `${productName} (${p.width}"W x ${p.height}"H)`
      }).join(', ')

      coLines.push({
        lineNum,
        changeType: 'REMOVED',
        description: `${name}: ${panelDesc}`,
        previousQty: 1,
        previousPrice: prevOpening.price || 0,
        previousAmount: prevOpening.price || 0,
        newQty: null,
        newPrice: null,
        newAmount: null,
        deltaAmount: -(prevOpening.price || 0),
      })
    }
  }

  // Calculate totals
  const previousTotal = Number(previousProject.quoteVersions?.[0]?.totalPrice || 0)
  const newTotal = Number(newProject.quoteVersions?.[0]?.totalPrice || 0)
  const deltaAmount = newTotal - previousTotal

  // Generate CO number
  const changeOrderNumber = await generateCONumber(prisma)

  // Create the change order with lines
  const changeOrder = await prisma.changeOrder.create({
    data: {
      changeOrderNumber,
      salesOrderId,
      projectId: newProjectId,
      previousProjectId,
      status: 'DRAFT',
      previousTotal,
      newTotal,
      deltaAmount,
      description: `Change order for revision v${newProject.version} (from v${previousProject.version})`,
      reason: reason || null,
      createdById: userId || null,
      lines: {
        create: coLines
      }
    },
    include: {
      lines: true,
      salesOrder: { select: { orderNumber: true } },
      project: { select: { id: true, name: true, version: true } }
    }
  })

  // Update the existing SO: re-link to new project, recalculate line items
  // First delete old lines
  await prisma.salesOrderLine.deleteMany({
    where: { salesOrderId }
  })

  // Build new line items from new project openings using shared helper
  const { lines: soLines, subtotal, taxAmount, totalAmount, balance } = buildSalesOrderLinesFromProject(
    newProject.openings,
    newTotal,
    newProject.taxRate || 0
  )

  if (soLines.length > 0) {
    await prisma.salesOrderLine.createMany({
      data: soLines.map(line => ({
        salesOrderId,
        ...line
      }))
    })
  }

  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: {
      projectId: newProjectId,
      subtotal,
      taxAmount,
      totalAmount,
      balance,
    }
  })

  return { success: true, changeOrder }
}

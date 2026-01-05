import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  fetchAllQBInvoices,
  qbInvoiceToLocal,
  generateSONumber,
  QBInvoice
} from '@/lib/quickbooks'

// GET - Sync sales orders from QuickBooks
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Fetch all invoices from QB
    const qbInvoices = await fetchAllQBInvoices(realmId)
    console.log(`[SO Sync] Processing ${qbInvoices.length} invoices from QuickBooks`)

    for (const qbInvoice of qbInvoices) {
      try {
        // Find customer by QB ID
        const customerQBId = qbInvoice.CustomerRef?.value
        if (!customerQBId) {
          results.errors.push(`Invoice ${qbInvoice.DocNumber || qbInvoice.Id}: No customer reference`)
          continue
        }

        const customer = await prisma.customer.findUnique({
          where: { quickbooksId: customerQBId }
        })

        if (!customer) {
          // Customer not synced - skip this invoice
          results.skipped++
          continue
        }

        // Check if SO already exists
        const existingSO = await prisma.salesOrder.findUnique({
          where: { quickbooksId: qbInvoice.Id }
        })

        const localData = qbInvoiceToLocal(qbInvoice, customer.id)

        // Process line items
        const lineItems = (qbInvoice.Line || [])
          .filter((line: any) => line.DetailType === 'SalesItemLineDetail')
          .map((line: any, index: number) => ({
            lineNum: line.LineNum || index + 1,
            itemRefId: line.SalesItemLineDetail?.ItemRef?.value || null,
            itemRefName: line.SalesItemLineDetail?.ItemRef?.name || null,
            description: line.Description || null,
            quantity: line.SalesItemLineDetail?.Qty || 1,
            unitPrice: line.SalesItemLineDetail?.UnitPrice || 0,
            amount: line.Amount || 0
          }))

        // Determine status based on balance
        let status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'PAID' | 'VOIDED' = 'SENT'
        const balance = qbInvoice.Balance ?? 0
        const total = qbInvoice.TotalAmt ?? 0

        if (balance === 0 && total > 0) {
          status = 'PAID'
        } else if (balance < total && balance > 0) {
          status = 'PARTIAL'
        }

        if (existingSO) {
          // Update existing SO
          await prisma.$transaction(async (tx) => {
            // Delete old lines
            await tx.salesOrderLine.deleteMany({
              where: { salesOrderId: existingSO.id }
            })

            // Update SO with new data
            await tx.salesOrder.update({
              where: { id: existingSO.id },
              data: {
                ...localData,
                status,
                orderNumber: existingSO.orderNumber, // Preserve local order number
                projectId: existingSO.projectId, // Preserve project link
                lines: {
                  create: lineItems
                }
              }
            })
          })
          results.updated++
        } else {
          // Create new SO
          const orderNumber = await generateSONumber()

          await prisma.salesOrder.create({
            data: {
              ...localData,
              orderNumber,
              status,
              lines: {
                create: lineItems
              }
            }
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = `Failed to sync invoice ${qbInvoice.DocNumber || qbInvoice.Id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    console.log(`[SO Sync] Complete: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error syncing sales orders:', error)
    return NextResponse.json(
      { error: 'Failed to sync from QuickBooks' },
      { status: 500 }
    )
  }
}

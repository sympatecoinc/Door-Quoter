import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  fetchAllQBInvoices,
  qbInvoiceToLocalInvoice,
  generateInvoiceNumber,
  pushInvoiceToQB
} from '@/lib/quickbooks'

// GET - 2-way sync: Push local invoices to QB, then pull QB invoices to local
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
      pushed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Step 1: Push local invoices without quickbooksId to QuickBooks
    const localOnlyInvoices = await prisma.invoice.findMany({
      where: { quickbooksId: null },
      include: { customer: true }
    })

    console.log(`[Invoice QB Sync] Found ${localOnlyInvoices.length} local invoices to push to QuickBooks`)

    for (const invoice of localOnlyInvoices) {
      try {
        // Skip if customer is not synced to QB
        if (!invoice.customer?.quickbooksId) {
          results.errors.push(`Skipped Invoice ${invoice.invoiceNumber}: Customer not synced to QuickBooks`)
          continue
        }
        await pushInvoiceToQB(invoice.id)
        results.pushed++
        console.log(`[Invoice QB Sync] Pushed Invoice "${invoice.invoiceNumber}" to QuickBooks`)
      } catch (error) {
        const errorMsg = `Failed to push Invoice ${invoice.invoiceNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    // Step 2: Pull invoices from QuickBooks to local
    const qbInvoices = await fetchAllQBInvoices(realmId)
    console.log(`[Invoice Sync] Processing ${qbInvoices.length} invoices from QuickBooks`)

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

        // Check if invoice already exists
        const existingInvoice = await prisma.invoice.findUnique({
          where: { quickbooksId: qbInvoice.Id }
        })

        const localData = qbInvoiceToLocalInvoice(qbInvoice, customer.id)

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

        if (existingInvoice) {
          // Update existing invoice
          await prisma.$transaction(async (tx) => {
            // Delete old lines
            await tx.invoiceLine.deleteMany({
              where: { invoiceId: existingInvoice.id }
            })

            // Update invoice with new data
            await tx.invoice.update({
              where: { id: existingInvoice.id },
              data: {
                ...localData,
                status,
                invoiceNumber: existingInvoice.invoiceNumber, // Preserve local invoice number
                salesOrderId: existingInvoice.salesOrderId, // Preserve SO link
                lines: {
                  create: lineItems
                }
              }
            })
          })
          results.updated++
        } else {
          // Create new invoice
          const invoiceNumber = await generateInvoiceNumber()

          await prisma.invoice.create({
            data: {
              ...localData,
              invoiceNumber,
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

    console.log(`[Invoice QB Sync] Complete: Pushed ${results.pushed}, Created ${results.created}, Updated ${results.updated}, Skipped ${results.skipped}`)

    return NextResponse.json({
      message: `2-way sync complete. Pushed: ${results.pushed}, Created: ${results.created}, Updated: ${results.updated}`,
      ...results
    })
  } catch (error) {
    console.error('Error syncing invoices:', error)
    return NextResponse.json(
      { error: 'Failed to sync from QuickBooks' },
      { status: 500 }
    )
  }
}

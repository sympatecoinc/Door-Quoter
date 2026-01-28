import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  fetchQBPurchaseOrder,
  fetchQBVendor,
  fetchQBCustomer,
  fetchQBItem,
  fetchQBInvoice,
  getQBEstimate,
  qbVendorToLocal,
  qbCustomerToLocal,
  qbItemToLocal,
  qbInvoiceToLocalInvoice
} from '@/lib/quickbooks'

// QuickBooks webhook payload structure
interface QBWebhookPayload {
  eventNotifications: Array<{
    realmId: string
    dataChangeEvent: {
      entities: Array<{
        name: string
        id: string
        operation: 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void'
        lastUpdated: string
      }>
    }
  }>
}

// Verify the HMAC-SHA256 signature from QuickBooks
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64')

    return hash === signature
  } catch (error) {
    console.error('[QB Webhook] Signature verification error:', error)
    return false
  }
}

// Process all webhook events from the payload
export async function processWebhookEvents(payload: QBWebhookPayload): Promise<void> {
  const storedRealmId = await getStoredRealmId()

  for (const notification of payload.eventNotifications) {
    const { realmId, dataChangeEvent } = notification

    // Verify this is for our connected company
    if (storedRealmId && realmId !== storedRealmId) {
      console.warn(`[QB Webhook] Ignoring event for different realm: ${realmId}`)
      continue
    }

    for (const entity of dataChangeEvent.entities) {
      try {
        await processEntityEvent(realmId, entity)
      } catch (error) {
        console.error(`[QB Webhook] Error processing ${entity.name} ${entity.id}:`, error)
      }
    }
  }
}

// Process a single entity event
async function processEntityEvent(
  realmId: string,
  entity: {
    name: string
    id: string
    operation: string
    lastUpdated: string
  }
): Promise<void> {
  console.log(`[QB Webhook] Processing ${entity.operation} for ${entity.name} (ID: ${entity.id})`)

  switch (entity.name) {
    case 'PurchaseOrder':
      await handlePurchaseOrderEvent(realmId, entity.id, entity.operation)
      break
    case 'Vendor':
      await handleVendorEvent(realmId, entity.id, entity.operation)
      break
    case 'Item':
      await handleItemEvent(realmId, entity.id, entity.operation)
      break
    case 'Customer':
      await handleCustomerEvent(realmId, entity.id, entity.operation)
      break
    case 'Invoice':
      await handleInvoiceEvent(realmId, entity.id, entity.operation)
      break
    case 'Estimate':
      await handleEstimateEvent(realmId, entity.id, entity.operation)
      break
    default:
      console.log(`[QB Webhook] Ignoring unsupported entity type: ${entity.name}`)
  }
}

// Handle PurchaseOrder events
async function handlePurchaseOrderEvent(
  realmId: string,
  qbPoId: string,
  operation: string
): Promise<void> {
  if (operation === 'Delete' || operation === 'Void') {
    // Delete the local PO to match QuickBooks
    const localPO = await prisma.purchaseOrder.findFirst({
      where: { quickbooksId: qbPoId },
      include: { receivings: true }
    })

    if (localPO) {
      // Check if there are receiving records - if so, just cancel instead of delete
      if (localPO.receivings.length > 0) {
        await prisma.purchaseOrder.update({
          where: { id: localPO.id },
          data: {
            status: 'CANCELLED',
            statusHistory: {
              create: {
                fromStatus: localPO.status,
                toStatus: 'CANCELLED',
                notes: `PO ${operation.toLowerCase()}d in QuickBooks (has receiving records, preserved locally)`
              }
            }
          }
        })
        console.log(`[QB Webhook] Marked PO ${localPO.poNumber} as cancelled (has receivings)`)
      } else {
        // No receivings - safe to delete completely
        await prisma.purchaseOrder.delete({
          where: { id: localPO.id }
        })
        console.log(`[QB Webhook] Deleted PO ${localPO.poNumber} (${operation} from QuickBooks)`)
      }
    }
    return
  }

  // For Create/Update, sync the PO from QuickBooks
  await syncSinglePOFromQB(realmId, qbPoId)
}

// Sync a single PO from QuickBooks to local database
export async function syncSinglePOFromQB(
  realmId: string,
  qbPoId: string
): Promise<void> {
  console.log(`[QB Webhook] Syncing PO ${qbPoId} from QuickBooks`)

  try {
    const qbPO = await fetchQBPurchaseOrder(realmId, qbPoId)

    // Find vendor by QB ID
    const vendor = await prisma.vendor.findFirst({
      where: { quickbooksId: qbPO.VendorRef?.value }
    })

    if (!vendor) {
      console.warn(`[QB Webhook] Vendor not found for QB ID: ${qbPO.VendorRef?.value}`)
      return
    }

    // Check if PO already exists locally
    let localPO = await prisma.purchaseOrder.findFirst({
      where: { quickbooksId: qbPoId }
    })

    // Map QB status to local status
    const statusMap: Record<string, string> = {
      'Open': 'SENT',
      'Closed': 'COMPLETE'
    }
    const localStatus = statusMap[qbPO.POStatus || 'Open'] || 'SENT'

    // Process line items
    const lines = (qbPO.Line || [])
      .filter((line: any) => line.DetailType === 'ItemBasedExpenseLineDetail')
      .map((line: any, index: number) => ({
        lineNum: index + 1,
        itemRefId: line.ItemBasedExpenseLineDetail?.ItemRef?.value || null,
        itemRefName: line.ItemBasedExpenseLineDetail?.ItemRef?.name || null,
        description: line.Description || line.ItemBasedExpenseLineDetail?.ItemRef?.name || null,
        quantity: line.ItemBasedExpenseLineDetail?.Qty || 1,
        unitPrice: line.ItemBasedExpenseLineDetail?.UnitPrice || 0,
        amount: line.Amount || 0,
        quantityReceived: 0,
        quantityRemaining: line.ItemBasedExpenseLineDetail?.Qty || 1
      }))

    if (localPO) {
      // Update existing PO
      await prisma.purchaseOrder.update({
        where: { id: localPO.id },
        data: {
          syncToken: qbPO.SyncToken,
          docNumber: qbPO.DocNumber,
          txnDate: qbPO.TxnDate ? new Date(qbPO.TxnDate) : new Date(),
          dueDate: qbPO.DueDate ? new Date(qbPO.DueDate) : null,
          memo: qbPO.Memo || null,
          privateNote: qbPO.PrivateNote || null,
          totalAmount: qbPO.TotalAmt || 0,
          status: localStatus as any,
          lastSyncedAt: new Date()
        }
      })

      // Update lines (delete and recreate for simplicity)
      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: localPO.id }
      })

      if (lines.length > 0) {
        await prisma.purchaseOrderLine.createMany({
          data: lines.map((line: any) => ({
            ...line,
            purchaseOrderId: localPO!.id
          }))
        })
      }

      console.log(`[QB Webhook] Updated PO ${localPO.poNumber} from QuickBooks`)
    } else {
      // Create new PO
      const newPO = await prisma.purchaseOrder.create({
        data: {
          poNumber: qbPO.DocNumber || `QB-${qbPoId}`,
          quickbooksId: qbPoId,
          syncToken: qbPO.SyncToken,
          docNumber: qbPO.DocNumber,
          vendorId: vendor.id,
          status: localStatus as any,
          txnDate: qbPO.TxnDate ? new Date(qbPO.TxnDate) : new Date(),
          dueDate: qbPO.DueDate ? new Date(qbPO.DueDate) : null,
          memo: qbPO.Memo || null,
          privateNote: qbPO.PrivateNote || null,
          totalAmount: qbPO.TotalAmt || 0,
          subtotal: qbPO.TotalAmt || 0,
          lastSyncedAt: new Date(),
          lines: {
            create: lines
          },
          statusHistory: {
            create: {
              fromStatus: null as any,
              toStatus: localStatus,
              notes: 'Synced from QuickBooks webhook'
            }
          }
        }
      })

      console.log(`[QB Webhook] Created new PO ${newPO.poNumber} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync PO ${qbPoId}:`, error)
    throw error
  }
}

// Handle Vendor events
async function handleVendorEvent(
  realmId: string,
  qbVendorId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Vendor event: ${operation} for ID ${qbVendorId}`)

  // Find local vendor by QB ID
  const localVendor = await prisma.vendor.findFirst({
    where: { quickbooksId: qbVendorId }
  })

  if (operation === 'Delete') {
    // QuickBooks vendors can't actually be deleted - they're made inactive
    // But if we somehow receive a Delete event, mark local as inactive
    if (localVendor) {
      await prisma.vendor.update({
        where: { id: localVendor.id },
        data: { isActive: false }
      })
      console.log(`[QB Webhook] Marked vendor ${localVendor.displayName} as inactive (deleted in QB)`)
    }
    return
  }

  // For Create/Update, sync vendor from QuickBooks
  try {
    const qbVendor = await fetchQBVendor(realmId, qbVendorId)

    // Check if vendor was made inactive in QB
    if (qbVendor.Active === false) {
      if (localVendor) {
        await prisma.vendor.update({
          where: { id: localVendor.id },
          data: {
            ...qbVendorToLocal(qbVendor),
            isActive: false,
            // Preserve local-only fields
            category: localVendor.category,
            code: localVendor.code
          }
        })
        console.log(`[QB Webhook] Marked vendor ${localVendor.displayName} as inactive (deactivated in QB)`)
      }
      return
    }

    // Active vendor - sync normally
    const localData = qbVendorToLocal(qbVendor)

    if (localVendor) {
      await prisma.vendor.update({
        where: { id: localVendor.id },
        data: {
          ...localData,
          // Preserve local-only fields
          category: localVendor.category,
          code: localVendor.code
        }
      })
      console.log(`[QB Webhook] Updated vendor ${localVendor.displayName} from QuickBooks`)
    } else {
      await prisma.vendor.create({
        data: localData
      })
      console.log(`[QB Webhook] Created vendor ${localData.displayName} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync vendor ${qbVendorId}:`, error)
    throw error
  }
}

// Handle Item events
async function handleItemEvent(
  realmId: string,
  qbItemId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Item event: ${operation} for ID ${qbItemId}`)

  // Find local item by QB ID
  const localItem = await prisma.quickBooksItem.findFirst({
    where: { quickbooksId: qbItemId }
  })

  if (operation === 'Delete') {
    // QuickBooks items can't actually be deleted - they're made inactive
    // But if we somehow receive a Delete event, mark local as inactive
    if (localItem) {
      await prisma.quickBooksItem.update({
        where: { id: localItem.id },
        data: { active: false }
      })
      console.log(`[QB Webhook] Marked item ${localItem.name} as inactive (deleted in QB)`)
    }
    return
  }

  // For Create/Update, sync item from QuickBooks
  try {
    const qbItem = await fetchQBItem(realmId, qbItemId)

    // Check if item was made inactive in QB
    if (qbItem.Active === false) {
      if (localItem) {
        await prisma.quickBooksItem.update({
          where: { id: localItem.id },
          data: {
            ...qbItemToLocal(qbItem),
            active: false,
            // Preserve local link
            masterPartId: localItem.masterPartId
          }
        })
        console.log(`[QB Webhook] Marked item ${localItem.name} as inactive (deactivated in QB)`)
      }
      return
    }

    // Active item - sync normally
    const localData = qbItemToLocal(qbItem)

    if (localItem) {
      await prisma.quickBooksItem.update({
        where: { id: localItem.id },
        data: {
          ...localData,
          // Preserve local link
          masterPartId: localItem.masterPartId
        }
      })
      console.log(`[QB Webhook] Updated item ${localItem.name} from QuickBooks`)
    } else {
      await prisma.quickBooksItem.create({
        data: localData
      })
      console.log(`[QB Webhook] Created item ${localData.name} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync item ${qbItemId}:`, error)
    throw error
  }
}

// Handle Customer events
async function handleCustomerEvent(
  realmId: string,
  qbCustomerId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Customer event: ${operation} for ID ${qbCustomerId}`)

  // Find local customer by QB ID
  const localCustomer = await prisma.customer.findFirst({
    where: { quickbooksId: qbCustomerId }
  })

  if (operation === 'Delete') {
    // QuickBooks customers can't actually be deleted - they're made inactive
    // But if we somehow receive a Delete event, archive locally
    if (localCustomer) {
      await prisma.customer.update({
        where: { id: localCustomer.id },
        data: { status: 'Archived' }
      })
      console.log(`[QB Webhook] Archived customer ${localCustomer.companyName} (deleted in QB)`)
    }
    return
  }

  // For Create/Update, sync customer from QuickBooks
  try {
    const qbCustomer = await fetchQBCustomer(realmId, qbCustomerId)

    // Check if customer was made inactive in QB
    if (qbCustomer.Active === false) {
      if (localCustomer) {
        await prisma.customer.update({
          where: { id: localCustomer.id },
          data: {
            ...qbCustomerToLocal(qbCustomer),
            status: 'Archived',
            // Preserve local-only fields
            source: localCustomer.source
          }
        })
        console.log(`[QB Webhook] Archived customer ${localCustomer.companyName} (deactivated in QB)`)
      }
      return
    }

    // Active customer - sync normally
    const localData = qbCustomerToLocal(qbCustomer)

    if (localCustomer) {
      await prisma.customer.update({
        where: { id: localCustomer.id },
        data: {
          ...localData,
          // Preserve local-only fields
          source: localCustomer.source
        }
      })
      console.log(`[QB Webhook] Updated customer ${localCustomer.companyName} from QuickBooks`)
    } else {
      await prisma.customer.create({
        data: localData
      })
      console.log(`[QB Webhook] Created customer ${localData.companyName} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync customer ${qbCustomerId}:`, error)
    throw error
  }
}

// Handle Invoice events
async function handleInvoiceEvent(
  realmId: string,
  qbInvoiceId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Invoice event: ${operation} for ID ${qbInvoiceId}`)

  // Find local invoice by QB ID
  const localInvoice = await prisma.invoice.findFirst({
    where: { quickbooksId: qbInvoiceId }
  })

  if (operation === 'Delete' || operation === 'Void') {
    // Invoice was voided in QuickBooks
    if (localInvoice) {
      await prisma.invoice.update({
        where: { id: localInvoice.id },
        data: { status: 'VOIDED' }
      })
      console.log(`[QB Webhook] Marked invoice ${localInvoice.invoiceNumber} as VOIDED (${operation.toLowerCase()}d in QB)`)
    }
    return
  }

  // For Create/Update, sync invoice from QuickBooks
  try {
    const qbInvoice = await fetchQBInvoice(realmId, qbInvoiceId)

    // Find customer by QB ID
    const customer = await prisma.customer.findFirst({
      where: { quickbooksId: qbInvoice.CustomerRef?.value }
    })

    if (!customer) {
      console.warn(`[QB Webhook] Customer not found for QB ID: ${qbInvoice.CustomerRef?.value}`)
      return
    }

    const localData = qbInvoiceToLocalInvoice(qbInvoice, customer.id)

    if (localInvoice) {
      await prisma.invoice.update({
        where: { id: localInvoice.id },
        data: {
          ...localData,
          // Preserve local fields
          salesOrderId: localInvoice.salesOrderId,
          createdById: localInvoice.createdById
        }
      })
      console.log(`[QB Webhook] Updated invoice ${localInvoice.invoiceNumber} from QuickBooks`)
    } else {
      // Create new invoice - generate invoice number
      const { generateInvoiceNumber } = await import('@/lib/quickbooks')
      const invoiceNumber = await generateInvoiceNumber()

      await prisma.invoice.create({
        data: {
          ...localData,
          invoiceNumber,
          status: 'DRAFT'
        }
      })
      console.log(`[QB Webhook] Created invoice ${invoiceNumber} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync invoice ${qbInvoiceId}:`, error)
    throw error
  }
}

// Handle Estimate events (mapped to SalesOrder in local system)
async function handleEstimateEvent(
  realmId: string,
  qbEstimateId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Estimate event: ${operation} for ID ${qbEstimateId}`)

  // Find local sales order by QB ID
  const localSO = await prisma.salesOrder.findFirst({
    where: { quickbooksId: qbEstimateId }
  })

  if (operation === 'Delete' || operation === 'Void') {
    // Estimate was voided/deleted in QuickBooks
    if (localSO) {
      await prisma.salesOrder.update({
        where: { id: localSO.id },
        data: { status: 'CANCELLED' }
      })
      console.log(`[QB Webhook] Marked sales order ${localSO.orderNumber} as CANCELLED (${operation.toLowerCase()}d in QB)`)
    }
    return
  }

  // For Create/Update, sync estimate from QuickBooks
  try {
    const qbEstimate = await getQBEstimate(realmId, qbEstimateId)

    // Find customer by QB ID
    const customer = await prisma.customer.findFirst({
      where: { quickbooksId: qbEstimate.CustomerRef?.value }
    })

    if (!customer) {
      console.warn(`[QB Webhook] Customer not found for QB ID: ${qbEstimate.CustomerRef?.value}`)
      return
    }

    // Map QB Estimate status to local SO status
    const statusMap: Record<string, string> = {
      'Pending': 'DRAFT',
      'Accepted': 'SENT',
      'Closed': 'COMPLETED',
      'Rejected': 'CANCELLED'
    }
    const localStatus = statusMap[qbEstimate.TxnStatus || 'Pending'] || 'DRAFT'

    if (localSO) {
      await prisma.salesOrder.update({
        where: { id: localSO.id },
        data: {
          quickbooksId: qbEstimateId,
          syncToken: qbEstimate.SyncToken,
          customerId: customer.id,
          txnDate: qbEstimate.TxnDate ? new Date(qbEstimate.TxnDate) : localSO.txnDate,
          dueDate: qbEstimate.ExpirationDate ? new Date(qbEstimate.ExpirationDate) : localSO.dueDate,
          totalAmount: qbEstimate.TotalAmt ?? localSO.totalAmount,
          subtotal: qbEstimate.TotalAmt ?? localSO.subtotal,
          status: localStatus as any,
          customerMemo: qbEstimate.CustomerMemo?.value || localSO.customerMemo,
          privateNote: qbEstimate.PrivateNote || localSO.privateNote,
          lastSyncedAt: new Date()
        }
      })
      console.log(`[QB Webhook] Updated sales order ${localSO.orderNumber} from QuickBooks`)
    } else {
      // Create new sales order - generate order number
      const { generateSONumber } = await import('@/lib/quickbooks')
      const orderNumber = await generateSONumber()

      await prisma.salesOrder.create({
        data: {
          orderNumber,
          quickbooksId: qbEstimateId,
          syncToken: qbEstimate.SyncToken,
          docNumber: qbEstimate.DocNumber,
          customerId: customer.id,
          status: localStatus as any,
          txnDate: qbEstimate.TxnDate ? new Date(qbEstimate.TxnDate) : new Date(),
          dueDate: qbEstimate.ExpirationDate ? new Date(qbEstimate.ExpirationDate) : null,
          totalAmount: qbEstimate.TotalAmt ?? 0,
          subtotal: qbEstimate.TotalAmt ?? 0,
          customerMemo: qbEstimate.CustomerMemo?.value || null,
          privateNote: qbEstimate.PrivateNote || null,
          billAddrLine1: qbEstimate.BillAddr?.Line1 || null,
          billAddrLine2: qbEstimate.BillAddr?.Line2 || null,
          billAddrCity: qbEstimate.BillAddr?.City || null,
          billAddrState: qbEstimate.BillAddr?.CountrySubDivisionCode || null,
          billAddrPostalCode: qbEstimate.BillAddr?.PostalCode || null,
          billAddrCountry: qbEstimate.BillAddr?.Country || null,
          shipAddrLine1: qbEstimate.ShipAddr?.Line1 || null,
          shipAddrLine2: qbEstimate.ShipAddr?.Line2 || null,
          shipAddrCity: qbEstimate.ShipAddr?.City || null,
          shipAddrState: qbEstimate.ShipAddr?.CountrySubDivisionCode || null,
          shipAddrPostalCode: qbEstimate.ShipAddr?.PostalCode || null,
          shipAddrCountry: qbEstimate.ShipAddr?.Country || null,
          lastSyncedAt: new Date()
        }
      })
      console.log(`[QB Webhook] Created sales order ${orderNumber} from QuickBooks`)
    }
  } catch (error) {
    console.error(`[QB Webhook] Failed to sync estimate ${qbEstimateId}:`, error)
    throw error
  }
}

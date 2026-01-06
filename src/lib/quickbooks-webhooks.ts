import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getStoredRealmId, fetchQBPurchaseOrder } from '@/lib/quickbooks'

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
    // Mark the local PO as cancelled
    const localPO = await prisma.purchaseOrder.findFirst({
      where: { quickbooksId: qbPoId }
    })

    if (localPO) {
      await prisma.purchaseOrder.update({
        where: { id: localPO.id },
        data: {
          status: 'CANCELLED',
          statusHistory: {
            create: {
              fromStatus: localPO.status,
              toStatus: 'CANCELLED',
              notes: `PO ${operation.toLowerCase()}d in QuickBooks`
            }
          }
        }
      })
      console.log(`[QB Webhook] Marked PO ${localPO.poNumber} as cancelled (${operation})`)
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
              fromStatus: null,
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

// Handle Vendor events (for future use)
async function handleVendorEvent(
  realmId: string,
  qbVendorId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Vendor event: ${operation} for ID ${qbVendorId}`)
  // TODO: Implement vendor sync if needed
}

// Handle Item events (for future use)
async function handleItemEvent(
  realmId: string,
  qbItemId: string,
  operation: string
): Promise<void> {
  console.log(`[QB Webhook] Item event: ${operation} for ID ${qbItemId}`)
  // TODO: Implement item sync if needed
}

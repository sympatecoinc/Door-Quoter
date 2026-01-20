// Purchase Order Types

export type POStatus = 'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'PARTIAL' | 'COMPLETE' | 'CANCELLED' | 'ON_HOLD'

export const PO_STATUS_CONFIG: Record<POStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  SENT: { label: 'Sent', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ACKNOWLEDGED: { label: 'Acknowledged', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  PARTIAL: { label: 'Partial', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  COMPLETE: { label: 'Complete', color: 'text-green-700', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
  ON_HOLD: { label: 'On Hold', color: 'text-orange-700', bgColor: 'bg-orange-100' }
}

export interface QuickBooksItem {
  id: number
  quickbooksId: string
  name: string
  sku?: string | null
  description?: string | null
  type: string
  active: boolean
  unitPrice?: number | null
  purchaseCost?: number | null
  purchaseDesc?: string | null
  masterPartId?: number | null
  masterPart?: {
    id: number
    partNumber: string
    baseName: string
  } | null
}

export interface PurchaseOrderLine {
  id: number
  purchaseOrderId: number
  lineNum: number
  quickbooksItemId?: number | null
  quickbooksItem?: QuickBooksItem | null
  itemRefId?: string | null
  itemRefName?: string | null
  description?: string | null
  quantity: number
  unitPrice: number
  amount: number
  quantityReceived: number
  quantityRemaining: number
  notes?: string | null
}

export interface POReceivingLine {
  id: number
  receivingId: number
  purchaseOrderLineId: number
  quantityReceived: number
  quantityDamaged: number
  quantityRejected: number
  notes?: string | null
}

export interface POReceiving {
  id: number
  purchaseOrderId: number
  receivedDate: string
  receivedById?: number | null
  receivedBy?: { id: number; name: string } | null
  notes?: string | null
  qualityNotes?: string | null
  lines: POReceivingLine[]
}

export interface POStatusHistory {
  id: number
  purchaseOrderId: number
  fromStatus?: POStatus | null
  toStatus: POStatus
  changedById?: number | null
  changedBy?: { id: number; name: string } | null
  notes?: string | null
  changedAt: string
}

export interface PurchaseOrder {
  id: number
  quickbooksId?: string | null
  syncToken?: string | null
  lastSyncedAt?: string | null
  poNumber: string
  docNumber?: string | null
  vendorId: number
  vendor: {
    id: number
    displayName: string
    companyName?: string | null
    primaryEmail?: string | null
    primaryPhone?: string | null
    quickbooksId?: string | null
  }
  status: POStatus
  manuallyClosed: boolean
  txnDate: string
  expectedDate?: string | null
  dueDate?: string | null
  shipAddrLine1?: string | null
  shipAddrLine2?: string | null
  shipAddrCity?: string | null
  shipAddrState?: string | null
  shipAddrPostalCode?: string | null
  shipAddrZip?: string | null
  shipAddrCountry?: string | null
  subtotal: number
  taxAmount: number
  shippingAmount: number
  totalAmount: number
  memo?: string | null
  privateNote?: string | null
  createdById?: number | null
  createdBy?: { id: number; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  lines: PurchaseOrderLine[]
  receivings?: POReceiving[]
  statusHistory?: POStatusHistory[]
  _count?: {
    lines: number
    receivings: number
  }
}

export interface PurchaseOrderFormData {
  vendorId: number
  txnDate?: string
  expectedDate?: string
  dueDate?: string
  memo?: string
  privateNote?: string
  shipAddrLine1?: string
  shipAddrLine2?: string
  shipAddrCity?: string
  shipAddrState?: string
  shipAddrPostalCode?: string
  shipAddrCountry?: string
  lines: {
    quickbooksItemId?: number | null
    itemRefId?: string | null
    itemRefName?: string | null
    description?: string
    quantity: number
    unitPrice: number
    notes?: string
  }[]
  pushToQuickBooks?: boolean
}

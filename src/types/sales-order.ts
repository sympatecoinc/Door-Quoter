// Sales Order Types

export type SOStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOIDED'

export const SO_STATUS_CONFIG: Record<SOStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  SENT: { label: 'Sent', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  VIEWED: { label: 'Viewed', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  PARTIAL: { label: 'Partial Payment', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  PAID: { label: 'Paid', color: 'text-green-700', bgColor: 'bg-green-100' },
  OVERDUE: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100' },
  VOIDED: { label: 'Voided', color: 'text-gray-500', bgColor: 'bg-gray-200' }
}

export interface SalesOrderLine {
  id: number
  salesOrderId: number
  lineNum: number
  itemRefId?: string | null
  itemRefName?: string | null
  description?: string | null
  quantity: number
  unitPrice: number
  amount: number
}

export interface SalesOrder {
  id: number
  quickbooksId?: string | null
  syncToken?: string | null
  lastSyncedAt?: string | null
  orderNumber: string
  docNumber?: string | null
  customerId: number
  customer: {
    id: number
    companyName: string
    contactName?: string | null
    email?: string | null
    phone?: string | null
    quickbooksId?: string | null
  }
  projectId?: number | null
  project?: {
    id: number
    name: string
    status: string
  } | null
  status: SOStatus
  txnDate: string
  dueDate?: string | null
  shipDate?: string | null
  billAddrLine1?: string | null
  billAddrLine2?: string | null
  billAddrCity?: string | null
  billAddrState?: string | null
  billAddrPostalCode?: string | null
  billAddrCountry?: string | null
  shipAddrLine1?: string | null
  shipAddrLine2?: string | null
  shipAddrCity?: string | null
  shipAddrState?: string | null
  shipAddrPostalCode?: string | null
  shipAddrCountry?: string | null
  subtotal: number
  taxAmount: number
  totalAmount: number
  balance: number
  customerMemo?: string | null
  privateNote?: string | null
  createdById?: number | null
  createdBy?: { id: number; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  lines: SalesOrderLine[]
  _count?: {
    lines: number
  }
}

export interface SalesOrderFormData {
  customerId: number
  projectId?: number | null
  txnDate?: string
  dueDate?: string
  shipDate?: string
  customerMemo?: string
  privateNote?: string
  billAddrLine1?: string
  billAddrLine2?: string
  billAddrCity?: string
  billAddrState?: string
  billAddrPostalCode?: string
  billAddrCountry?: string
  shipAddrLine1?: string
  shipAddrLine2?: string
  shipAddrCity?: string
  shipAddrState?: string
  shipAddrPostalCode?: string
  shipAddrCountry?: string
  lines: {
    itemRefId?: string | null
    itemRefName?: string | null
    description?: string
    quantity: number
    unitPrice: number
  }[]
  pushToQuickBooks?: boolean
}

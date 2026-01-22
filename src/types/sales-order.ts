// Sales Order Types (LOCAL only - not synced to QuickBooks)

export type SOStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_INVOICED' | 'FULLY_INVOICED' | 'CANCELLED'

// Sales Order Part Status
export type SOPartStatus = 'PENDING' | 'RESERVED' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'CANCELLED'

export const SO_PART_STATUS_CONFIG: Record<SOPartStatus, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pending', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  RESERVED: { label: 'Reserved', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  PICKED: { label: 'Picked', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  PACKED: { label: 'Packed', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  SHIPPED: { label: 'Shipped', color: 'text-green-700', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' }
}

export const SO_STATUS_CONFIG: Record<SOStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  PARTIALLY_INVOICED: { label: 'Partially Invoiced', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  FULLY_INVOICED: { label: 'Fully Invoiced', color: 'text-green-700', bgColor: 'bg-green-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' }
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
  orderNumber: string
  docNumber?: string | null
  quickbooksId?: string | null
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
  balance?: number | null
  customerMemo?: string | null
  privateNote?: string | null
  createdById?: number | null
  createdBy?: { id: number; name: string; email: string } | null
  createdAt: string
  updatedAt: string
  lines: SalesOrderLine[]
  invoices?: { id: number; invoiceNumber: string; status: string; totalAmount: number }[]
  _count?: {
    lines: number
    invoices?: number
  }
}

export interface SalesOrderFormData {
  customerId: number
  projectId?: number | null
  status?: SOStatus
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
}

// Sales Order Part - Individual part from project BOM with fulfillment tracking
export interface SalesOrderPart {
  id: number
  salesOrderId: number
  masterPartId?: number | null
  masterPart?: {
    id: number
    partNumber: string
    baseName: string
    partType: string
    qtyOnHand?: number | null
    qtyReserved: number
    binLocationRef?: { code: string; name: string } | null
  } | null
  partNumber: string
  partName: string
  partType: string
  quantity: number
  unit: string
  cutLength?: number | null
  openingName?: string | null
  productName?: string | null
  status: SOPartStatus
  qtyPicked: number
  qtyPacked: number
  qtyShipped: number
  pickedAt?: string | null
  packedAt?: string | null
  shippedAt?: string | null
  pickedById?: number | null
  pickedBy?: { id: number; name: string } | null
  createdAt: string
  updatedAt: string
}

// Availability check result for a single part
export interface PartAvailability {
  partNumber: string
  partName: string
  required: number
  available: number
  reserved: number
  shortage: number
  masterPartId?: number | null
}

// Confirm order result
export interface ConfirmOrderResult {
  success: boolean
  salesOrder?: SalesOrder
  parts?: SalesOrderPart[]
  availability?: PartAvailability[]
  hasShortages?: boolean
  quickbooksEstimateId?: string | null
  error?: string
}

// Extended SalesOrder with parts
export interface SalesOrderWithParts extends SalesOrder {
  parts: SalesOrderPart[]
}

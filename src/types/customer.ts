// Customer Management Types

export interface Customer {
  id: number
  companyName: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  status: CustomerStatus
  source?: string | null
  notes?: string | null
  quickbooksId?: string | null
  syncToken?: string | null
  lastSyncedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  contacts?: Contact[]
  files?: CustomerFile[]
  salesOrders?: CustomerSalesOrder[]
  invoices?: CustomerInvoice[]
  projects?: CustomerProject[]
  leadCount?: number
  projectCount?: number
}

export interface Contact {
  id: number
  customerId: number
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  title?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomerFile {
  id: number
  customerId: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy?: string | null
  createdAt: Date
}

export interface CustomerSalesOrder {
  id: number
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: Date
}

export interface CustomerInvoice {
  id: number
  invoiceNumber: string
  status: string
  totalAmount: number
  dueDate?: Date | null
  createdAt: Date
}

export interface CustomerProject {
  id: number
  name: string
  status: string
}

// Customer status options
export type CustomerStatus = 'Active' | 'Lead' | 'Archived'

export const CUSTOMER_STATUSES: CustomerStatus[] = ['Active', 'Lead', 'Archived']

export const CUSTOMER_STATUS_CONFIG: Record<CustomerStatus, {
  label: string
  bgColor: string
  textColor: string
}> = {
  Active: {
    label: 'Active',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  Lead: {
    label: 'Lead',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  Archived: {
    label: 'Archived',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600'
  }
}

// Customer source options
export const CUSTOMER_SOURCES = [
  'Referral',
  'Website',
  'Trade Show',
  'Cold Call',
  'Advertisement',
  'Partner',
  'Other'
] as const

export type CustomerSource = typeof CUSTOMER_SOURCES[number]

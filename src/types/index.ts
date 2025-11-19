export enum ProjectStatus {
  STAGING = 'STAGING',
  APPROVED = 'APPROVED',
  REVISE = 'REVISE',
  QUOTE_SENT = 'QUOTE_SENT',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  ACTIVE = 'ACTIVE',
  COMPLETE = 'COMPLETE'
}

export interface Project {
  id: number
  name: string
  status: ProjectStatus
  pricingModeId?: number | null
  extrusionCostingMethod?: string // "FULL_STOCK" | "PERCENTAGE_BASED"
  excludedPartNumbers?: string[] // Part numbers to exclude from FULL_STOCK rule
  createdAt: Date
  updatedAt: Date
}

export interface ProjectStatusHistory {
  id: number
  projectId: number
  status: ProjectStatus
  changedBy?: string
  notes?: string
  changedAt: Date
}

export const STATUS_CONFIG: Record<ProjectStatus, {
  label: string
  color: string
  bgColor: string
  textColor: string
}> = {
  [ProjectStatus.STAGING]: {
    label: 'Staging',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800'
  },
  [ProjectStatus.APPROVED]: {
    label: 'Approved',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800'
  },
  [ProjectStatus.REVISE]: {
    label: 'Revise',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800'
  },
  [ProjectStatus.QUOTE_SENT]: {
    label: 'Quote Sent',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800'
  },
  [ProjectStatus.QUOTE_ACCEPTED]: {
    label: 'Quote Accepted',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800'
  },
  [ProjectStatus.ACTIVE]: {
    label: 'Active',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800'
  },
  [ProjectStatus.COMPLETE]: {
    label: 'Complete',
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-800'
  }
}

// Helper to get display label for a status
export function getStatusLabel(status: ProjectStatus): string {
  return STATUS_CONFIG[status]?.label || status
}

export interface Opening {
  id: number
  projectId: number
  name: string
  roughWidth: number
  roughHeight: number
  finishedWidth: number
  finishedHeight: number
  price: number
  finishColor?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Panel {
  id: number
  openingId: number
  type: string
  width: number
  height: number
  glassType: string
  locking: string
  swingDirection: string
  createdAt: Date
  updatedAt: Date
}

export interface Product {
  id: number
  name: string
  description?: string
  type: string
  withTrim: string
  createdAt: Date
  updatedAt: Date
}

export interface SubOptionCategory {
  id: number
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface IndividualOption {
  id: number
  categoryId: number
  name: string
  description?: string
  price: number
  createdAt: Date
  updatedAt: Date
}

export interface BOM {
  id: number
  projectId: number
  materialType: string
  partName: string
  quantity: number
  unit: string
  createdAt: Date
  updatedAt: Date
}

export interface ProductBOM {
  id: number
  productId: number
  partType: string
  partName: string
  description?: string
  formula?: string
  variable?: string
  unit?: string
  quantity?: number
  stockLength?: number
  partNumber?: string
  cost?: number
  createdAt: Date
  updatedAt: Date
}

export interface ComponentInstance {
  id: number
  panelId: number
  productId: number
  subOptionSelections: Record<string, number | null>
  createdAt: Date
  updatedAt: Date
}

export type MenuOption = 'dashboard' | 'projects' | 'products' | 'componentLibrary' | 'masterParts' | 'accounting' | 'settings' | 'quote' | 'quoteDocuments'

export interface PricingMode {
  id: number
  name: string
  description?: string
  isDefault: boolean
  markup: number
  extrusionMarkup: number
  hardwareMarkup: number
  glassMarkup: number
  discount: number
  createdAt: Date
  updatedAt: Date
}
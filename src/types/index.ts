export interface Project {
  id: number
  name: string
  status: string
  pricingModeId?: number | null
  extrusionCostingMethod?: string // "FULL_STOCK" | "PERCENTAGE_BASED"
  excludedPartNumbers?: string[] // Part numbers to exclude from FULL_STOCK rule
  createdAt: Date
  updatedAt: Date
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

export type MenuOption = 'dashboard' | 'projects' | 'crm' | 'products' | 'componentLibrary' | 'masterParts' | 'accounting' | 'settings' | 'quote' | 'quoteDocuments'

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
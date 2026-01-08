export enum ProjectStatus {
  STAGING = 'STAGING',
  APPROVED = 'APPROVED',
  REVISE = 'REVISE',
  QUOTE_SENT = 'QUOTE_SENT',
  QUOTE_ACCEPTED = 'QUOTE_ACCEPTED',
  ACTIVE = 'ACTIVE',
  COMPLETE = 'COMPLETE',
  ARCHIVE = 'ARCHIVE'
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
  },
  [ProjectStatus.ARCHIVE]: {
    label: 'Archive',
    color: 'slate',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-800'
  }
}

// Helper to get display label for a status
export function getStatusLabel(status: ProjectStatus): string {
  return STATUS_CONFIG[status]?.label || status
}

// Lead phase statuses (pre-acceptance)
export const LEAD_STATUSES: ProjectStatus[] = [
  ProjectStatus.STAGING,
  ProjectStatus.APPROVED,
  ProjectStatus.REVISE,
  ProjectStatus.QUOTE_SENT
]

// Lead filter statuses (includes Archive for filtering)
export const LEAD_FILTER_STATUSES: ProjectStatus[] = [
  ProjectStatus.STAGING,
  ProjectStatus.APPROVED,
  ProjectStatus.REVISE,
  ProjectStatus.QUOTE_SENT,
  ProjectStatus.ARCHIVE
]

// Project phase statuses (post-acceptance / "Won")
export const PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE
]

// Project filter statuses (includes Archive for filtering)
export const PROJECT_FILTER_STATUSES: ProjectStatus[] = [
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE,
  ProjectStatus.ARCHIVE
]

// Helper to check if a status is in lead phase
export function isLeadStatus(status: ProjectStatus): boolean {
  return LEAD_STATUSES.includes(status)
}

// Helper to check if a status is in project phase
export function isProjectStatus(status: ProjectStatus): boolean {
  return PROJECT_STATUSES.includes(status)
}

// Opening Type enum for finished opening tolerances
export type OpeningType = 'THINWALL' | 'FRAMED'

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
  // Finished Opening Tolerance Fields
  isFinishedOpening?: boolean
  openingType?: OpeningType | null
  widthToleranceTotal?: number | null
  heightToleranceTotal?: number | null
  createdAt: Date
  updatedAt: Date
}

// Tolerance Settings for finished openings
export interface ToleranceSettings {
  id?: number
  name?: string
  thinwallWidthTolerance: number
  thinwallHeightTolerance: number
  framedWidthTolerance: number
  framedHeightTolerance: number
  createdAt?: Date
  updatedAt?: Date
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
  productType?: string
  archived?: boolean
  glassWidthFormula?: string
  glassHeightFormula?: string
  glassQuantityFormula?: string
  installationPrice?: number
  minWidth?: number | null
  maxWidth?: number | null
  minHeight?: number | null
  maxHeight?: number | null
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

export type MenuOption = 'dashboard' | 'projects' | 'products' | 'componentLibrary' | 'masterParts' | 'inventory' | 'vendors' | 'purchaseOrders' | 'salesOrders' | 'invoices' | 'accounting' | 'settings' | 'quote' | 'quoteDocuments'

// Vendor Management Types
export interface Vendor {
  id: number
  quickbooksId?: string | null
  syncToken?: string | null
  lastSyncedAt?: Date | null
  displayName: string
  companyName?: string | null
  givenName?: string | null
  familyName?: string | null
  printOnCheckName?: string | null
  primaryEmail?: string | null
  primaryPhone?: string | null
  alternatePhone?: string | null
  mobile?: string | null
  fax?: string | null
  website?: string | null
  billAddressLine1?: string | null
  billAddressLine2?: string | null
  billAddressCity?: string | null
  billAddressState?: string | null
  billAddressZip?: string | null
  billAddressCountry?: string | null
  taxIdentifier?: string | null
  acctNum?: string | null
  vendor1099: boolean
  balance?: number | null
  termRefId?: string | null
  termRefName?: string | null
  notes?: string | null
  category?: string | null
  code?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  contacts?: VendorContact[]
}

export interface VendorContact {
  id: number
  vendorId: number
  name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  isPrimary: boolean
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export const VENDOR_CATEGORIES = [
  'Aluminum',
  'Hardware',
  'Glass',
  'Finishing',
  'Packaging',
  'Shipping',
  'Other'
] as const

export type VendorCategory = typeof VENDOR_CATEGORIES[number]

export interface PricingMode {
  id: number
  name: string
  description?: string
  isDefault: boolean
  markup: number
  extrusionMarkup: number
  hardwareMarkup: number
  glassMarkup: number
  packagingMarkup: number
  discount: number
  extrusionCostingMethod: 'FULL_STOCK' | 'PERCENTAGE_BASED' | 'HYBRID'
  createdAt: Date
  updatedAt: Date
}

// User Profiles and Authentication Types
export interface Profile {
  id: number
  name: string
  description?: string | null
  tabs: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count?: {
    users: number
  }
}

export interface TabOverrides {
  add: string[]
  remove: string[]
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER'

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  isActive: boolean
  permissions: string[]
  profileId?: number | null
  profile?: Profile | null
  tabOverrides?: string
  effectivePermissions?: string[]
  createdAt: Date
  updatedAt: Date
}

// Extrusion Finish Pricing
export interface ExtrusionFinishPricing {
  id: number
  finishType: string
  finishCode: string | null
  costPerFoot: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Extrusion Variant - Track inventory by length and color
export interface ExtrusionVariant {
  id: number
  masterPartId: number
  stockLength: number
  finishPricingId: number | null
  qtyOnHand: number
  binLocationLegacy: string | null  // Legacy string field (deprecated)
  binLocationId: number | null
  binLocationRef?: BinLocation | null
  reorderPoint: number | null
  reorderQty: number | null
  pricePerPiece: number | null
  isActive: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
  finishPricing?: ExtrusionFinishPricing | null
  masterPart?: MasterPart
}

// MasterPart type (simplified for extrusion variant use)
export interface MasterPart {
  id: number
  partNumber: string
  baseName: string
  description: string | null
  partType: string
  unit: string | null
  cost: number | null
  weightPerFoot?: number | null
  customPricePerLb?: number | null
  isMillFinish?: boolean
}

// Extrusion Variant Group - Groups variants by extrusion profile
export interface ExtrusionVariantGroup {
  masterPart: Pick<MasterPart, 'id' | 'partNumber' | 'baseName' | 'description' | 'weightPerFoot' | 'customPricePerLb' | 'isMillFinish'>
  variants: ExtrusionVariantDisplay[]
  lengths: number[]
  finishes: FinishOption[]
}

// Extended variant with computed display fields
export interface ExtrusionVariantDisplay extends ExtrusionVariant {
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
  displayName: string
}

// Finish option for dropdown/selection
export interface FinishOption {
  id: number | null
  name: string
  code: string | null
}

// Global Application Settings
export interface GlobalSetting {
  id: number
  key: string
  value: string
  dataType: 'string' | 'number' | 'boolean' | 'json'
  category?: string | null
  description?: string | null
  createdAt: Date
  updatedAt: Date
}

// Bin Location exports
export * from './bin-location'
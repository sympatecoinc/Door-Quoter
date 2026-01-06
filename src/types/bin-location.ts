// Bin Location Types

export interface BinLocation {
  id: number
  code: string
  name: string
  description: string | null
  accessToken: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count?: {
    masterParts: number
    extrusionVariants: number
  }
}

export interface BinLocationWithItems extends BinLocation {
  masterParts: MasterPartSummary[]
  extrusionVariants: ExtrusionVariantSummary[]
}

export interface MasterPartSummary {
  id: number
  partNumber: string
  baseName: string
  partType: string
  qtyOnHand: number | null
}

export interface ExtrusionVariantSummary {
  id: number
  masterPart: {
    partNumber: string
    baseName: string
  }
  stockLength: number
  finishPricing: {
    finishType: string
  } | null
  qtyOnHand: number
}

// For inventory adjustments via scan
export interface InventoryAdjustment {
  type: 'masterPart' | 'extrusion'
  id: number
  adjustment: number  // positive for add, negative for subtract
}

export interface AdjustmentResult {
  type: 'masterPart' | 'extrusion'
  id: number
  partNumber: string
  name: string
  previousQty: number
  newQty: number
  adjustment: number
}

// API Response types
export interface BinLocationsListResponse {
  binLocations: BinLocation[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface BinLocationItemsResponse {
  binLocation: BinLocation
  masterParts: MasterPartSummary[]
  extrusionVariants: ExtrusionVariantSummary[]
}

export interface ScanBinResponse {
  binLocation: {
    id: number
    code: string
    name: string
    description: string | null
  }
}

export interface AdjustInventoryResponse {
  success: boolean
  adjustments: AdjustmentResult[]
}

// Search result for scan page
export interface SearchItem {
  type: 'masterPart' | 'extrusion'
  id: number
  partNumber: string
  name: string
  description: string | null
  qtyOnHand: number
  unit?: string | null
  // For extrusion variants
  stockLength?: number
  finishType?: string | null
}

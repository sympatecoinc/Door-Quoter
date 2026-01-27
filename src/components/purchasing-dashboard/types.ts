// Purchasing Dashboard Types

export type DateRange = 30 | 60 | 90

export type DashboardTab = 'overview' | 'orders' | 'vendors' | 'pricing' | 'stock'

// Inventory Alerts
export type AlertUrgency = 'critical' | 'low' | 'projected' | 'healthy'

// Demand source - shows where demand is coming from
export interface DemandSource {
  type: 'reserved' | 'projected'
  projectId: number
  projectName: string
  projectStatus: string
  quantity: number
  shipDate: string | null
}

export interface InventoryAlert {
  partId: number
  partNumber: string
  description: string | null
  qtyOnHand: number
  qtyReserved: number           // From confirmed SOs
  projectedDemand: number       // From pipeline projects
  availableQty: number          // onHand - reserved - projected
  shortage: number              // max(0, -availableQty)
  reorderPoint: number | null
  reorderQty: number | null
  urgency: AlertUrgency
  vendorId: number | null
  vendorName: string | null
  category: string | null
  demandSources: DemandSource[] // Breakdown of where demand comes from
  // Extrusion variant details (optional - only for extrusion parts)
  color: string | null          // Finish type (e.g., "Mill Finish", "Black", "Clear Anodized")
  stockLength: number | null    // Stock length in inches (e.g., 144 = 12ft)
  variantId: number | null      // ExtrusionVariant ID if this alert is for a specific variant
}

export interface InventoryAlertsResponse {
  alerts: InventoryAlert[]
  summary: {
    critical: number
    low: number
    projected: number
    healthy: number
    total: number
  }
}

// Projected Demand Types
export interface ProjectedDemandItem {
  partId: number
  partNumber: string
  description: string | null
  projectedQty: number
  projects: Array<{
    id: number
    name: string
    status: string
    quantity: number
    shipDate: string | null
  }>
}

export interface ProjectedDemandResponse {
  items: ProjectedDemandItem[]
  totalParts: number
}

// Quick PO Types
export interface QuickPORequest {
  masterPartId: number
  quantity: number
  vendorId?: number
  notes?: string
}

export interface QuickPOResponse {
  purchaseOrder: {
    id: number
    poNumber: string
    vendorId: number
    vendorName: string
    status: string
    totalAmount: number
  }
  warning?: string
}

// Add to Existing PO Types
export interface AddToExistingPORequest {
  masterPartId: number
  quantity: number
  notes?: string
}

export interface AddToExistingPOResponse {
  purchaseOrder: {
    id: number
    poNumber: string
    vendorId: number
    vendorName: string
    status: string
    totalAmount: number
  }
  addedLine: {
    id: number
    partNumber: string
    quantity: number
    unitPrice: number
    amount: number
  }
}

// Draft PO for selection
export interface DraftPO {
  id: number
  poNumber: string
  vendorName: string
  totalAmount: number
  lineCount: number
  createdAt: string
}

// Vendor Scorecard
export interface VendorMetrics {
  id: number
  displayName: string
  metrics: {
    totalPOs: number
    completedPOs: number
    onTimeDeliveryRate: number | null
    avgLeadTimeDays: number | null
    totalValue: number
  }
}

export interface VendorMetricsResponse {
  vendors: VendorMetrics[]
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

// MRP (Material Requirements Planning)
export interface MRPProject {
  id: number
  name: string
  qty: number
  type?: 'project' | 'salesOrder'
}

export interface MRPRequirement {
  partId: number
  partNumber: string
  description: string | null
  partType: string
  requiredQty: number
  onHandQty: number
  onOrderQty: number
  gap: number
  neededByDate: string | null
  projects: MRPProject[]
}

export interface MRPResponse {
  requirements: MRPRequirement[]
  summary: {
    totalItems: number
    shortages: number
    adequate: number
  }
}

// Stock Optimization (Extrusions)
export interface ProfileSummary {
  profileType: string
  totalStock: number
  lowStockCount: number
  variants: number
}

export interface FastBurningProfile {
  partNumber: string
  description: string | null
  consumption30Days: number
  currentStock: number
}

export interface StockMetricsResponse {
  profileSummary: ProfileSummary[]
  fastBurning: FastBurningProfile[]
  wasteMetrics: {
    totalWaste: number | null
    avgWastePercent: number | null
  }
}

// Price Tracking
export interface PriceAlert {
  id: number
  vendorName: string
  partNumber: string | null
  itemDescription: string | null
  previousPrice: number
  currentPrice: number
  percentChange: number
  effectiveDate: string
}

export interface VendorPriceComparison {
  partNumber: string
  description: string | null
  vendors: Array<{
    vendorId: number
    vendorName: string
    price: number
    lastUpdated: string
  }>
}

export interface PriceHistoryResponse {
  priceAlerts: PriceAlert[]
  vendorComparison: VendorPriceComparison[]
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

// Receiving Queue
export interface ReceivingPO {
  poId: number
  poNumber: string
  vendorName: string
  expectedDate: string
  totalAmount: number
  status: string
  lineCount: number
  daysUntilDue: number
}

export interface ReceivingQueueResponse {
  today: ReceivingPO[]
  upcoming: ReceivingPO[]
  overdue: ReceivingPO[]
  summary: {
    todayCount: number
    upcomingCount: number
    overdueCount: number
    overdueValue: number
  }
}

// Spend Analytics
export interface SpendByVendor {
  vendorId: number
  vendorName: string
  amount: number
  poCount: number
}

export interface SpendByCategory {
  category: string
  amount: number
}

export interface MonthlySpend {
  month: string
  amount: number
}

export interface SpendAnalyticsResponse {
  byVendor: SpendByVendor[]
  byCategory: SpendByCategory[]
  monthlyTrend: MonthlySpend[]
  ytdTotal: number
  periodTotal: number
  period: {
    days: number
    startDate: string
    endDate: string
  }
}

// Open Orders Summary
export interface AtRiskOrder {
  poId: number
  poNumber: string
  vendorName: string
  vendorEmail: string | null
  expectedDate: string | null
  daysLate: number
  totalAmount: number
}

export interface OpenOrdersSummaryResponse {
  totalOutstanding: number
  counts: {
    draft: number
    sent: number
    acknowledged: number
    partial: number
    onHold: number
    complete: number
    cancelled: number
  }
  atRiskOrders: AtRiskOrder[]
}

// Vendor Communication (placeholder)
export interface VendorContact {
  id: number
  vendorId: number
  vendorName: string
  contactName: string | null
  email: string | null
  phone: string | null
}

export interface VendorCommunicationResponse {
  contacts: VendorContact[]
  gmailIntegration: {
    enabled: boolean
    message: string
  }
}

// Combined Purchase Summary
export interface CombinedSummaryProject {
  id: number
  name: string
  customerName: string
}

export interface CombinedSummaryItem {
  partNumber: string
  partName: string
  partType: string
  totalQuantity: number
  unit: string
  stockLength: number | null
  cutLengths: number[]
  totalCutLength: number
  calculatedLengths: number[]
  totalCalculatedLength: number
  glassDimensions: Array<{ width: number | null; height: number | null; area: number | null }>
  totalArea: number
  glassWidth: number | null
  glassHeight: number | null
  calculatedLength: number | null
  stockPiecesNeeded: number | null
  wastePercent: number | null
  // Multi-stock optimization: breakdown of stock lengths used, e.g., {99: 2, 123: 1}
  stockLengthBreakdown?: Record<number, number> | null
}

export interface CombinedSummaryResponse {
  projects: CombinedSummaryProject[]
  summaryItems: CombinedSummaryItem[]
  totals: {
    totalParts: number
    totalExtrusions: number
    totalHardware: number
    totalGlass: number
    totalOptions: number
    totalStockPiecesToOrder: number
  }
}

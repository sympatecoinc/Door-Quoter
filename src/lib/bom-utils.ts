// BOM Utility Functions
// Extracted from route.ts for better testability

// Saw blade kerf width in inches (material lost per cut)
export const KERF_WIDTH = 0.125

// Bin-packing function to calculate optimal stock pieces needed
// Uses First-Fit Decreasing algorithm with kerf consideration
export function calculateOptimizedStockPieces(
  cutLengths: number[],
  stockLength: number,
  kerf: number = KERF_WIDTH
): { stockPiecesNeeded: number; totalStockLength: number; wasteLength: number; wastePercent: number } {
  if (cutLengths.length === 0 || stockLength <= 0) {
    return { stockPiecesNeeded: 0, totalStockLength: 0, wasteLength: 0, wastePercent: 0 }
  }

  // Sort cuts by length descending for first-fit decreasing
  const sortedCuts = [...cutLengths].sort((a, b) => b - a)

  // Check for cuts that exceed stock length
  const oversizedCuts = sortedCuts.filter(cut => cut > stockLength)
  if (oversizedCuts.length > 0) {
    // Each oversized cut needs its own stock piece (error case, but handle gracefully)
    console.warn(`Warning: ${oversizedCuts.length} cuts exceed stock length of ${stockLength}"`)
  }

  // bins array holds remaining usable length in each stock piece
  const bins: number[] = []

  for (const cut of sortedCuts) {
    let placed = false

    // Try to fit in existing bin (accounting for kerf on subsequent cuts in same bin)
    for (let i = 0; i < bins.length; i++) {
      // Need cut length + kerf (except we already accounted for kerf when placing previous cuts)
      if (bins[i] >= cut) {
        bins[i] -= (cut + kerf)  // Subtract cut and kerf for next potential cut
        placed = true
        break
      }
    }

    // If doesn't fit anywhere, open new stock piece
    if (!placed) {
      // New bin starts with stock length, subtract the cut and kerf
      bins.push(stockLength - cut - kerf)
    }
  }

  const stockPiecesNeeded = bins.length
  const totalStockLength = stockPiecesNeeded * stockLength
  const totalCutLength = cutLengths.reduce((sum, cut) => sum + cut, 0)
  const wasteLength = totalStockLength - totalCutLength
  const wastePercent = totalStockLength > 0 ? (wasteLength / totalStockLength) * 100 : 0

  return {
    stockPiecesNeeded,
    totalStockLength,
    wasteLength,
    wastePercent: Math.round(wastePercent * 10) / 10  // Round to 1 decimal place
  }
}

// Function to evaluate simple formulas for cut lengths
export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      // Case-insensitive variable replacement
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, value.toString())
    }

    if (!expression || expression.trim() === '') {
      return 0
    }

    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    console.error('Formula evaluation error for formula:', formula, 'error:', error)
    return 0
  }
}

// Type definitions for BOM items
export interface BomItem {
  partNumber: string
  partName: string
  partType: string
  quantity?: number
  unit: string
  stockLength?: number | null
  cutLength?: number | null
  calculatedLength?: number | null
  glassWidth?: number | null
  glassHeight?: number | null
  glassArea?: number | null
}

export interface AggregatedBomItem {
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
  stockPiecesNeeded: number | null
  wastePercent: number | null
}

// Helper function to aggregate BOM items for purchasing summary
export function aggregateBomItems(bomItems: BomItem[]): AggregatedBomItem[] {
  const aggregated: Record<string, AggregatedBomItem> = {}

  for (const item of bomItems) {
    // For glass, group by part number AND dimensions to get separate rows per size
    let key = item.partNumber
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      key = `${item.partNumber}|${item.glassWidth.toFixed(2)}x${item.glassHeight.toFixed(2)}`
    }

    if (!aggregated[key]) {
      aggregated[key] = {
        partNumber: item.partNumber,
        partName: item.partName,
        partType: item.partType,
        totalQuantity: 0,
        unit: item.unit,
        stockLength: item.stockLength ?? null,
        cutLengths: [],
        totalCutLength: 0,
        calculatedLengths: [],  // For Hardware/Fastener items with LF/IN units
        totalCalculatedLength: 0,
        glassDimensions: [],
        totalArea: 0,
        // Glass size fields (for unique glass sizes)
        glassWidth: item.partType === 'Glass' ? (item.glassWidth ?? null) : null,
        glassHeight: item.partType === 'Glass' ? (item.glassHeight ?? null) : null,
        // Stock optimization fields (for extrusions)
        stockPiecesNeeded: null,
        wastePercent: null
      }
    }

    aggregated[key].totalQuantity += item.quantity || 1

    // For extrusions, collect cut lengths
    if (item.partType === 'Extrusion' && item.cutLength) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        aggregated[key].cutLengths.push(item.cutLength)
      }
      aggregated[key].totalCutLength += (item.cutLength * (item.quantity || 1))
    }

    // For glass, collect dimensions and area
    if (item.partType === 'Glass') {
      aggregated[key].glassDimensions.push({
        width: item.glassWidth ?? null,
        height: item.glassHeight ?? null,
        area: item.glassArea ?? null
      })
      aggregated[key].totalArea += item.glassArea || 0
    }

    // For Hardware/Fastener with LF or IN units, collect calculated lengths
    if ((item.partType === 'Hardware' || item.partType === 'Fastener') &&
        (item.unit === 'LF' || item.unit === 'IN') &&
        item.calculatedLength) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        aggregated[key].calculatedLengths.push(item.calculatedLength)
      }
      aggregated[key].totalCalculatedLength += (item.calculatedLength * (item.quantity || 1))
    }
  }

  // Calculate stock optimization for extrusions
  for (const item of Object.values(aggregated)) {
    if (item.partType === 'Extrusion' && item.stockLength && item.cutLengths.length > 0) {
      const optimization = calculateOptimizedStockPieces(item.cutLengths, item.stockLength)
      item.stockPiecesNeeded = optimization.stockPiecesNeeded
      item.wastePercent = optimization.wastePercent
    }
  }

  // Sort by part type then part number
  const typeOrder: Record<string, number> = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
  return Object.values(aggregated).sort((a, b) => {
    const aOrder = typeOrder[a.partType] || 5
    const bOrder = typeOrder[b.partType] || 5
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.partNumber.localeCompare(b.partNumber)
  })
}

// Panel type for frame dimension calculations
export interface PanelForFrameCalc {
  id: number
  width?: number
  height?: number
  componentInstance?: {
    product?: {
      productType?: string
    }
  }
}

// Calculate Frame dimensions from sibling panels in the same opening.
// Frame width = sum of sibling widths, height = max sibling height
export function getFrameDimensions(
  panels: PanelForFrameCalc[],
  currentPanelId: number
): { width: number; height: number } {
  // Get all panels except the current frame panel and other frame panels
  const siblingPanels = panels.filter(p =>
    p.id !== currentPanelId &&
    p.componentInstance?.product?.productType !== 'FRAME'
  )

  if (siblingPanels.length === 0) {
    return { width: 0, height: 0 }
  }

  // Frame width = sum of sibling widths, height = max sibling height
  const width = siblingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
  const height = Math.max(...siblingPanels.map(p => p.height || 0))

  return { width, height }
}

// BOM item type for part length calculation
export interface BOMForPartLength {
  formula?: string
  quantity?: number
  partType?: string
}

// Calculate required part length from formula.
export function calculateRequiredPartLength(
  bom: BOMForPartLength,
  variables: Record<string, number>
): number {
  if (bom.formula) {
    try {
      return evaluateFormula(bom.formula, variables)
    } catch (error) {
      console.error('Error evaluating part length formula:', error)
      return 0
    }
  }

  // For extrusions without formulas, try to use a reasonable default based on component size
  if (bom.partType === 'Extrusion') {
    return Math.max(variables.width || 0, variables.height || 0)
  }

  return bom.quantity || 0
}

// Stock length rule type
export interface StockLengthRule {
  isActive: boolean
  minHeight?: number | null
  maxHeight?: number | null
  stockLength?: number | null
}

// Find best stock length rule based on calculated part length.
// Returns the most specific matching rule.
export function findBestStockLengthRule(
  rules: StockLengthRule[],
  requiredLength: number
): StockLengthRule | null {
  const applicableRules = rules.filter(rule => {
    const matchesLength = (rule.minHeight === null || rule.minHeight === undefined || requiredLength >= rule.minHeight) &&
                         (rule.maxHeight === null || rule.maxHeight === undefined || requiredLength <= rule.maxHeight)
    return rule.isActive && matchesLength
  })

  // Return the rule with the most restrictive constraints (most specific)
  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null && a.minHeight !== undefined ? 1 : 0) +
                         (a.maxHeight !== null && a.maxHeight !== undefined ? 1 : 0)
    const bSpecificity = (b.minHeight !== null && b.minHeight !== undefined ? 1 : 0) +
                         (b.maxHeight !== null && b.maxHeight !== undefined ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
}

// BOM item for cut list aggregation (extrusions only)
export interface BOMItemForCutList {
  partNumber: string
  partName?: string
  partType: string
  quantity?: number
  cutLength?: number | null
  stockLength?: number | null
  productName?: string
  panelId?: number
  panelWidth?: number
  panelHeight?: number
  color?: string
}

// Aggregated cut list item result
export interface AggregatedCutListItem {
  productName?: string
  panelWidth?: number
  panelHeight?: number
  sizeKey: string
  partNumber: string
  partName?: string
  stockLength?: number | null
  cutLength?: number | null
  qtyPerUnit: number
  unitCount: number
  totalQty: number
  color?: string
}

// Aggregate BOM items for cut list (extrusions only, grouped by product + size + cut length).
export function aggregateCutListItems(bomItems: BOMItemForCutList[]): AggregatedCutListItem[] {
  // Filter to extrusions only
  const extrusions = bomItems.filter(item => item.partType === 'Extrusion')

  // First, count unique panels per product+size combination
  const panelCounts: Record<string, Set<number>> = {}
  for (const item of extrusions) {
    const productSizeKey = `${item.productName}|${item.panelWidth}x${item.panelHeight}`
    if (!panelCounts[productSizeKey]) {
      panelCounts[productSizeKey] = new Set()
    }
    if (item.panelId !== undefined) {
      panelCounts[productSizeKey].add(item.panelId)
    }
  }

  // First pass: Calculate qty per unit for each panel
  const perPanelQty: Record<string, Record<number, number>> = {}

  for (const item of extrusions) {
    const sizeKey = `${item.panelWidth}x${item.panelHeight}`
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(2) : 'none'
    const key = `${item.productName}|${sizeKey}|${item.partNumber}|${cutLengthKey}`
    const itemQty = item.quantity || 1

    if (!perPanelQty[key]) {
      perPanelQty[key] = {}
    }
    if (item.panelId !== undefined) {
      if (!perPanelQty[key][item.panelId]) {
        perPanelQty[key][item.panelId] = 0
      }
      perPanelQty[key][item.panelId] += itemQty
    }
  }

  // Second pass: Build aggregated results using first panel's qty as qtyPerUnit
  const aggregated: Record<string, AggregatedCutListItem> = {}

  for (const item of extrusions) {
    const sizeKey = `${item.panelWidth}x${item.panelHeight}`
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(2) : 'none'
    const key = `${item.productName}|${sizeKey}|${item.partNumber}|${cutLengthKey}`
    const productSizeKey = `${item.productName}|${sizeKey}`

    if (!aggregated[key]) {
      const unitCount = panelCounts[productSizeKey]?.size || 1
      const panelQtys = perPanelQty[key]
      const firstPanelId = Object.keys(panelQtys)[0]
      const qtyPerUnit = panelQtys[parseInt(firstPanelId)] || (item.quantity || 1)

      aggregated[key] = {
        productName: item.productName,
        panelWidth: item.panelWidth,
        panelHeight: item.panelHeight,
        sizeKey: sizeKey,
        partNumber: item.partNumber,
        partName: item.partName,
        stockLength: item.stockLength,
        cutLength: item.cutLength,
        qtyPerUnit: qtyPerUnit,
        unitCount: unitCount,
        totalQty: qtyPerUnit * unitCount,
        color: item.color
      }
    }
  }

  // Sort by product name, then size, then part number, then cut length
  return Object.values(aggregated).sort((a, b) => {
    if ((a.productName || '') !== (b.productName || '')) return (a.productName || '').localeCompare(b.productName || '')
    if (a.sizeKey !== b.sizeKey) return a.sizeKey.localeCompare(b.sizeKey)
    if (a.partNumber !== b.partNumber) return a.partNumber.localeCompare(b.partNumber)
    return (a.cutLength || 0) - (b.cutLength || 0)
  })
}

// Stock optimization result
export interface StockOptimizationResult {
  partNumber: string
  partName?: string
  stockLength: number
  totalCuts: number
  stockPiecesNeeded: number
  totalStockLength: number
  totalCutLength: number
  wasteLength: number
  wastePercent: number
}

// Calculate stock optimization for cut list.
export function calculateStockOptimization(cutListItems: AggregatedCutListItem[]): StockOptimizationResult[] {
  const optimizations: StockOptimizationResult[] = []

  // Group by part number and stock length
  const grouped: Record<string, AggregatedCutListItem[]> = {}
  for (const item of cutListItems) {
    if (item.stockLength && item.cutLength) {
      const key = `${item.partNumber}|${item.stockLength}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    }
  }

  for (const [key, items] of Object.entries(grouped)) {
    const [partNumber, stockLengthStr] = key.split('|')
    const stockLength = parseFloat(stockLengthStr)

    let totalCuts = 0
    const allCuts: number[] = []

    for (const item of items) {
      totalCuts += item.totalQty
      for (let i = 0; i < item.totalQty; i++) {
        if (item.cutLength) {
          allCuts.push(item.cutLength)
        }
      }
    }

    const optimization = calculateOptimizedStockPieces(allCuts, stockLength)

    optimizations.push({
      partNumber,
      partName: items[0].partName,
      stockLength,
      totalCuts,
      stockPiecesNeeded: optimization.stockPiecesNeeded,
      totalStockLength: optimization.totalStockLength,
      totalCutLength: allCuts.reduce((sum, cut) => sum + cut, 0),
      wasteLength: optimization.wasteLength,
      wastePercent: optimization.wastePercent
    })
  }

  return optimizations.sort((a, b) => a.partNumber.localeCompare(b.partNumber))
}

// Batch information for cut list CSV
export interface BatchInfo {
  totalUnits: number
  batchSize: number
  remainder: number
  remainderItems?: AggregatedCutListItem[]
}

// Convert cut list to CSV format.
export function cutlistToCSV(
  projectName: string,
  cutListItems: AggregatedCutListItem[],
  batchInfo?: BatchInfo
): string {
  const headers = ['Product', 'Size (WxH)', 'Part Number', 'Part Name', 'Stock Length', 'Cut Length', 'Qty Per Unit', 'Unit Count', 'Total Qty', 'Color']

  const rows = cutListItems.map(item => {
    return [
      item.productName || '',
      `${item.panelWidth}"x${item.panelHeight}"`,
      item.partNumber,
      item.partName || '',
      item.stockLength || '',
      item.cutLength ? item.cutLength.toFixed(2) : '',
      item.qtyPerUnit,
      item.unitCount,
      item.totalQty,
      item.color || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)
  })

  let csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

  if (batchInfo) {
    csv += '\n\n'
    csv += '"--- BATCH INFORMATION ---"\n'
    csv += `"Total Units:",${batchInfo.totalUnits}\n`
    csv += `"Batch Size:",${batchInfo.batchSize}\n`
    csv += `"Full Batches:",${Math.floor(batchInfo.totalUnits / batchInfo.batchSize)}\n`

    if (batchInfo.remainder > 0) {
      csv += `"Remainder Units:",${batchInfo.remainder}\n`
      csv += '\n"--- REMAINDER CUT LIST (Last Batch) ---"\n'
      csv += headers.join(',') + '\n'

      if (batchInfo.remainderItems) {
        for (const item of batchInfo.remainderItems) {
          const remainderRow = [
            item.productName || '',
            `${item.panelWidth}"x${item.panelHeight}"`,
            item.partNumber,
            item.partName || '',
            item.stockLength || '',
            item.cutLength ? item.cutLength.toFixed(2) : '',
            item.qtyPerUnit,
            item.unitCount,
            item.totalQty,
            item.color || ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`)
          csv += remainderRow.join(',') + '\n'
        }
      }
    } else {
      csv += '"Remainder Units:","None - batches divide evenly"\n'
    }
  }

  return csv
}

// Helper function to convert summary to CSV
export function summaryToCSV(projectName: string, summaryItems: AggregatedBomItem[]): string {
  const headers = ['Part Number', 'Part Name', 'Type', 'Size (WxH)', 'Pieces', 'Unit', 'Stock Length', 'Stock Pieces to Order', 'Waste %', 'Area (SQ FT)']

  const rows = summaryItems.map(item => {
    // For glass, show the specific size; for extrusions, show cut lengths; for hardware with LF/IN, show calculated lengths
    let sizeStr = ''
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      sizeStr = `${item.glassWidth.toFixed(2)}" x ${item.glassHeight.toFixed(2)}"`
    } else if (item.cutLengths && item.cutLengths.length > 0) {
      // For extrusions, show unique cut lengths
      const uniqueCuts = [...new Set(item.cutLengths.map((l: number) => l.toFixed(2)))]
      sizeStr = uniqueCuts.join('; ')
    } else if ((item.partType === 'Hardware' || item.partType === 'Fastener') &&
               (item.unit === 'LF' || item.unit === 'IN') &&
               item.totalCalculatedLength) {
      // For hardware/fastener with LF/IN units, show total calculated length
      sizeStr = `${item.totalCalculatedLength.toFixed(2)} ${item.unit}`
    }

    // Calculate area for glass
    let areaStr = ''
    if (item.partType === 'Glass' && item.totalArea) {
      areaStr = item.totalArea.toFixed(2)
    }

    return [
      item.partNumber,
      item.partName,
      item.partType,
      sizeStr,
      item.totalQuantity,
      item.unit,
      item.stockLength || '',
      item.stockPiecesNeeded !== null ? item.stockPiecesNeeded : '',
      item.wastePercent !== null ? `${item.wastePercent}%` : '',
      areaStr
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

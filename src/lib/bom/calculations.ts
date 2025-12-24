// BOM Calculation Functions
// Extracted from /src/app/api/projects/[id]/bom/route.ts for testability

// Saw blade kerf width in inches (material lost per cut)
export const KERF_WIDTH = 0.125

export interface StockOptimizationResult {
  stockPiecesNeeded: number
  totalStockLength: number
  wasteLength: number
  wastePercent: number
}

export interface FrameDimensions {
  width: number
  height: number
}

export interface Panel {
  id: number
  width?: number
  height?: number
  componentInstance?: {
    product?: {
      productType?: string
    }
  }
}

export interface StockLengthRule {
  isActive: boolean
  minHeight: number | null
  maxHeight: number | null
  stockLength: number | null
}

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
  productName?: string
  panelWidth?: number
  panelHeight?: number
  panelId?: number
  color?: string
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

export interface CutListItem {
  productName: string
  panelWidth: number
  panelHeight: number
  sizeKey: string
  partNumber: string
  partName: string
  stockLength: number | null
  cutLength: number | null
  qtyPerUnit: number
  unitCount: number
  totalQty: number
  color: string
}

/**
 * Bin-packing function to calculate optimal stock pieces needed
 * Uses First-Fit Decreasing algorithm with kerf consideration
 */
export function calculateOptimizedStockPieces(
  cutLengths: number[],
  stockLength: number,
  kerf: number = KERF_WIDTH
): StockOptimizationResult {
  if (cutLengths.length === 0 || stockLength <= 0) {
    return { stockPiecesNeeded: 0, totalStockLength: 0, wasteLength: 0, wastePercent: 0 }
  }

  // Sort cuts by length descending for first-fit decreasing
  const sortedCuts = [...cutLengths].sort((a, b) => b - a)

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

/**
 * Function to evaluate simple formulas for cut lengths
 * Supports variable substitution (case-insensitive) for: width, height, quantity
 */
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

/**
 * Helper function to calculate Frame dimensions from sibling panels in the same opening
 * Frame width = sum of sibling widths, height = max sibling height
 */
export function getFrameDimensions(panels: Panel[], currentPanelId: number): FrameDimensions {
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

/**
 * Helper function to calculate required part length from formula
 * Falls back to max(width, height) for extrusions without formulas
 */
export function calculateRequiredPartLength(
  bom: { formula?: string | null; partType?: string; quantity?: number },
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

/**
 * Helper function to find best stock length rule based on calculated part length
 * Returns the most specific applicable rule (one with most constraints matching)
 */
export function findBestStockLengthRule(rules: StockLengthRule[], requiredLength: number): StockLengthRule | null {
  const applicableRules = rules.filter(rule => {
    // Check if rule applies to the required part length
    const matchesLength = (rule.minHeight === null || requiredLength >= rule.minHeight) &&
                         (rule.maxHeight === null || requiredLength <= rule.maxHeight)

    return rule.isActive && matchesLength
  })

  // Return the rule with the most restrictive constraints (most specific)
  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
}

/**
 * Helper function to aggregate BOM items for purchasing summary
 * Groups by part number (and dimensions for glass)
 */
export function aggregateBomItems(bomItems: BomItem[]): AggregatedBomItem[] {
  const aggregated: Record<string, AggregatedBomItem> = {}

  for (const item of bomItems) {
    // For glass, group by part number AND dimensions to get separate rows per size
    let key = item.partNumber
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      key = `${item.partNumber}|${item.glassWidth.toFixed(3)}x${item.glassHeight.toFixed(3)}`
    }

    if (!aggregated[key]) {
      aggregated[key] = {
        partNumber: item.partNumber,
        partName: item.partName,
        partType: item.partType,
        totalQuantity: 0,
        unit: item.unit,
        stockLength: item.stockLength || null,
        cutLengths: [],
        totalCutLength: 0,
        calculatedLengths: [],
        totalCalculatedLength: 0,
        glassDimensions: [],
        totalArea: 0,
        glassWidth: item.partType === 'Glass' ? (item.glassWidth || null) : null,
        glassHeight: item.partType === 'Glass' ? (item.glassHeight || null) : null,
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
        width: item.glassWidth || null,
        height: item.glassHeight || null,
        area: item.glassArea || null
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

/**
 * Helper function to aggregate BOM items for cut list (extrusions only, grouped by product + size + cut length)
 */
export function aggregateCutListItems(bomItems: BomItem[]): CutListItem[] {
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
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(3) : 'none'
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
  const aggregated: Record<string, CutListItem> = {}

  for (const item of extrusions) {
    const sizeKey = `${item.panelWidth}x${item.panelHeight}`
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(3) : 'none'
    const key = `${item.productName}|${sizeKey}|${item.partNumber}|${cutLengthKey}`
    const productSizeKey = `${item.productName}|${sizeKey}`

    if (!aggregated[key]) {
      const unitCount = panelCounts[productSizeKey]?.size || 1

      // Get qty per unit from the first panel we recorded for this key
      const panelQtys = perPanelQty[key]
      const firstPanelId = Object.keys(panelQtys || {})[0]
      const qtyPerUnit = firstPanelId ? (panelQtys[parseInt(firstPanelId)] || (item.quantity || 1)) : (item.quantity || 1)

      aggregated[key] = {
        productName: item.productName || '',
        panelWidth: item.panelWidth || 0,
        panelHeight: item.panelHeight || 0,
        sizeKey: sizeKey,
        partNumber: item.partNumber,
        partName: item.partName,
        stockLength: item.stockLength || null,
        cutLength: item.cutLength || null,
        qtyPerUnit: qtyPerUnit,
        unitCount: unitCount,
        totalQty: qtyPerUnit * unitCount,
        color: item.color || ''
      }
    }
  }

  // Sort by product name, then size, then part number, then cut length
  return Object.values(aggregated).sort((a, b) => {
    if (a.productName !== b.productName) return a.productName.localeCompare(b.productName)
    if (a.sizeKey !== b.sizeKey) return a.sizeKey.localeCompare(b.sizeKey)
    if (a.partNumber !== b.partNumber) return a.partNumber.localeCompare(b.partNumber)
    return (a.cutLength || 0) - (b.cutLength || 0)
  })
}

/**
 * Helper function to calculate stock optimization for cut list
 */
export function calculateStockOptimization(cutListItems: CutListItem[]): Array<{
  partNumber: string
  partName: string
  stockLength: number
  totalCuts: number
  stockPiecesNeeded: number
  totalStockLength: number
  totalCutLength: number
  wasteLength: number
  wastePercent: number
}> {
  const optimizations: Array<{
    partNumber: string
    partName: string
    stockLength: number
    totalCuts: number
    stockPiecesNeeded: number
    totalStockLength: number
    totalCutLength: number
    wasteLength: number
    wastePercent: number
  }> = []

  // Group by part number and stock length
  const grouped: Record<string, CutListItem[]> = {}
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

    // Calculate total cuts needed
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

    // Use the shared bin-packing function with kerf
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

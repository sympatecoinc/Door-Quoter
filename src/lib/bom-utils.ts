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

/**
 * Round up non-EA quantities with 5% overage.
 * For quantities that are NOT unit "EA", adds 5% and rounds up to nearest whole number.
 * EA quantities are returned unchanged.
 */
export function roundUpWithOverage(value: number, unit: string): number {
  if (unit === 'EA') return value
  // Add 5% and round up to nearest whole number
  return Math.ceil(value * 1.05)
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
  isLinkedPart?: boolean
  isOptionPart?: boolean
  glassArea?: number | null
  // For yield-based optimization: base part number without stock length suffix
  basePartNumber?: string
  // For yield-based optimization: all applicable stock lengths for this part
  stockLengthOptions?: number[]
  // Additional properties used in BOM generation
  openingName?: string
  panelId?: number
  productName?: string
  panelWidth?: number
  panelHeight?: number
  description?: string
  color?: string
  addToPackingList?: boolean
  pickListStation?: string | null
  includeInJambKit?: boolean
  isMilled?: boolean
  binLocation?: string | null
  isPresetPart?: boolean
  isMiscellaneous?: boolean
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
  // For Hardware/Fastener with LF/IN units - store the specific calculated length (like glassWidth for glass)
  calculatedLength: number | null
  stockPiecesNeeded: number | null
  wastePercent: number | null
  // Multi-stock optimization: breakdown of stock lengths used, e.g., {99: 2, 123: 1}
  stockLengthBreakdown: Record<number, number> | null
}

// Helper function to aggregate BOM items for purchasing summary
// Optional stockLengthOptions map allows yield-based optimization when multiple stock lengths are available
export function aggregateBomItems(
  bomItems: BomItem[],
  stockLengthOptions?: Record<string, number[]>
): AggregatedBomItem[] {
  const aggregated: Record<string, AggregatedBomItem> = {}

  for (const item of bomItems) {
    // For glass, group by part number AND dimensions to get separate rows per size
    // For LF/IN hardware/fastener, group by part number only (aggregate all lengths)
    // For extrusions/CutStock with stockLengthOptions, use base part number for grouping
    // to enable yield-based stock length optimization across all cuts
    let key = item.partNumber

    // Use base part number for extrusions/CutStock when yield optimization is available
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.basePartNumber) {
      key = item.basePartNumber
    } else if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      key = `${item.partNumber}|${item.glassWidth.toFixed(3)}x${item.glassHeight.toFixed(3)}`
    }
    // LF/IN parts now use just partNumber as key, so all lengths are aggregated together

    if (!aggregated[key]) {
      // For Hardware/Fastener with LF/IN units, store the specific calculated length
      const isLengthBasedHardware = (item.partType === 'Hardware' || item.partType === 'Fastener') &&
                                     (item.unit === 'LF' || item.unit === 'IN')

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
        // Hardware/Fastener calculated length (for LF/IN units with different lengths)
        calculatedLength: isLengthBasedHardware ? (item.calculatedLength ?? null) : null,
        // Stock optimization fields (for extrusions)
        stockPiecesNeeded: null,
        wastePercent: null,
        // Multi-stock optimization breakdown
        stockLengthBreakdown: null
      }
    }

    // For LF/IN Hardware/Fastener, quantity represents total length (not piece count),
    // so we don't add it to totalQuantity - we use totalCalculatedLength instead
    const isLengthBasedItem = (item.partType === 'Hardware' || item.partType === 'Fastener') &&
                              (item.unit === 'LF' || item.unit === 'IN') &&
                              item.calculatedLength
    if (!isLengthBasedItem) {
      aggregated[key].totalQuantity += item.quantity || 1
    }

    // For extrusions and CutStock, collect cut lengths
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.cutLength) {
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
      // For linked parts and option parts, quantity already represents total length (calculatedLength × optionQuantity)
      // For regular BOM parts, quantity is piece count, so multiply by calculatedLength
      if (item.isLinkedPart || item.isOptionPart) {
        aggregated[key].totalCalculatedLength += item.quantity || 0
      } else {
        aggregated[key].totalCalculatedLength += (item.calculatedLength * (item.quantity || 1))
      }
    }
  }

  // Calculate stock optimization for extrusions and CutStock
  // Use multi-stock optimization when multiple stock lengths are available
  // When multiple stock lengths are used, create separate line items for each
  const expandedItems: AggregatedBomItem[] = []
  const keysToRemove: string[] = []

  for (const [key, item] of Object.entries(aggregated)) {
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.cutLengths.length > 0) {
      // Check for stock length options (either from parameter or from collected BOM items)
      const options = stockLengthOptions?.[key]

      if (options && options.length > 1) {
        // Multiple stock lengths available - use multi-stock optimization
        const multiResult = calculateMultiStockOptimization(options, item.cutLengths)
        if (multiResult && Object.keys(multiResult.stockLengthBreakdown).length > 1) {
          // Multiple stock lengths used - create separate line items for each
          keysToRemove.push(key)

          for (const stockPiece of multiResult.stockPieces) {
            const stockLength = stockPiece.stockLength
            const existingExpanded = expandedItems.find(
              e => e.partNumber === `${key}-${stockLength}` && e.stockLength === stockLength
            )

            if (existingExpanded) {
              // Add cuts to existing expanded item
              existingExpanded.cutLengths.push(...stockPiece.cuts)
              existingExpanded.totalCutLength += stockPiece.cuts.reduce((sum, c) => sum + c, 0)
              existingExpanded.stockPiecesNeeded = (existingExpanded.stockPiecesNeeded || 0) + 1
            } else {
              // Create new expanded item for this stock length
              const totalCutLength = stockPiece.cuts.reduce((sum, c) => sum + c, 0)
              expandedItems.push({
                partNumber: `${key}-${stockLength}`,
                partName: item.partName,
                partType: item.partType,
                totalQuantity: stockPiece.cuts.length,
                unit: item.unit,
                stockLength: stockLength,
                cutLengths: [...stockPiece.cuts],
                totalCutLength: totalCutLength,
                calculatedLengths: [],
                totalCalculatedLength: 0,
                glassDimensions: [],
                totalArea: 0,
                glassWidth: null,
                glassHeight: null,
                calculatedLength: null,
                stockPiecesNeeded: 1,
                wastePercent: Math.round((stockPiece.wasteLength / stockLength) * 1000) / 10,
                stockLengthBreakdown: { [stockLength]: 1 }
              })
            }
          }

          // Recalculate waste percent for each expanded item
          for (const expanded of expandedItems.filter(e => e.partNumber.startsWith(key + '-'))) {
            if (expanded.stockLength && expanded.stockPiecesNeeded) {
              const totalStock = expanded.stockLength * expanded.stockPiecesNeeded
              const waste = totalStock - expanded.totalCutLength
              expanded.wastePercent = Math.round((waste / totalStock) * 1000) / 10
              expanded.stockLengthBreakdown = { [expanded.stockLength]: expanded.stockPiecesNeeded }
            }
          }
        } else if (multiResult) {
          // Only one stock length used - update the existing item
          const stockLength = Number(Object.keys(multiResult.stockLengthBreakdown)[0])
          const pieceCount = multiResult.stockLengthBreakdown[stockLength]

          item.stockLength = stockLength
          item.partNumber = `${key}-${stockLength}`
          item.stockPiecesNeeded = pieceCount
          item.wastePercent = multiResult.wastePercent
          item.stockLengthBreakdown = { [stockLength]: pieceCount }
        }
      } else if (item.stockLength) {
        // Single stock length option - use standard optimization
        const optimization = calculateOptimizedStockPieces(item.cutLengths, item.stockLength)
        item.stockPiecesNeeded = optimization.stockPiecesNeeded
        item.wastePercent = optimization.wastePercent
        item.stockLengthBreakdown = { [item.stockLength]: optimization.stockPiecesNeeded }

        // Ensure part number has stock length suffix
        if (!item.partNumber.endsWith(`-${item.stockLength}`)) {
          item.partNumber = `${key}-${item.stockLength}`
        }
      }
    }
  }

  // Remove items that were expanded into multiple stock lengths
  for (const key of keysToRemove) {
    delete aggregated[key]
  }

  // Combine original items with expanded items
  const allItems = [...Object.values(aggregated), ...expandedItems]

  // Sort by part type then part number
  const typeOrder: Record<string, number> = { 'Extrusion': 1, 'CutStock': 2, 'Hardware': 3, 'Glass': 4, 'Option': 5 }
  return allItems.sort((a, b) => {
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

  // For extrusions/CutStock without formulas, try to use a reasonable default based on component size
  if (bom.partType === 'Extrusion' || bom.partType === 'CutStock') {
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

// Result from comparing yield across multiple stock length options
export interface YieldComparisonResult {
  stockLength: number
  stockPiecesNeeded: number
  totalStockLength: number
  wasteLength: number
  wastePercent: number
}

// Assignment of cuts to a single stock piece for multi-stock optimization
export interface StockPieceAssignment {
  stockLength: number           // e.g., 99
  cuts: number[]                // Cut lengths assigned to this piece, e.g., [86]
  remainingCapacity: number     // Space left after all cuts and kerfs
  wasteLength: number           // remainingCapacity (unusable leftover)
}

// Result from multi-stock optimization across different stock lengths
export interface MultiStockOptimizationResult {
  stockPieces: StockPieceAssignment[]
  stockLengthBreakdown: Record<number, number>  // {99: 2, 123: 1} means 2 pieces of 99", 1 piece of 123"
  totalStockLength: number
  totalCutLength: number
  totalWasteLength: number
  wastePercent: number
}

/**
 * Find the optimal stock length by comparing yield (waste percentage) across multiple options.
 * Uses FFD bin-packing optimization for each stock length to determine which produces least waste.
 *
 * @param stockLengths - Array of available stock lengths to compare
 * @param cutLengths - Array of cut lengths needed (including duplicates for quantity)
 * @param kerf - Kerf width (material lost per cut), defaults to KERF_WIDTH
 * @returns The stock length option with lowest waste percentage, or null if no valid option
 */
export function findOptimalStockLengthByYield(
  stockLengths: number[],
  cutLengths: number[],
  kerf: number = KERF_WIDTH
): YieldComparisonResult | null {
  if (cutLengths.length === 0 || stockLengths.length === 0) {
    return null
  }

  // Find the longest cut to filter out stock lengths that can't fit any cuts
  const maxCutLength = Math.max(...cutLengths)

  // Filter to stock lengths that can fit at least the largest cut
  const validStockLengths = stockLengths.filter(sl => sl >= maxCutLength)

  if (validStockLengths.length === 0) {
    return null
  }

  // If only one valid option, use it directly
  if (validStockLengths.length === 1) {
    const result = calculateOptimizedStockPieces(cutLengths, validStockLengths[0], kerf)
    return {
      stockLength: validStockLengths[0],
      ...result
    }
  }

  // Compare yield for each valid stock length option
  let bestResult: YieldComparisonResult | null = null

  for (const stockLength of validStockLengths) {
    const optimization = calculateOptimizedStockPieces(cutLengths, stockLength, kerf)

    const result: YieldComparisonResult = {
      stockLength,
      stockPiecesNeeded: optimization.stockPiecesNeeded,
      totalStockLength: optimization.totalStockLength,
      wasteLength: optimization.wasteLength,
      wastePercent: optimization.wastePercent
    }

    // Select this option if it has lower waste percentage
    // If waste percentages are equal, prefer the option with less total stock length
    if (bestResult === null ||
        result.wastePercent < bestResult.wastePercent ||
        (result.wastePercent === bestResult.wastePercent && result.totalStockLength < bestResult.totalStockLength)) {
      bestResult = result
    }
  }

  return bestResult
}

/**
 * Multi-stock optimization using Hybrid FFD with best-fit bin selection.
 * Can use MULTIPLE different stock lengths when that yields better material utilization.
 *
 * Algorithm:
 * 1. Sort cuts by length descending (First Fit Decreasing)
 * 2. For each cut:
 *    a. Try to fit in existing open bins (any stock length with capacity)
 *    b. Score by: remaining_space / bin_capacity (lower = less waste)
 *    c. Also consider opening new bin with each valid stock length
 *    d. Pick option with lowest waste score
 *    e. Prefer existing bins over new bins (small penalty for new)
 * 3. When opening new bin, use smallest stock that fits the cut
 * 4. Return breakdown: {stockLength: count} for all pieces
 *
 * @param stockLengths - Array of available stock lengths to choose from
 * @param cutLengths - Array of cut lengths needed (including duplicates for quantity)
 * @param kerf - Kerf width (material lost per cut), defaults to KERF_WIDTH
 * @returns Optimization result with stock piece assignments and breakdown, or null if no valid solution
 */
export function calculateMultiStockOptimization(
  stockLengths: number[],
  cutLengths: number[],
  kerf: number = KERF_WIDTH
): MultiStockOptimizationResult | null {
  if (cutLengths.length === 0 || stockLengths.length === 0) {
    return null
  }

  // Find the longest cut to validate stock lengths
  const maxCutLength = Math.max(...cutLengths)

  // Filter to stock lengths that can fit at least the largest cut
  const validStockLengths = stockLengths.filter(sl => sl >= maxCutLength).sort((a, b) => a - b)

  if (validStockLengths.length === 0) {
    return null
  }

  // Sort cuts by length descending for first-fit decreasing
  const sortedCuts = [...cutLengths].sort((a, b) => b - a)

  // Track open bins (stock pieces with remaining capacity)
  const stockPieces: StockPieceAssignment[] = []

  // Penalty for opening a new bin (encourages filling existing bins first)
  // This is a small fraction that makes existing bins with same waste score win
  const NEW_BIN_PENALTY = 0.001

  for (const cut of sortedCuts) {
    let bestOption: { pieceIndex: number; stockLength: number; score: number; isNew: boolean } | null = null

    // Option 1: Try fitting in existing bins
    for (let i = 0; i < stockPieces.length; i++) {
      const piece = stockPieces[i]
      // Need cut + kerf (kerf goes after the cut for potential next cut)
      if (piece.remainingCapacity >= cut) {
        // Score: remaining space after cut / original stock length
        // Lower score = less waste percentage
        const newRemaining = piece.remainingCapacity - cut - kerf
        const wasteScore = Math.max(0, newRemaining) / piece.stockLength

        if (bestOption === null || wasteScore < bestOption.score) {
          bestOption = { pieceIndex: i, stockLength: piece.stockLength, score: wasteScore, isNew: false }
        }
      }
    }

    // Option 2: Open new bin with each valid stock length
    for (const stockLength of validStockLengths) {
      if (stockLength >= cut) {
        // Score: remaining space after cut / stock length + new bin penalty
        const newRemaining = stockLength - cut - kerf
        const wasteScore = Math.max(0, newRemaining) / stockLength + NEW_BIN_PENALTY

        if (bestOption === null || wasteScore < bestOption.score) {
          bestOption = { pieceIndex: -1, stockLength, score: wasteScore, isNew: true }
        }
      }
    }

    // Apply the best option
    if (bestOption) {
      if (bestOption.isNew) {
        // Open a new bin
        stockPieces.push({
          stockLength: bestOption.stockLength,
          cuts: [cut],
          remainingCapacity: bestOption.stockLength - cut - kerf,
          wasteLength: Math.max(0, bestOption.stockLength - cut - kerf)
        })
      } else {
        // Add to existing bin
        const piece = stockPieces[bestOption.pieceIndex]
        piece.cuts.push(cut)
        piece.remainingCapacity = piece.remainingCapacity - cut - kerf
        piece.wasteLength = Math.max(0, piece.remainingCapacity)
      }
    }
  }

  // Build breakdown: count of each stock length used
  const stockLengthBreakdown: Record<number, number> = {}
  for (const piece of stockPieces) {
    stockLengthBreakdown[piece.stockLength] = (stockLengthBreakdown[piece.stockLength] || 0) + 1
  }

  // Calculate totals
  const totalStockLength = stockPieces.reduce((sum, p) => sum + p.stockLength, 0)
  const totalCutLength = cutLengths.reduce((sum, c) => sum + c, 0)
  const totalWasteLength = totalStockLength - totalCutLength
  const wastePercent = totalStockLength > 0 ? Math.round((totalWasteLength / totalStockLength) * 1000) / 10 : 0

  return {
    stockPieces,
    stockLengthBreakdown,
    totalStockLength,
    totalCutLength,
    totalWasteLength,
    wastePercent
  }
}

/**
 * Pre-process BOM items to apply yield-based stock length optimization.
 * Updates the stockLength and partNumber of each item based on the optimal
 * stock length determined by analyzing all cuts for each part.
 *
 * This should be called BEFORE aggregation so that all views (summary, cutlist)
 * see consistent stock length values.
 */
export function applyYieldOptimizationToBomItems(
  bomItems: BomItem[],
  stockLengthOptionsMap: Record<string, number[]>
): BomItem[] {
  // Group items by base part number to collect all cut lengths
  const partCutLengths: Record<string, number[]> = {}
  const partItems: Record<string, BomItem[]> = {}

  for (const item of bomItems) {
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') &&
        item.basePartNumber && item.cutLength) {
      if (!partCutLengths[item.basePartNumber]) {
        partCutLengths[item.basePartNumber] = []
        partItems[item.basePartNumber] = []
      }
      // Add cut length for each unit of quantity
      const qty = item.quantity || 1
      for (let i = 0; i < qty; i++) {
        partCutLengths[item.basePartNumber].push(item.cutLength)
      }
      partItems[item.basePartNumber].push(item)
    }
  }

  // Apply yield optimization for each part with multiple stock length options
  const optimizedStockLengths: Record<string, number> = {}

  for (const [basePartNumber, cutLengths] of Object.entries(partCutLengths)) {
    const options = stockLengthOptionsMap[basePartNumber]
    if (options && options.length > 1) {
      const yieldResult = findOptimalStockLengthByYield(options, cutLengths)
      if (yieldResult) {
        optimizedStockLengths[basePartNumber] = yieldResult.stockLength
      }
    }
  }

  // Update items with optimized stock lengths
  return bomItems.map(item => {
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') &&
        item.basePartNumber && optimizedStockLengths[item.basePartNumber]) {
      const newStockLength = optimizedStockLengths[item.basePartNumber]
      const oldStockLength = item.stockLength

      // If stock length changed, update the part number suffix
      let newPartNumber = item.partNumber
      if (oldStockLength && newStockLength !== oldStockLength) {
        if (item.partNumber.endsWith(`-${oldStockLength}`)) {
          newPartNumber = item.partNumber.slice(0, -`-${oldStockLength}`.length) + `-${newStockLength}`
        }
      }

      return {
        ...item,
        stockLength: newStockLength,
        partNumber: newPartNumber
      }
    }
    return item
  })
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
  isMilled?: boolean
  binLocation?: string
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
  isMilled?: boolean
  binLocation?: string
}

// Aggregate BOM items for cut list (extrusions and CutStock, grouped by product + size + cut length).
export function aggregateCutListItems(bomItems: BOMItemForCutList[]): AggregatedCutListItem[] {
  // Filter to extrusions and CutStock
  const extrusions = bomItems.filter(item => item.partType === 'Extrusion' || item.partType === 'CutStock')

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
  const aggregated: Record<string, AggregatedCutListItem> = {}

  for (const item of extrusions) {
    const sizeKey = `${item.panelWidth}x${item.panelHeight}`
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(3) : 'none'
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
        color: item.color,
        isMilled: item.isMilled,
        binLocation: item.binLocation
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
  const headers = ['Product', 'Check Off', 'Part Number', 'Part Name', 'Cut Length', 'Qty Per Unit', 'Unit Count', 'Total Qty', 'Machined or Cut', 'Bin Location', 'Production Time']

  const rows = cutListItems.map(item => {
    return [
      item.productName || '',
      '', // Check Off - empty column for manual checking
      item.partNumber,
      item.partName || '',
      item.cutLength ? item.cutLength.toFixed(3) : '',
      item.qtyPerUnit,
      item.unitCount,
      item.totalQty,
      item.isMilled ? 'Machined' : 'Cut',
      item.binLocation || '',
      '' // Production Time - placeholder
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
            '', // Check Off - empty column for manual checking
            item.partNumber,
            item.partName || '',
            item.cutLength ? item.cutLength.toFixed(3) : '',
            item.qtyPerUnit,
            item.unitCount,
            item.totalQty,
            item.isMilled ? 'Machined' : 'Cut',
            item.binLocation || '',
            '' // Production Time - placeholder
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
/**
 * Format stock length breakdown for display.
 * Converts {99: 2, 123: 1} to "2x 99\" + 1x 123\""
 */
export function formatStockBreakdown(breakdown: Record<number, number> | null): string {
  if (!breakdown) return ''

  const entries = Object.entries(breakdown)
    .map(([length, count]) => ({ length: Number(length), count }))
    .sort((a, b) => a.length - b.length) // Sort by stock length ascending

  if (entries.length === 0) return ''
  if (entries.length === 1) {
    const { length, count } = entries[0]
    return `${count}x ${length}"`
  }

  return entries.map(({ length, count }) => `${count}x ${length}"`).join(' + ')
}

export function summaryToCSV(projectName: string, summaryItems: AggregatedBomItem[]): string {
  // Part number now includes stock length (e.g., EXT-001-99), so no separate stock column needed
  const headers = ['Part Number', 'Part Name', 'Type', 'Size (WxH)', 'Pieces', 'Unit']

  const rows = summaryItems.map(item => {
    // For glass, show the specific size; for extrusions, show cut lengths
    // For hardware/fastener with LF/IN units, show the calculated length
    let sizeStr = ''
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      sizeStr = `${item.glassWidth.toFixed(3)}" x ${item.glassHeight.toFixed(3)}"`
    } else if (item.cutLengths && item.cutLengths.length > 0) {
      // For extrusions, show unique cut lengths
      const uniqueCuts = [...new Set(item.cutLengths.map((l: number) => l.toFixed(3)))]
      sizeStr = uniqueCuts.join('; ')
    }
    // For LF/IN items, leave sizeStr empty - totals are shown only in Pieces column

    // Determine unit - extrusions, CutStock, and glass use EA
    let unitStr = item.unit
    if (item.partType === 'Extrusion' || item.partType === 'CutStock' || item.partType === 'Glass') {
      unitStr = 'EA'
    }

    // Determine pieces value
    let piecesValue: string | number = item.totalQuantity
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null) {
      piecesValue = item.stockPiecesNeeded
    } else if ((item.partType === 'Hardware' || item.partType === 'Fastener') &&
               (item.unit === 'LF' || item.unit === 'IN') &&
               item.totalCalculatedLength) {
      // For LF/IN items, apply 5% overage and round up to whole number
      piecesValue = roundUpWithOverage(item.totalCalculatedLength, unitStr)
    } else if (unitStr !== 'EA') {
      // For any other non-EA items, apply 5% overage and round up
      piecesValue = roundUpWithOverage(item.totalQuantity, unitStr)
    }

    return [
      item.partNumber,
      item.partName,
      item.partType,
      sizeStr,
      piecesValue,
      unitStr
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

// Helper function to convert combined summary to CSV with project header
export function combinedSummaryToCSV(
  projectNames: string[],
  summaryItems: AggregatedBomItem[]
): string {
  const lines: string[] = []

  // Header section with project info
  lines.push('# Combined Purchase Summary')
  lines.push(`# Projects: ${projectNames.join(', ')}`)
  lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`)
  lines.push('')

  // Part number now includes stock length (e.g., EXT-001-99), so no separate stock column needed
  const headers = ['Part Number', 'Part Name', 'Type', 'Size (WxH)', 'Pieces', 'Unit']
  lines.push(headers.join(','))

  for (const item of summaryItems) {
    // For glass, show the specific size; for extrusions, show cut lengths
    let sizeStr = ''
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      sizeStr = `${item.glassWidth.toFixed(3)}" x ${item.glassHeight.toFixed(3)}"`
    } else if (item.cutLengths && item.cutLengths.length > 0) {
      const uniqueCuts = [...new Set(item.cutLengths.map((l: number) => l.toFixed(3)))]
      sizeStr = uniqueCuts.join('; ')
    }

    // Determine unit - extrusions, CutStock, and glass use EA
    let unitStr = item.unit
    if (item.partType === 'Extrusion' || item.partType === 'CutStock' || item.partType === 'Glass') {
      unitStr = 'EA'
    }

    // Determine pieces value
    let piecesValue: string | number = item.totalQuantity
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null) {
      piecesValue = item.stockPiecesNeeded
    } else if ((item.partType === 'Hardware' || item.partType === 'Fastener') &&
               (item.unit === 'LF' || item.unit === 'IN') &&
               item.totalCalculatedLength) {
      piecesValue = roundUpWithOverage(item.totalCalculatedLength, unitStr)
    } else if (unitStr !== 'EA') {
      piecesValue = roundUpWithOverage(item.totalQuantity, unitStr)
    }

    const row = [
      item.partNumber,
      item.partName,
      item.partType,
      sizeStr,
      piecesValue,
      unitStr
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)

    lines.push(row.join(','))
  }

  return lines.join('\n')
}

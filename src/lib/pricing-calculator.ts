/**
 * Pricing Calculator - Shared module for calculating opening costs
 *
 * This module centralizes the pricing logic used by both:
 * - /api/openings/[id]/calculate-price (stores results in DB)
 * - /api/projects/[id]/quote (generates quote PDF)
 *
 * By using the same calculation logic, we ensure consistency between
 * stored prices and generated quotes.
 */

import { prisma } from '@/lib/prisma'
import { evaluateFormula, getFrameDimensions } from '@/lib/bom/calculations'

// Re-export types from pricing.ts for consistency
export { calculateMarkupPrice } from '@/lib/pricing'
export type { PricingMode } from '@/lib/pricing'

// ============================================================================
// Types
// ============================================================================

export interface OpeningCostBreakdown {
  totalExtrusionCost: number
  totalHardwareCost: number
  totalGlassCost: number
  totalPackagingCost: number
  totalOtherCost: number
  totalStandardOptionCost: number
  totalHybridRemainingCost: number
  totalPrice: number
  components: ComponentBreakdown[]
}

export interface ComponentBreakdown {
  productName: string
  panelId: number
  width: number
  height: number
  bomCosts: BOMCostItem[]
  optionCosts: OptionCostItem[]
  glassCost: GlassCostItem | null
  totalBOMCost: number
  totalOptionCost: number
  totalGlassCost: number
  totalComponentCost: number
}

export interface BOMCostItem {
  partNumber: string
  partName: string
  partType: string
  quantity: number
  method: string
  details: string
  unitCost: number
  totalCost: number
  finishCost?: number
  finishDetails?: string
  hybridBreakdown?: {
    usedPercentage: number
    remainingPercentage: number
    usedPortionCost: number
    remainingPortionCost: number
  }
}

export interface OptionCostItem {
  categoryName: string
  optionName: string
  price: number
  isStandard: boolean
  isIncluded: boolean
  standardDeducted?: number
  linkedPartsCost?: number
}

export interface GlassCostItem {
  glassType: string
  widthFormula: string
  heightFormula: string
  calculatedWidth: number
  calculatedHeight: number
  quantity: number
  sqft: number
  pricePerSqFt: number
  totalCost: number
}

// ============================================================================
// Pricing Context - Pre-fetched data for batch queries
// ============================================================================

export interface PricingContext {
  masterParts: Map<string, {
    partNumber: string
    partType: string
    cost: number | null
    salePrice: number | null
    unit: string | null
    weightPerFoot: number | null
    perimeterInches: number | null
    customPricePerLb: number | null
    isMillFinish: boolean
    stockLengthRules: any[]
    pricingRules: any[]
  }>
  finishPricing: Map<string, { finishType: string; costPerSqFt: number; isActive: boolean }>
  glassTypes: Map<string, { name: string; pricePerSqFt: number }>
  globalMaterialPricePerLb: number
}

/**
 * Create a pricing context by pre-fetching all required data for batch processing.
 * This eliminates N+1 queries by fetching all master parts, finish pricing, and glass types
 * in just 4 parallel queries instead of thousands of individual lookups.
 */
export async function createPricingContext(
  openings: OpeningWithIncludes[]
): Promise<PricingContext> {
  // 1. Collect unique identifiers from all openings
  const partNumbers = new Set<string>()
  const glassTypeNames = new Set<string>()
  const finishColors = new Set<string>()

  for (const opening of openings) {
    if (opening.finishColor) finishColors.add(opening.finishColor)
    for (const panel of opening.panels) {
      if (panel.glassType && panel.glassType !== 'N/A') {
        glassTypeNames.add(panel.glassType)
      }
      const product = panel.componentInstance?.product
      if (!product) continue

      // Collect part numbers from BOMs
      for (const bom of product.productBOMs || []) {
        if (bom.partNumber) partNumbers.add(bom.partNumber)
      }

      // Collect part numbers from options and linked parts
      for (const pso of product.productSubOptions || []) {
        for (const opt of pso.category?.individualOptions || []) {
          if (opt.partNumber) partNumbers.add(opt.partNumber)
          for (const lp of opt.linkedParts || []) {
            if (lp.masterPart?.partNumber) partNumbers.add(lp.masterPart.partNumber)
          }
        }
      }
    }

    // Collect part numbers from preset part instances (partNumber is on masterPart, not presetPart)
    for (const instance of opening.presetPartInstances || []) {
      const pn = instance.presetPart?.masterPart?.partNumber || instance.presetPart?.partNumber
      if (pn) {
        partNumbers.add(pn)
      }
    }
  }

  // 2. Batch fetch all data in parallel (4 queries total instead of ~100,000)
  const [masterPartsList, finishPricingList, glassTypesList, globalSetting] = await Promise.all([
    prisma.masterPart.findMany({
      where: { partNumber: { in: Array.from(partNumbers) } },
      include: {
        stockLengthRules: { where: { isActive: true } },
        pricingRules: { where: { isActive: true } }
      }
    }),
    prisma.extrusionFinishPricing.findMany({
      where: { finishType: { in: Array.from(finishColors) }, isActive: true }
    }),
    prisma.glassType.findMany({
      where: { name: { in: Array.from(glassTypeNames) } }
    }),
    prisma.globalSetting.findUnique({ where: { key: 'materialPricePerLb' } })
  ])

  // 3. Build lookup Maps for O(1) access
  type MasterPartData = {
    partNumber: string
    partType: string
    cost: number | null
    salePrice: number | null
    unit: string | null
    weightPerFoot: number | null
    perimeterInches: number | null
    customPricePerLb: number | null
    isMillFinish: boolean
    stockLengthRules: any[]
    pricingRules: any[]
  }
  const masterParts = new Map<string, MasterPartData>()
  for (const mp of masterPartsList) {
    masterParts.set(mp.partNumber, {
      partNumber: mp.partNumber,
      partType: mp.partType,
      cost: mp.cost,
      salePrice: mp.salePrice,
      unit: mp.unit,
      weightPerFoot: mp.weightPerFoot,
      perimeterInches: mp.perimeterInches,
      customPricePerLb: mp.customPricePerLb,
      isMillFinish: mp.isMillFinish,
      stockLengthRules: mp.stockLengthRules,
      pricingRules: mp.pricingRules
    })
  }

  const finishPricing = new Map<string, { finishType: string; costPerSqFt: number; isActive: boolean }>()
  for (const fp of finishPricingList) {
    finishPricing.set(fp.finishType, {
      finishType: fp.finishType,
      costPerSqFt: fp.costPerSqFt,
      isActive: fp.isActive
    })
  }

  const glassTypes = new Map<string, { name: string; pricePerSqFt: number }>()
  for (const gt of glassTypesList) {
    glassTypes.set(gt.name, {
      name: gt.name,
      pricePerSqFt: gt.pricePerSqFt
    })
  }

  return {
    masterParts,
    finishPricing,
    glassTypes,
    globalMaterialPricePerLb: globalSetting ? parseFloat(globalSetting.value) : 0
  }
}

// Type for opening with all required includes
export interface OpeningWithIncludes {
  id: number
  finishColor: string | null
  finishedWidth?: number | null
  finishedHeight?: number | null
  roughWidth?: number | null
  roughHeight?: number | null
  panels: PanelWithIncludes[]
  presetPartInstances?: PresetPartInstanceWithIncludes[]
  project: {
    excludedPartNumbers: string[] | null
    extrusionCostingMethod?: string | null
    pricingMode?: {
      extrusionCostingMethod: string | null
    } | null
  }
}

interface PresetPartInstanceWithIncludes {
  id: number
  calculatedQuantity: number
  calculatedCost: number
  presetPart: {
    partType?: string
    partName?: string
    partNumber?: string | null
    unit?: string | null
    stockLength?: number | null
    isMilled?: boolean
    formula?: string | null
    quantity?: number | null
    masterPart?: {
      partType: string
      partNumber: string
      baseName?: string | null
      cost?: number | null
      salePrice?: number | null
      [key: string]: any
    } | null
    [key: string]: any
  }
}

interface PanelWithIncludes {
  id: number
  width: number
  height: number
  glassType: string | null
  componentInstance: ComponentInstanceWithIncludes | null
}

interface ComponentInstanceWithIncludes {
  id: number
  subOptionSelections: string | null
  includedOptions: string | null
  variantSelections: string | null
  product: ProductWithIncludes
}

interface ProductWithIncludes {
  id: number
  name: string
  productType: string
  glassWidthFormula: string | null
  glassHeightFormula: string | null
  glassQuantityFormula: string | null
  productBOMs: any[]
  productSubOptions: any[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the best stock length rule for extrusions based on calculated part length
 */
function findBestStockLengthRule(
  rules: any[],
  requiredLength: number,
  componentWidth?: number,
  componentHeight?: number
): any | null {
  const matchingRules = rules.filter(rule => {
    const fitsStock = rule.stockLength >= requiredLength
    const matchesHeight = (rule.minHeight === null || rule.minHeight === undefined || (componentHeight && componentHeight >= rule.minHeight)) &&
                         (rule.maxHeight === null || rule.maxHeight === undefined || (componentHeight && componentHeight <= rule.maxHeight))
    const matchesWidth = (rule.minWidth === null || rule.minWidth === undefined || (componentWidth && componentWidth >= rule.minWidth)) &&
                        (rule.maxWidth === null || rule.maxWidth === undefined || (componentWidth && componentWidth <= rule.maxWidth))
    return fitsStock && matchesHeight && matchesWidth && rule.isActive
  })

  if (matchingRules.length === 0) return null

  return matchingRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0) + (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0) + (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0)
    if (bSpecificity !== aSpecificity) return bSpecificity - aSpecificity
    return a.stockLength - b.stockLength
  })[0]
}

/**
 * Calculate required part length from BOM formula
 */
function calculateRequiredPartLength(bom: any, variables: Record<string, number>): number {
  if (bom.formula) {
    try {
      return evaluateFormula(bom.formula, variables)
    } catch (error) {
      console.error('Error evaluating part length formula:', error)
      return 0
    }
  }
  return bom.quantity || 0
}

/**
 * Calculate extrusion price per piece using weight-based formula
 */
function calculateExtrusionPricePerPiece(
  weightPerFoot: number | null | undefined,
  customPricePerLb: number | null | undefined,
  globalPricePerLb: number,
  stockLengthInches: number
): number | null {
  if (!weightPerFoot || weightPerFoot <= 0) return null
  if (stockLengthInches <= 0) return null

  const pricePerLb = customPricePerLb ?? globalPricePerLb
  const basePricePerFoot = weightPerFoot * pricePerLb
  return basePricePerFoot * (stockLengthInches / 12)
}

// ============================================================================
// BOM Item Price Calculation
// ============================================================================

/**
 * Calculate the price of a single BOM item using component dimensions
 * Now uses PricingContext for O(1) lookups instead of database queries
 */
function calculateBOMItemPrice(
  bom: any,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  context: PricingContext
): { cost: number; breakdown: BOMCostItem } {
  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1
  }

  let cost = 0
  const breakdown: BOMCostItem = {
    partNumber: bom.partNumber,
    partName: bom.partName,
    partType: bom.partType,
    quantity: bom.quantity || 1,
    method: 'unknown',
    details: '',
    unitCost: 0,
    totalCost: 0,
    finishCost: 0,
    finishDetails: ''
  }

  // Get master part from pre-fetched context (O(1) lookup)
  const masterPart = bom.partNumber ? context.masterParts.get(bom.partNumber) : null

  // PRIORITY CHECK: Sale Price - bypasses ALL other pricing methods
  if (masterPart?.salePrice && masterPart.salePrice > 0) {
    cost = masterPart.salePrice * (bom.quantity || 1)
    breakdown.method = 'sale_price'
    breakdown.unitCost = masterPart.salePrice
    breakdown.totalCost = cost
    breakdown.details = `Sale price (no markup): $${masterPart.salePrice} × ${bom.quantity || 1}`
    return { cost, breakdown }
  }

  // Method 0: Hardware items with LF (linear foot) unit and formula
  if (bom.formula && masterPart) {
    if (masterPart.partType === 'Hardware' && masterPart.unit === 'LF' && masterPart.cost && masterPart.cost > 0) {
      const dimensionInches = evaluateFormula(bom.formula, variables)
      const linearFeet = dimensionInches / 12
      cost = masterPart.cost * linearFeet * (bom.quantity || 1)
      breakdown.method = 'master_part_hardware_lf'
      breakdown.unitCost = masterPart.cost
      breakdown.totalCost = cost
      breakdown.details = `Hardware (LF): Formula "${bom.formula}" = ${dimensionInches}" = ${linearFeet.toFixed(2)} LF × $${masterPart.cost}/LF × ${bom.quantity || 1} = $${cost.toFixed(2)}`
      return { cost, breakdown }
    }
  }

  // Method 2: Formula for non-extrusions (excluding CutStock)
  if (bom.formula && bom.partType !== 'Extrusion' && bom.partType !== 'CutStock') {
    const formulaResult = evaluateFormula(bom.formula, variables)
    const quantity = bom.quantity || 1

    let formulaWithValues = bom.formula
    if (bom.formula.toLowerCase().includes('width')) {
      formulaWithValues = formulaWithValues.replace(/width/gi, variables.width.toString())
    }
    if (bom.formula.toLowerCase().includes('height')) {
      formulaWithValues = formulaWithValues.replace(/height/gi, variables.height.toString())
    }

    const masterPartCost = masterPart?.cost && masterPart.cost > 0 ? masterPart.cost : null
    const masterPartUnit = masterPart?.unit || null

    if (masterPartCost) {
      cost = formulaResult * masterPartCost * quantity
      breakdown.method = 'bom_formula'
      breakdown.unitCost = formulaResult * masterPartCost
      breakdown.totalCost = cost
      breakdown.details = `Formula: ${bom.formula} → ${formulaWithValues} = ${formulaResult.toFixed(2)} × $${masterPartCost}${masterPartUnit ? '/' + masterPartUnit : ''} × ${quantity} qty = $${cost.toFixed(2)}`
    } else {
      cost = formulaResult
      breakdown.method = 'bom_formula'
      breakdown.unitCost = cost / quantity
      breakdown.totalCost = cost
      breakdown.details = `Formula: ${bom.formula} → ${formulaWithValues} = $${formulaResult.toFixed(2)} (no MasterPart cost found)`
    }
    return { cost, breakdown }
  }

  // Method 3: Use MasterPart from context and apply pricing rules
  if (masterPart) {
    // For Hardware: Use direct cost
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_hardware'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }

        // For CutStock: Use hybrid percentage-based costing
        if (masterPart.partType === 'CutStock' && masterPart.stockLengthRules.length > 0) {
          const requiredLength = calculateRequiredPartLength(bom, variables)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, componentWidth, componentHeight)

          if (bestRule) {
            const pricePerPiece = masterPart.cost ?? bestRule.basePrice ?? 0

            if (pricePerPiece > 0 && bestRule.stockLength) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              if (extrusionCostingMethod === 'HYBRID') {
                if (usagePercentage >= 0.5) {
                  const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                  cost = usedPortionCost + remainingPortionCost
                  breakdown.method = 'extrusion_hybrid_split'
                  breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used) | Piece price: $${pricePerPiece.toFixed(2)} | Used: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${usedPortionCost.toFixed(2)} (gets markup) | Remaining: ${(remainingPercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${remainingPortionCost.toFixed(2)} (no markup) | Material total: $${cost.toFixed(2)}`
                  breakdown.hybridBreakdown = {
                    usedPercentage: usagePercentage,
                    remainingPercentage: remainingPercentage,
                    usedPortionCost,
                    remainingPortionCost
                  }
                } else {
                  cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  breakdown.method = 'extrusion_hybrid_percentage'
                  breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used, <50%) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                }
              } else if (extrusionCostingMethod === 'PERCENTAGE_BASED') {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                breakdown.details = `Percentage-based: ${(usagePercentage * 100).toFixed(1)}% of ${bestRule.stockLength}" stock × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
              } else {
                cost = pricePerPiece * (bom.quantity || 1)
                breakdown.method = 'extrusion_full_stock'
                breakdown.details = `Full stock: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
              }

              breakdown.unitCost = cost / (bom.quantity || 1)
              breakdown.totalCost = cost
              return { cost, breakdown }
            }
          }
        }

        // For Extrusions: Use StockLengthRules
        if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
          const requiredLength = calculateRequiredPartLength(bom, variables)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, componentWidth, componentHeight)

          if (bestRule) {
            const isExcludedPart = excludedPartNumbers?.some(excludedPart => {
              const baseExcludedPart = excludedPart.replace(/(-BL|-C2|-AL)(-\d+)?$/, '')
              return baseExcludedPart === masterPart.partNumber || excludedPart === masterPart.partNumber
            })

            const usePercentageBased = extrusionCostingMethod === 'PERCENTAGE_BASED' || isExcludedPart
            const useHybrid = extrusionCostingMethod === 'HYBRID'

            const calculatedPricePerPiece = calculateExtrusionPricePerPiece(
              masterPart.weightPerFoot,
              masterPart.customPricePerLb,
              context.globalMaterialPricePerLb,
              bestRule.stockLength || 0
            )
            const pricePerPiece = calculatedPricePerPiece ?? bestRule.basePrice ?? 0

            // Percentage-based costing
            if (usePercentageBased && bestRule.stockLength && pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              if (remainingPercentage > 0.5) {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used, <50%) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost

                // Calculate finish cost for percentage-based
                if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                  const finishResult = calculateFinishCost(
                    finishColor,
                    requiredLength,
                    masterPart.perimeterInches || 0,
                    bom.quantity || 1,
                    context
                  )
                  if (finishResult) {
                    breakdown.finishCost = finishResult.cost
                    breakdown.finishDetails = `${finishColor} (cut length): ${finishResult.details}`
                    cost += finishResult.cost
                    breakdown.totalCost = cost
                  }
                }

                return { cost, breakdown }
              }
            }

            // HYBRID costing
            if (useHybrid && bestRule.stockLength && pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              if (usagePercentage >= 0.5) {
                const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                cost = usedPortionCost + remainingPortionCost
                breakdown.method = 'extrusion_hybrid_split'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used) | Piece price: $${pricePerPiece.toFixed(2)} | Used: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${usedPortionCost.toFixed(2)} (gets markup) | Remaining: ${(remainingPercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${remainingPortionCost.toFixed(2)} (no markup) | Material total: $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
                breakdown.hybridBreakdown = {
                  usedPercentage: usagePercentage,
                  remainingPercentage: remainingPercentage,
                  usedPortionCost,
                  remainingPortionCost
                }
              } else {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_hybrid_percentage'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used, <50%) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
              }

              // Calculate finish cost for hybrid
              if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                const finishLengthInches = usagePercentage >= 0.5 ? bestRule.stockLength : requiredLength
                const finishType = usagePercentage >= 0.5 ? 'full stock' : 'cut length'
                const finishResult = calculateFinishCost(
                  finishColor,
                  finishLengthInches,
                  masterPart.perimeterInches || 0,
                  bom.quantity || 1,
                  context
                )
                if (finishResult) {
                  breakdown.finishCost = finishResult.cost
                  breakdown.finishDetails = `${finishColor} (${finishType}): ${finishResult.details}`
                  cost += finishResult.cost
                  breakdown.totalCost = cost
                }
              }

              return { cost, breakdown }
            }

            // FULL_STOCK method
            if (bestRule.formula) {
              const extrusionVariables = {
                ...variables,
                basePrice: pricePerPiece,
                pricePerPiece: pricePerPiece,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1,
                requiredLength: requiredLength
              }
              cost = evaluateFormula(bestRule.formula, extrusionVariables)
              breakdown.method = 'extrusion_rule_formula'
              breakdown.details = `Extrusion rule for ${requiredLength}" length: ${bestRule.formula}`
            } else if (pricePerPiece > 0) {
              cost = pricePerPiece * (bom.quantity || 1)
              breakdown.method = 'extrusion_rule_base'
              breakdown.details = `Extrusion price for ${requiredLength}" length: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
            }
            breakdown.unitCost = cost / (bom.quantity || 1)
            breakdown.totalCost = cost

            // Calculate finish cost for full stock
            if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
              const finishResult = calculateFinishCost(
                finishColor,
                bestRule.stockLength || requiredLength,
                masterPart.perimeterInches || 0,
                bom.quantity || 1,
                context
              )
              if (finishResult) {
                breakdown.finishCost = finishResult.cost
                breakdown.finishDetails = `${finishColor} (full stock): ${finishResult.details}`
                cost += finishResult.cost
                breakdown.totalCost = cost
              }
            }

            return { cost, breakdown }
          }
        }

        // For other part types: Use PricingRules
        if (masterPart.pricingRules.length > 0) {
          const rule = masterPart.pricingRules[0]
          if (rule.formula) {
            const ruleVariables = {
              ...variables,
              basePrice: rule.basePrice || 0
            }
            cost = evaluateFormula(rule.formula, ruleVariables)
            breakdown.method = 'pricing_rule_formula'
            breakdown.details = `Pricing rule: ${rule.formula}`
          } else if (rule.basePrice) {
            cost = rule.basePrice * (bom.quantity || 1)
            breakdown.method = 'pricing_rule_base'
            breakdown.details = `Pricing rule base: $${rule.basePrice} × ${bom.quantity || 1}`
          }
          breakdown.unitCost = cost / (bom.quantity || 1)
          breakdown.totalCost = cost
          return { cost, breakdown }
        }

        // Fallback to MasterPart direct cost
        if (masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_direct'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `MasterPart direct: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }
  }

  breakdown.method = 'no_cost_found'
  breakdown.details = 'No pricing method found'
  breakdown.totalCost = 0
  return { cost: 0, breakdown }
}

/**
 * Calculate finish cost for an extrusion (now synchronous using pre-fetched context)
 */
function calculateFinishCost(
  finishColor: string,
  lengthInches: number,
  perimeterInches: number,
  quantity: number,
  context: PricingContext
): { cost: number; details: string } | null {
  const finishPricing = context.finishPricing.get(finishColor)

  if (finishPricing && finishPricing.costPerSqFt > 0) {
    const finishLengthFeet = lengthInches / 12
    const perimeterFeet = perimeterInches / 12
    const surfaceSqFt = perimeterFeet * finishLengthFeet
    const finishCostPerPiece = surfaceSqFt * finishPricing.costPerSqFt
    const totalFinishCost = finishCostPerPiece * quantity

    const details = perimeterFeet > 0
      ? `${perimeterFeet.toFixed(3)}' perim × ${finishLengthFeet.toFixed(2)}' = ${surfaceSqFt.toFixed(2)} sq ft × $${finishPricing.costPerSqFt}/sq ft × ${quantity} = $${totalFinishCost.toFixed(2)}`
      : `No perimeter defined, finish cost = $0.00`

    return { cost: totalFinishCost, details }
  }
  return null
}

// ============================================================================
// Option Price Calculation
// ============================================================================

/**
 * Calculate option price - handles both hardware and extrusions
 * Now synchronous using PricingContext for O(1) lookups
 */
function calculateOptionPrice(
  option: any,
  optionBom: any | null,
  quantity: number,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  context: PricingContext,
  selectedVariantId?: number | null
): { unitPrice: number; totalPrice: number; isExtrusion: boolean; breakdown?: any; linkedPartsCost?: number } {
  let baseUnitPrice = 0
  let baseTotalPrice = 0
  let isExtrusion = false
  let breakdown: any = null

  if (option.partNumber) {
    const masterPart = context.masterParts.get(option.partNumber)

    if (masterPart) {
      if (masterPart.salePrice && masterPart.salePrice > 0) {
        baseUnitPrice = masterPart.salePrice
        baseTotalPrice = masterPart.salePrice * quantity
      } else if (masterPart.partType === 'Extrusion' && optionBom) {
        const bomForPricing = {
          partNumber: option.partNumber,
          partName: option.name,
          partType: 'Extrusion',
          quantity: quantity,
          formula: optionBom.formula,
          cost: optionBom.cost
        }

        const bomResult = calculateBOMItemPrice(
          bomForPricing,
          componentWidth,
          componentHeight,
          extrusionCostingMethod,
          excludedPartNumbers,
          finishColor,
          context
        )

        baseUnitPrice = bomResult.cost / quantity
        baseTotalPrice = bomResult.cost
        isExtrusion = true
        breakdown = bomResult.breakdown
      } else {
        baseUnitPrice = masterPart.cost ?? 0
        baseTotalPrice = baseUnitPrice * quantity
      }
    }
  }

  // Calculate linked parts cost
  let linkedPartsCost = 0
  if (option.linkedParts && option.linkedParts.length > 0) {
    const applicableLinkedParts = option.linkedParts.filter((lp: any) => {
      if (lp.variantId === null) return true
      if (!selectedVariantId) {
        const defaultVariant = option.variants?.find((v: any) => v.isDefault)
        if (defaultVariant) return lp.variantId === defaultVariant.id
        return false
      }
      return lp.variantId === selectedVariantId
    })

    for (const linkedPart of applicableLinkedParts) {
      const linkedQuantity = (linkedPart.quantity || 1) * quantity
      const partCost = linkedPart.masterPart?.cost || 0
      linkedPartsCost += partCost * linkedQuantity
    }
  }

  const totalPrice = baseTotalPrice + linkedPartsCost
  const unitPrice = quantity > 0 ? totalPrice / quantity : 0

  return {
    unitPrice,
    totalPrice,
    isExtrusion,
    breakdown,
    linkedPartsCost
  }
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate all costs for an opening
 * Now synchronous using PricingContext for O(1) lookups instead of database queries
 *
 * @param opening - Opening with all required includes (panels, components, products, BOMs, options)
 * @param context - Pre-fetched pricing data for efficient lookups
 * @returns Cost breakdown for the opening
 */
export function calculateOpeningCosts(
  opening: OpeningWithIncludes,
  context: PricingContext
): OpeningCostBreakdown {
  const costBreakdown: OpeningCostBreakdown = {
    totalExtrusionCost: 0,
    totalHardwareCost: 0,
    totalGlassCost: 0,
    totalPackagingCost: 0,
    totalOtherCost: 0,
    totalStandardOptionCost: 0,
    totalHybridRemainingCost: 0,
    totalPrice: 0,
    components: []
  }

  const extrusionCostingMethod = opening.project.pricingMode?.extrusionCostingMethod ||
                                  opening.project.extrusionCostingMethod ||
                                  'FULL_STOCK'
  const excludedPartNumbers = opening.project.excludedPartNumbers || []

  for (const panel of opening.panels) {
    if (!panel.componentInstance) continue

    const component = panel.componentInstance
    const product = component.product
    let componentCost = 0

    // Handle FRAME products
    const isFrameProduct = product.productType === 'FRAME'
    let effectiveWidth = panel.width
    let effectiveHeight = panel.height

    if (isFrameProduct) {
      const frameDimensions = getFrameDimensions(opening.panels as any[], panel.id)
      effectiveWidth = frameDimensions.width
      effectiveHeight = frameDimensions.height
    }

    const componentBreakdown: ComponentBreakdown = {
      productName: product.name,
      panelId: panel.id,
      width: effectiveWidth,
      height: effectiveHeight,
      bomCosts: [],
      optionCosts: [],
      glassCost: null,
      totalBOMCost: 0,
      totalOptionCost: 0,
      totalGlassCost: 0,
      totalComponentCost: 0
    }

    // Parse selections
    let selections: Record<string, any> = {}
    let variantSelections: Record<string, number> = {}
    let includedOptions: number[] = []

    if (component.subOptionSelections) {
      try { selections = JSON.parse(component.subOptionSelections) } catch (e) { /* continue */ }
    }
    if (component.variantSelections) {
      try { variantSelections = JSON.parse(component.variantSelections) } catch (e) { /* continue */ }
    }
    if (component.includedOptions) {
      try { includedOptions = JSON.parse(component.includedOptions) } catch (e) { /* continue */ }
    }

    // Build set of selected option IDs for BOM filtering
    const selectedOptionIds = new Set<number>()
    for (const [, optionId] of Object.entries(selections)) {
      if (optionId && typeof optionId === 'string' && !optionId.includes('_qty')) {
        selectedOptionIds.add(parseInt(optionId))
      }
    }

    // Calculate BOM costs
    for (const bom of product.productBOMs || []) {
      // Skip option-linked BOMs if option not selected
      if (bom.optionId && !selectedOptionIds.has(bom.optionId)) continue
      // Skip null-option BOMs if another option in same category is selected
      if (!bom.optionId && bom.option === null) {
        const category = product.productSubOptions?.find((pso: any) =>
          pso.category?.individualOptions?.some((io: any) => io.id === bom.optionId)
        )
        if (category) {
          const categoryId = category.category.id.toString()
          const selectedInCategory = selections[categoryId]
          if (selectedInCategory && selectedInCategory !== bom.optionId?.toString()) continue
        }
      }

      const bomResult = calculateBOMItemPrice(
        bom,
        effectiveWidth,
        effectiveHeight,
        extrusionCostingMethod,
        excludedPartNumbers,
        opening.finishColor,
        context
      )

      componentBreakdown.bomCosts.push(bomResult.breakdown)
      componentBreakdown.totalBOMCost += bomResult.cost
      componentCost += bomResult.cost

      // Track by category
      const partType = bom.partType || 'Other'
      if (partType === 'Extrusion' || partType === 'CutStock') {
        costBreakdown.totalExtrusionCost += bomResult.cost
        // Track hybrid remaining cost
        if (bomResult.breakdown.hybridBreakdown) {
          costBreakdown.totalHybridRemainingCost += bomResult.breakdown.hybridBreakdown.remainingPortionCost
        }
      } else if (partType === 'Hardware' || partType === 'Fastener') {
        costBreakdown.totalHardwareCost += bomResult.cost
      } else if (partType === 'Glass') {
        costBreakdown.totalGlassCost += bomResult.cost
      } else if (partType === 'Packaging') {
        costBreakdown.totalPackagingCost += bomResult.cost
      } else {
        costBreakdown.totalOtherCost += bomResult.cost
      }
    }

    // Calculate option costs
    const processedCategories = new Set<string>()

    for (const [categoryId, optionId] of Object.entries(selections)) {
      // Skip quantity fields
      if (categoryId.includes('_qty')) continue

      // Mark category as processed BEFORE checking null - this prevents
      // unprocessed categories loop from adding standard option costs
      processedCategories.add(categoryId)

      // Handle null/"none" selection - user explicitly selected "None"
      // This should NOT fall back to standard option (that's what unprocessed categories are for)
      if (optionId === null || optionId === 'none') {
        // User explicitly selected "None" - add $0 entry and continue
        const productSubOption = product.productSubOptions?.find((pso: any) =>
          pso.category?.id?.toString() === categoryId
        )
        if (productSubOption) {
          componentBreakdown.optionCosts.push({
            categoryName: productSubOption.category?.name || categoryId,
            optionName: 'None',
            price: 0,
            isStandard: false,
            isIncluded: false,
            linkedPartsCost: 0
          })
        }
        continue
      }

      const productSubOption = product.productSubOptions?.find((pso: any) =>
        pso.category?.id?.toString() === categoryId
      )
      if (!productSubOption) continue

      const category = productSubOption.category
      const standardOptionId = productSubOption.standardOptionId

      // Option selected
      const selectedOption = category.individualOptions?.find((io: any) =>
        io.id === parseInt(optionId as string)
      )

      if (selectedOption) {
        const isIncluded = includedOptions.includes(selectedOption.id)
        const isStandardSelected = standardOptionId === selectedOption.id

        const optionBom = selectedOption.isCutListItem
          ? product.productBOMs?.find((b: any) => b.optionId === selectedOption.id)
          : null

        const quantityKey = `${categoryId}_qty`
        const userSelectedQuantity = selections[quantityKey] !== undefined
          ? parseInt(selections[quantityKey] as string)
          : null
        const quantity = userSelectedQuantity !== null
          ? userSelectedQuantity
          : (optionBom?.quantity || 1)

        const selectedVariantId = variantSelections[String(selectedOption.id)]
        const priceResult = calculateOptionPrice(
          selectedOption,
          optionBom,
          quantity,
          effectiveWidth,
          effectiveHeight,
          extrusionCostingMethod,
          excludedPartNumbers,
          opening.finishColor,
          context,
          selectedVariantId
        )

        if (isStandardSelected) {
          const optionPrice = isIncluded ? 0 : priceResult.totalPrice

          componentBreakdown.optionCosts.push({
            categoryName: category.name,
            optionName: selectedOption.name,
            price: optionPrice,
            isStandard: true,
            isIncluded,
            linkedPartsCost: priceResult.linkedPartsCost
          })

          componentBreakdown.totalOptionCost += optionPrice
          componentCost += optionPrice
          costBreakdown.totalStandardOptionCost += optionPrice

          if (priceResult.isExtrusion) {
            costBreakdown.totalExtrusionCost += optionPrice
            // Track hybrid remaining cost for extrusion options
            if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
              costBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
            }
          } else {
            costBreakdown.totalHardwareCost += optionPrice
          }
        } else {
          const optionPrice = isIncluded ? 0 : priceResult.totalPrice

          // Get standard option price
          const standardOption = category.individualOptions?.find((io: any) => io.id === standardOptionId)
          const standardOptionBom = standardOption?.isCutListItem
            ? product.productBOMs?.find((b: any) => b.optionId === standardOption.id)
            : null
          const standardVariantId = standardOption ? variantSelections[String(standardOption.id)] : undefined
          const standardPriceResult = standardOption
            ? calculateOptionPrice(
                standardOption,
                standardOptionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                excludedPartNumbers,
                opening.finishColor,
                context,
                standardVariantId
              )
            : { unitPrice: 0, totalPrice: 0, isExtrusion: false }

          componentBreakdown.optionCosts.push({
            categoryName: category.name,
            optionName: selectedOption.name,
            price: optionPrice,
            isStandard: false,
            isIncluded,
            standardDeducted: standardPriceResult.unitPrice,
            linkedPartsCost: priceResult.linkedPartsCost
          })

          componentBreakdown.totalOptionCost += optionPrice
          componentCost += optionPrice
          costBreakdown.totalStandardOptionCost += standardPriceResult.totalPrice

          if (priceResult.isExtrusion) {
            costBreakdown.totalExtrusionCost += optionPrice
            // Track hybrid remaining cost for extrusion options
            if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
              costBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
            }
          } else {
            costBreakdown.totalHardwareCost += optionPrice
          }
        }
      }
    }

    // Add standard options for unprocessed categories
    for (const productSubOption of product.productSubOptions || []) {
      const categoryId = productSubOption.category?.id?.toString()
      if (!categoryId || processedCategories.has(categoryId)) continue
      if (!productSubOption.standardOptionId) continue

      const standardOption = productSubOption.category?.individualOptions?.find(
        (io: any) => io.id === productSubOption.standardOptionId
      )
      if (!standardOption) continue

      const optionBom = standardOption.isCutListItem
        ? product.productBOMs?.find((b: any) => b.optionId === standardOption.id)
        : null
      const quantity = optionBom?.quantity || 1

      const priceResult = calculateOptionPrice(
        standardOption,
        optionBom,
        quantity,
        effectiveWidth,
        effectiveHeight,
        extrusionCostingMethod,
        excludedPartNumbers,
        opening.finishColor,
        context
      )

      componentBreakdown.optionCosts.push({
        categoryName: productSubOption.category.name,
        optionName: standardOption.name,
        price: priceResult.totalPrice,
        isStandard: true,
        isIncluded: false,
        linkedPartsCost: priceResult.linkedPartsCost
      })

      componentBreakdown.totalOptionCost += priceResult.totalPrice
      componentCost += priceResult.totalPrice
      costBreakdown.totalStandardOptionCost += priceResult.totalPrice

      if (priceResult.isExtrusion) {
        costBreakdown.totalExtrusionCost += priceResult.totalPrice
        // Track hybrid remaining cost for extrusion options
        if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
          costBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
        }
      } else {
        costBreakdown.totalHardwareCost += priceResult.totalPrice
      }
    }

    // Calculate glass cost using pre-fetched glass types
    if (panel.glassType && panel.glassType !== 'N/A') {
      const glassType = context.glassTypes.get(panel.glassType)

      if (glassType && product.glassWidthFormula && product.glassHeightFormula) {
        const variables = { width: effectiveWidth, height: effectiveHeight }
        const glassWidth = evaluateFormula(product.glassWidthFormula, variables)
        const glassHeight = evaluateFormula(product.glassHeightFormula, variables)
        const glassQuantity = product.glassQuantityFormula
          ? evaluateFormula(product.glassQuantityFormula, variables)
          : 1

        const sqft = (glassWidth * glassHeight / 144) * glassQuantity
        const glassCost = sqft * glassType.pricePerSqFt

        componentBreakdown.glassCost = {
          glassType: glassType.name,
          widthFormula: product.glassWidthFormula,
          heightFormula: product.glassHeightFormula,
          calculatedWidth: glassWidth,
          calculatedHeight: glassHeight,
          quantity: glassQuantity,
          sqft: Math.round(sqft * 100) / 100,
          pricePerSqFt: glassType.pricePerSqFt,
          totalCost: Math.round(glassCost * 100) / 100
        }

        componentBreakdown.totalGlassCost = Math.round(glassCost * 100) / 100
        componentCost += componentBreakdown.totalGlassCost
        costBreakdown.totalGlassCost += componentBreakdown.totalGlassCost
      }
    }

    componentBreakdown.totalComponentCost = componentCost
    costBreakdown.components.push(componentBreakdown)
  }

  // Calculate preset part instance costs
  // presetPart fields (formula, quantity) are on OpeningPresetPart
  // partType, partNumber, partName are on the related masterPart
  if (opening.presetPartInstances && opening.presetPartInstances.length > 0) {
    for (const instance of opening.presetPartInstances) {
      const part = instance.presetPart
      const mp = part.masterPart
      if (!mp) continue

      const partType = mp.partType || part.partType
      const partNumber = mp.partNumber || part.partNumber
      const partName = mp.baseName || mp.partNumber || part.partName || ''
      let totalPartCost = 0

      if (partType === 'Extrusion' && part.formula && partNumber) {
        // For extrusions with formula: use calculateBOMItemPrice with proper cut length
        // calculatedQuantity = cut length (from preset formula), presetPart.quantity = piece count
        const quantity = part.quantity || 1
        const formulaForPricing = String(instance.calculatedQuantity || 0)

        const bomForPricing = {
          partNumber: partNumber,
          partName: partName,
          partType: 'Extrusion',
          quantity: quantity,
          formula: formulaForPricing,
          cost: 0
        }

        const effectiveWidth = opening.finishedWidth || opening.roughWidth || 0
        const effectiveHeight = opening.finishedHeight || opening.roughHeight || 0

        const { cost, breakdown } = calculateBOMItemPrice(
          bomForPricing,
          effectiveWidth,
          effectiveHeight,
          extrusionCostingMethod,
          excludedPartNumbers,
          opening.finishColor,
          context
        )
        totalPartCost = Math.round(cost * 100) / 100

        // Track hybrid remaining cost for preset extrusions
        if (breakdown.hybridBreakdown?.remainingPortionCost) {
          costBreakdown.totalHybridRemainingCost += breakdown.hybridBreakdown.remainingPortionCost
        }
      } else {
        // Non-extrusion: use simple cost * quantity
        const quantity = instance.calculatedQuantity
        let unitCost = 0
        if (partNumber) {
          const masterPart = context.masterParts.get(partNumber)
          if (masterPart) {
            unitCost = masterPart.cost ?? masterPart.salePrice ?? 0
          }
        }
        totalPartCost = Math.round(unitCost * quantity * 100) / 100
      }

      // Categorize by part type
      switch (partType) {
        case 'Extrusion':
        case 'CutStock':
          costBreakdown.totalExtrusionCost += totalPartCost
          break
        case 'Hardware':
        case 'Fastener':
          costBreakdown.totalHardwareCost += totalPartCost
          break
        case 'Glass':
          costBreakdown.totalGlassCost += totalPartCost
          break
        case 'Packaging':
          costBreakdown.totalPackagingCost += totalPartCost
          break
        default:
          costBreakdown.totalOtherCost += totalPartCost
      }
    }
  }

  costBreakdown.totalPrice = Math.round(
    (costBreakdown.totalExtrusionCost +
     costBreakdown.totalHardwareCost +
     costBreakdown.totalGlassCost +
     costBreakdown.totalPackagingCost +
     costBreakdown.totalOtherCost) * 100
  ) / 100

  return costBreakdown
}

/**
 * Get global material price per lb from settings
 */
export async function getGlobalMaterialPricePerLb(): Promise<number> {
  const materialPricePerLbSetting = await prisma.globalSetting.findUnique({
    where: { key: 'materialPricePerLb' }
  })
  return materialPricePerLbSetting
    ? parseFloat(materialPricePerLbSetting.value)
    : 0
}

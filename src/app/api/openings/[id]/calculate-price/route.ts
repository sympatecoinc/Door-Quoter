import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { evaluatePresetFormula, PresetFormulaVariables } from '@/lib/preset-formulas'

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    // Replace variables in formula (case-insensitive)
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      // Create case-insensitive regex to match variable names
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, value.toString())
    }

    // Check if expression is empty after variable replacement
    if (!expression || expression.trim() === '') {
      return 0
    }

    // Basic math evaluation (be careful with eval - this is simplified)
    // In production, consider using a safer math expression parser
    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    console.error('Formula evaluation error for formula:', formula, 'error:', error)
    return 0
  }
}

// Function to find the best stock length rule for extrusions based on calculated part length from ProductBOM formula
function findBestStockLengthRule(rules: any[], requiredLength: number, componentWidth?: number, componentHeight?: number): any | null {
  const matchingRules = rules.filter(rule => {
    // Check if rule fits the required cut length (must fit within stock)
    const fitsStock = rule.stockLength >= requiredLength

    // Check dimension constraints (minHeight/maxHeight refer to opening dimensions, not cut length)
    const matchesHeight = (rule.minHeight === null || rule.minHeight === undefined || (componentHeight && componentHeight >= rule.minHeight)) &&
                         (rule.maxHeight === null || rule.maxHeight === undefined || (componentHeight && componentHeight <= rule.maxHeight))
    const matchesWidth = (rule.minWidth === null || rule.minWidth === undefined || (componentWidth && componentWidth >= rule.minWidth)) &&
                        (rule.maxWidth === null || rule.maxWidth === undefined || (componentWidth && componentWidth <= rule.maxWidth))

    return fitsStock && matchesHeight && matchesWidth && rule.isActive
  })

  if (matchingRules.length === 0) return null

  // Sort by specificity (more constraints = more specific) and smallest stock that fits
  const bestRule = matchingRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0) + (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0) + (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0)
    if (bSpecificity !== aSpecificity) return bSpecificity - aSpecificity
    // Prefer smaller stock length for efficiency
    return a.stockLength - b.stockLength
  })[0]

  return bestRule
}

function calculateRequiredPartLength(bom: any, variables: any): number {
  // If there's a formula in the ProductBOM, use it to calculate the required part length
  if (bom.formula) {
    try {
      return evaluateFormula(bom.formula, variables)
    } catch (error) {
      console.error('Error evaluating part length formula:', error)
      return 0
    }
  }

  // Fallback: If no formula, use quantity as length (for backwards compatibility)
  return bom.quantity || 0
}

// Calculate extrusion price per piece using weight-based formula
// Formula: (weightPerFoot × pricePerLb) × (stockLength / 12)
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

// Function to calculate FRAME dimensions from sibling panels in the same opening
function getFrameDimensions(panels: any[], currentPanelId: number): { width: number; height: number } {
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

// Helper function to calculate option price - handles both hardware and extrusions
async function calculateOptionPrice(
  option: {
    partNumber?: string | null;
    isCutListItem: boolean;
    id: number;
    name: string;
    linkedParts?: Array<{
      id: number;
      quantity: number | null;
      variantId: number | null;
      masterPart: { cost: number | null; partNumber: string };
      variant: { id: number; name: string } | null;
    }>;
    variants?: Array<{
      id: number;
      name: string;
      isDefault: boolean;
    }>;
  },
  optionBom: any | null,
  quantity: number,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  globalMaterialPricePerLb: number,
  selectedVariantId?: number | null,
  extraVars?: Record<string, number>
): Promise<{ unitPrice: number; totalPrice: number; isExtrusion: boolean; breakdown?: any; linkedPartsCost?: number }> {
  // Initialize base option pricing
  let baseUnitPrice = 0
  let baseTotalPrice = 0
  let isExtrusion = false
  let breakdown: any = null

  // Calculate base option price from partNumber if it exists
  if (option.partNumber) {
    // Look up MasterPart to check if it's an extrusion or has a sale price
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: option.partNumber },
      select: { partType: true, cost: true, salePrice: true }
    })

    if (masterPart) {
      // PRIORITY: Check for sale price first - bypasses all other pricing
      if (masterPart.salePrice && masterPart.salePrice > 0) {
        baseUnitPrice = masterPart.salePrice
        baseTotalPrice = masterPart.salePrice * quantity
      }
      // If it's an extrusion with a BOM entry, use full extrusion pricing logic
      else if (masterPart.partType === 'Extrusion' && optionBom) {
        // Create a BOM-like object for calculateBOMItemPrice
        const bomForPricing = {
          partNumber: option.partNumber,
          partName: option.name,
          partType: 'Extrusion',
          quantity: quantity,
          formula: optionBom.formula,
          cost: optionBom.cost
        }

        const bomResult = await calculateBOMItemPrice(
          bomForPricing,
          componentWidth,
          componentHeight,
          extrusionCostingMethod,
          excludedPartNumbers,
          finishColor,
          globalMaterialPricePerLb,
          extraVars
        )

        baseUnitPrice = bomResult.cost / quantity
        baseTotalPrice = bomResult.cost
        isExtrusion = true
        breakdown = bomResult.breakdown
      }
      // For hardware and other part types, use direct cost
      else {
        baseUnitPrice = masterPart.cost ?? 0
        baseTotalPrice = baseUnitPrice * quantity
      }
    }
  }

  // Calculate linked parts cost based on variant selection
  // This mirrors the BOM route logic for consistent pricing
  let linkedPartsCost = 0
  if (option.linkedParts && option.linkedParts.length > 0) {
    // Filter linked parts based on variant selection
    const applicableLinkedParts = option.linkedParts.filter((lp) => {
      // Parts with no variant (variantId === null) apply to all variants
      if (lp.variantId === null) return true

      // If no variant is selected, use the default variant
      if (!selectedVariantId) {
        const defaultVariant = option.variants?.find((v) => v.isDefault)
        if (defaultVariant) return lp.variantId === defaultVariant.id
        // If no default variant, only include parts with no variant
        return false
      }

      // Match linked part's variant to the selected variant
      return lp.variantId === selectedVariantId
    })

    // Sum up the cost of applicable linked parts
    for (const linkedPart of applicableLinkedParts) {
      const linkedQuantity = (linkedPart.quantity || 1) * quantity
      const partCost = linkedPart.masterPart.cost || 0
      linkedPartsCost += partCost * linkedQuantity
    }
  }

  // Return combined totals
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

// Function to calculate the price of a single BOM item using component dimensions
async function calculateBOMItemPrice(bom: any, componentWidth: number, componentHeight: number, extrusionCostingMethod?: string, excludedPartNumbers?: string[], finishColor?: string | null, globalMaterialPricePerLb?: number, extraVars?: Record<string, number>): Promise<{cost: number, breakdown: any}> {
  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1,
    ...extraVars
  }

  let cost = 0
  const breakdown = {
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

  // PRIORITY CHECK: Sale Price - bypasses ALL other pricing methods
  // If a part has a salePrice set, use it directly without any markup calculations
  if (bom.partNumber) {
    try {
      const salePriceCheck = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        select: { salePrice: true }
      })

      if (salePriceCheck?.salePrice && salePriceCheck.salePrice > 0) {
        cost = salePriceCheck.salePrice * (bom.quantity || 1)
        breakdown.method = 'sale_price'
        breakdown.unitCost = salePriceCheck.salePrice
        breakdown.totalCost = cost
        breakdown.details = `Sale price (no markup): $${salePriceCheck.salePrice} × ${bom.quantity || 1}`
        return { cost, breakdown }
      }
    } catch (error) {
      console.error('Error checking sale price:', error)
    }
  }

  // Method 0: Check for Hardware items with LF (linear foot) unit and formula
  // These need special handling - formula gives dimension in inches, convert to LF for pricing
  if (bom.formula && bom.partNumber) {
    try {
      const lfCheck = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        select: { unit: true, cost: true, partType: true }
      })

      if (lfCheck?.partType === 'Hardware' && lfCheck?.unit === 'LF' && lfCheck?.cost && lfCheck.cost > 0) {
        // Evaluate the formula to get dimension in inches
        const dimensionInches = evaluateFormula(bom.formula, variables)
        // Convert inches to linear feet
        const linearFeet = dimensionInches / 12
        // Calculate cost: price per LF × linear feet × quantity
        cost = lfCheck.cost * linearFeet * (bom.quantity || 1)
        breakdown.method = 'master_part_hardware_lf'
        breakdown.unitCost = lfCheck.cost
        breakdown.totalCost = cost
        breakdown.details = `Hardware (LF): Formula "${bom.formula}" = ${dimensionInches}" = ${linearFeet.toFixed(2)} LF × $${lfCheck.cost}/LF × ${bom.quantity || 1} = $${cost.toFixed(2)}`
        return { cost, breakdown }
      }
    } catch (error) {
      console.error('Error checking LF hardware:', error)
    }
  }

  // NOTE: ProductBOM.cost is no longer used for pricing
  // All pricing should come from MasterPart (inventory level)
  // Extrusions use StockLengthRules, everything else uses MasterPart.cost

  // Method 2: Formula for non-extrusions (excluding CutStock which has its own hybrid costing)
  // For items like FOAM-GASKET-ROLL: formula gives dimension, multiply by MasterPart cost per unit
  if (bom.formula && bom.partType !== 'Extrusion' && bom.partType !== 'CutStock') {
    const formulaResult = evaluateFormula(bom.formula, variables)
    const quantity = bom.quantity || 1

    // Build detailed formula breakdown showing variable substitution
    let formulaWithValues = bom.formula
    if (bom.formula.toLowerCase().includes('width')) {
      formulaWithValues = formulaWithValues.replace(/width/gi, variables.width.toString())
    }
    if (bom.formula.toLowerCase().includes('height')) {
      formulaWithValues = formulaWithValues.replace(/height/gi, variables.height.toString())
    }

    // Check if there's a MasterPart cost to apply
    let masterPartCost: number | null = null
    let masterPartUnit: string | null = null
    if (bom.partNumber) {
      try {
        const mp = await prisma.masterPart.findUnique({
          where: { partNumber: bom.partNumber },
          select: { cost: true, unit: true }
        })
        if (mp?.cost && mp.cost > 0) {
          masterPartCost = mp.cost
          masterPartUnit = mp.unit
        }
      } catch (e) {
        // Continue without MasterPart cost
      }
    }

    if (masterPartCost) {
      // Apply MasterPart cost to formula result
      cost = formulaResult * masterPartCost * quantity
      breakdown.method = 'bom_formula'
      breakdown.unitCost = formulaResult * masterPartCost
      breakdown.totalCost = cost
      breakdown.details = `Formula: ${bom.formula} → ${formulaWithValues} = ${formulaResult.toFixed(2)} × $${masterPartCost}${masterPartUnit ? '/' + masterPartUnit : ''} × ${quantity} qty = $${cost.toFixed(2)}`
    } else {
      // No MasterPart cost - formula result IS the cost (legacy behavior)
      cost = formulaResult
      breakdown.method = 'bom_formula'
      breakdown.unitCost = cost / quantity
      breakdown.totalCost = cost
      breakdown.details = `Formula: ${bom.formula} → ${formulaWithValues} = $${formulaResult.toFixed(2)} (no MasterPart cost found)`
    }
    return { cost, breakdown }
  }

  // Method 3: Find MasterPart by partNumber and apply pricing rules
  // Note: Use original part number for lookup since master parts don't have finish codes
  if (bom.partNumber) {
    try {
      const masterPart = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        include: {
          stockLengthRules: { where: { isActive: true } },
          pricingRules: { where: { isActive: true } }
        }
      })

      if (masterPart) {
        // For Hardware: Use direct cost from MasterPart
        // Note: LF (linear foot) hardware with formulas is handled in Method 0 above
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_hardware'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }

        // For CutStock: Use MasterPart.cost from inventory with hybrid percentage-based costing
        if (masterPart.partType === 'CutStock' && masterPart.stockLengthRules.length > 0) {
          const requiredLength = calculateRequiredPartLength(bom, variables)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, componentWidth, componentHeight)

          if (bestRule) {
            // Use MasterPart.cost from inventory (NOT weight-based), fallback to StockLengthRule basePrice
            const pricePerPiece = masterPart.cost ?? bestRule.basePrice ?? 0

            if (pricePerPiece > 0 && bestRule.stockLength) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // Apply same costing methods as extrusions
              if (extrusionCostingMethod === 'HYBRID') {
                if (usagePercentage >= 0.5) {
                  // ≥50% used: charge used portion at markup + remaining at cost
                  const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                  cost = usedPortionCost + remainingPortionCost
                  breakdown.method = 'extrusion_hybrid_split'
                  breakdown.details = `Hybrid (≥50% used): ${(usagePercentage * 100).toFixed(1)}% used ($${usedPortionCost.toFixed(2)} at markup) + ${(remainingPercentage * 100).toFixed(1)}% remaining ($${remainingPortionCost.toFixed(2)} at cost)`
                  ;(breakdown as any).hybridBreakdown = {
                    usedPercentage: usagePercentage,
                    remainingPercentage: remainingPercentage,
                    usedPortionCost,
                    remainingPortionCost
                  }
                } else {
                  // <50% used: charge only for percentage used
                  cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  breakdown.method = 'extrusion_hybrid_percentage'
                  breakdown.details = `Hybrid (<50% used): ${(usagePercentage * 100).toFixed(1)}% of stock × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
                }
              } else if (extrusionCostingMethod === 'PERCENTAGE_BASED') {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                breakdown.details = `Percentage-based: ${(usagePercentage * 100).toFixed(1)}% of ${bestRule.stockLength}" stock × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
              } else {
                // FULL_STOCK - charge full piece price
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

        // For Extrusions: Use StockLengthRules based on calculated part length from ProductBOM formula
        if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
          // Calculate the required part length from the ProductBOM formula
          const requiredLength = calculateRequiredPartLength(bom, variables)

          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, componentWidth, componentHeight)
          if (bestRule) {
            // Check if this part is excluded from FULL_STOCK rule
            // Need to check both exact match and base part number (without finish codes)
            // Excluded list might have finish codes like DR-ASD-TUB2669-BL-120
            // But master part is just DR-ASD-TUB2669
            const isExcludedPart = excludedPartNumbers?.some(excludedPart => {
              // Remove finish codes (-BL, -C2, -AL) and stock lengths (-120, -144, etc) from excluded part
              const baseExcludedPart = excludedPart.replace(/(-BL|-C2|-AL)(-\d+)?$/, '')
              return baseExcludedPart === masterPart.partNumber || excludedPart === masterPart.partNumber
            })

            // Check if using percentage-based costing method
            // Use percentage-based if: method is PERCENTAGE_BASED OR part is in excluded list
            const usePercentageBased = extrusionCostingMethod === 'PERCENTAGE_BASED' || isExcludedPart
            const useHybrid = extrusionCostingMethod === 'HYBRID'

            // Calculate weight-based price per piece for extrusions
            // Formula: (weightPerFoot × pricePerLb) × (stockLength / 12)
            const calculatedPricePerPiece = calculateExtrusionPricePerPiece(
              masterPart.weightPerFoot,
              masterPart.customPricePerLb,
              globalMaterialPricePerLb ?? 0,
              bestRule.stockLength || 0
            )
            // Use calculated price, fallback to basePrice if weight data is missing
            const pricePerPiece = calculatedPricePerPiece ?? bestRule.basePrice ?? 0

            if (usePercentageBased && bestRule.stockLength && pricePerPiece > 0) {
              // Calculate usage percentage
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // If more than 50% of stock remains unused, use percentage-based cost
              if (remainingPercentage > 0.5) {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                const excludedNote = isExcludedPart ? ' (Excluded Part)' : ''
                breakdown.details = `Percentage-based cost${excludedNote}: ${(usagePercentage * 100).toFixed(2)}% of stock (${requiredLength}"/${bestRule.stockLength}") × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost

                // Calculate finish cost for percentage-based pricing
                if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                  try {
                    const finishPricing = await prisma.extrusionFinishPricing.findUnique({
                      where: { finishType: finishColor, isActive: true }
                    })

                    if (finishPricing && finishPricing.costPerSqFt > 0) {
                      const finishLengthFeet = requiredLength / 12
                      const perimeterFeet = (masterPart.perimeterInches || 0) / 12
                      const surfaceSqFt = perimeterFeet * finishLengthFeet
                      const finishCostPerPiece = surfaceSqFt * finishPricing.costPerSqFt
                      const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                      breakdown.finishCost = totalFinishCost
                      breakdown.finishDetails = perimeterFeet > 0
                        ? `${finishColor}: ${perimeterFeet.toFixed(3)}' perim × ${finishLengthFeet.toFixed(2)}' = ${surfaceSqFt.toFixed(2)} sq ft × $${finishPricing.costPerSqFt}/sq ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
                        : `${finishColor}: No perimeter defined, finish cost = $0.00`
                      cost += totalFinishCost
                      breakdown.totalCost = cost
                    }
                  } catch (error) {
                    console.error('Error calculating finish cost:', error)
                  }
                }

                return { cost, breakdown }
              }
              // If 50% or less remains, fall through to full stock cost
            }

            // HYBRID costing method
            // If usage >= 50%: used portion (markup applied at quote level) + remaining at cost (no markup)
            // If usage < 50%: percentage-based (used portion only, markup at quote level)
            if (useHybrid && bestRule.stockLength && pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              if (usagePercentage >= 0.5) {
                // >= 50% used: charge markup on used portion + cost on remaining
                // At this level, we return the BASE costs - markup is applied at quote generation
                // usedPortionCost will have markup applied, remainingPortionCost will not
                const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)

                cost = usedPortionCost + remainingPortionCost // Total base cost (full stock)
                breakdown.method = 'extrusion_hybrid_split'
                breakdown.details = `Hybrid (≥50% used): ${(usagePercentage * 100).toFixed(1)}% used ($${usedPortionCost.toFixed(2)} at markup) + ${(remainingPercentage * 100).toFixed(1)}% remaining ($${remainingPortionCost.toFixed(2)} at cost). Stock: ${bestRule.stockLength}", Used: ${requiredLength}"`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
                // Store hybrid breakdown for quote-level markup calculation
                ;(breakdown as any).hybridBreakdown = {
                  usedPercentage: usagePercentage,
                  remainingPercentage: remainingPercentage,
                  usedPortionCost: usedPortionCost,
                  remainingPortionCost: remainingPortionCost
                }
              } else {
                // < 50% used: percentage-based (only charge for used portion)
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_hybrid_percentage'
                breakdown.details = `Hybrid (<50% used): ${(usagePercentage * 100).toFixed(1)}% of stock (${requiredLength}"/${bestRule.stockLength}") × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
              }

              // Calculate finish cost for hybrid pricing
              // ≥50% used: charge for full stock finish (same as material)
              // <50% used: charge for cut length finish (percentage-based)
              if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                try {
                  const finishPricing = await prisma.extrusionFinishPricing.findUnique({
                    where: { finishType: finishColor, isActive: true }
                  })

                  if (finishPricing && finishPricing.costPerSqFt > 0) {
                    // Use full stock length when ≥50% used, cut length when <50%
                    const finishLengthInches = usagePercentage >= 0.5 ? bestRule.stockLength : requiredLength
                    const finishLengthFeet = finishLengthInches / 12
                    const perimeterFeet = (masterPart.perimeterInches || 0) / 12
                    const surfaceSqFt = perimeterFeet * finishLengthFeet
                    const finishCostPerPiece = surfaceSqFt * finishPricing.costPerSqFt
                    const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                    const finishType = usagePercentage >= 0.5 ? 'full stock' : 'cut length'
                    breakdown.finishCost = totalFinishCost
                    breakdown.finishDetails = perimeterFeet > 0
                      ? `${finishColor} (${finishType}): ${perimeterFeet.toFixed(3)}' perim × ${finishLengthFeet.toFixed(2)}' = ${surfaceSqFt.toFixed(2)} sq ft × $${finishPricing.costPerSqFt}/sq ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
                      : `${finishColor}: No perimeter defined, finish cost = $0.00`
                    cost += totalFinishCost
                    breakdown.totalCost = cost
                  }
                } catch (error) {
                  console.error('Error calculating finish cost:', error)
                }
              }

              return { cost, breakdown }
            }

            // FULL_STOCK method or percentage fallback
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
              breakdown.method = usePercentageBased ? 'extrusion_full_stock_fallback' : 'extrusion_rule_formula'
              breakdown.details = `${usePercentageBased ? 'Full stock cost (>50% used): ' : ''}Extrusion rule for ${requiredLength}" length: ${bestRule.formula} (pricePerPiece: ${pricePerPiece.toFixed(2)}, stockLength: ${bestRule.stockLength}) = $${cost}`
            } else if (pricePerPiece > 0) {
              cost = pricePerPiece * (bom.quantity || 1)
              breakdown.method = usePercentageBased ? 'extrusion_full_stock_fallback' : 'extrusion_rule_base'
              breakdown.details = `${usePercentageBased ? 'Full stock cost (>50% used): ' : ''}Extrusion price for ${requiredLength}" length: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
            }
            breakdown.unitCost = cost / (bom.quantity || 1)
            breakdown.totalCost = cost

            // Calculate finish cost for extrusions if finish color is specified and NOT mill finish
            // Check isMillFinish from the MasterPart - if true, this extrusion never gets finish codes/costs
            // FULL_STOCK method: finish cost is based on full stock length (same threshold rule as material)
            if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
              try {
                const finishPricing = await prisma.extrusionFinishPricing.findUnique({
                  where: { finishType: finishColor, isActive: true }
                })

                if (finishPricing && finishPricing.costPerSqFt > 0) {
                  // Use full stock length for finish cost (follows same threshold as material)
                  const finishLengthInches = bestRule.stockLength || requiredLength
                  const finishLengthFeet = finishLengthInches / 12
                  const perimeterFeet = (masterPart.perimeterInches || 0) / 12
                  const surfaceSqFt = perimeterFeet * finishLengthFeet
                  const finishCostPerPiece = surfaceSqFt * finishPricing.costPerSqFt
                  const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                  breakdown.finishCost = totalFinishCost
                  breakdown.finishDetails = perimeterFeet > 0
                    ? `${finishColor} (full stock): ${perimeterFeet.toFixed(3)}' perim × ${finishLengthFeet.toFixed(2)}' = ${surfaceSqFt.toFixed(2)} sq ft × $${finishPricing.costPerSqFt}/sq ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
                    : `${finishColor}: No perimeter defined, finish cost = $0.00`
                  cost += totalFinishCost
                  breakdown.totalCost = cost
                }
              } catch (error) {
                console.error('Error calculating finish cost:', error)
              }
            }

            return { cost, breakdown }
          }
        }

        // For other part types: Use PricingRules
        if (masterPart.pricingRules.length > 0) {
          const rule = masterPart.pricingRules[0] // Use first active rule
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
          breakdown.details = `MasterPart direct cost: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }
      }
    } catch (error) {
      console.error(`Error looking up MasterPart for ${bom.partNumber}:`, error)
    }
  }

  breakdown.method = 'no_cost_found'
  breakdown.details = 'No pricing method found'
  breakdown.totalCost = 0
  return { cost: 0, breakdown }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const openingId = parseInt(resolvedParams.id)
    
    if (isNaN(openingId)) {
      return NextResponse.json(
        { error: 'Invalid opening ID' },
        { status: 400 }
      )
    }

    // Get the opening with all related data needed for pricing
    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      include: {
        project: {
          include: {
            pricingMode: true // Include pricing mode to get extrusion costing method
          }
        }, // Include project to get excluded parts
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productBOMs: {
                      include: {
                        option: true
                      }
                    },
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: {
                              include: {
                                linkedParts: {
                                  include: {
                                    masterPart: true,
                                    variant: true
                                  }
                                },
                                variants: {
                                  orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        presetPartInstances: {
          include: {
            presetPart: {
              include: { masterPart: true }
            }
          }
        }
      }
    })

    if (!opening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    // Fetch global material price per lb for weight-based extrusion pricing
    const materialPricePerLbSetting = await prisma.globalSetting.findUnique({
      where: { key: 'materialPricePerLb' }
    })
    const globalMaterialPricePerLb = materialPricePerLbSetting
      ? parseFloat(materialPricePerLbSetting.value)
      : 0 // Default to $0 if not set

    // Fetch framed tolerance defaults from GlobalSettings (used for FRAMED openings)
    const toleranceSettings = await prisma.globalSetting.findMany({
      where: { category: 'tolerances' }
    })
    const tolMap = new Map(toleranceSettings.map(s => [s.key, parseFloat(s.value)]))
    const framedDefaults = {
      framedWidthTolerance: tolMap.get('tolerance.framed.width') ?? 0.5,
      framedHeightTolerance: tolMap.get('tolerance.framed.height') ?? 0.75,
    }
    const thinwallDefaults = {
      thinwallWidthTolerance: tolMap.get('tolerance.thinwall.width') ?? 1.0,
      thinwallHeightTolerance: tolMap.get('tolerance.thinwall.height') ?? 1.5,
    }

    // Auto-update frame panel dimensions to match full opening dimensions
    // This ensures frames resize when opening dimensions change
    // For FRAMED openings, apply tolerance to get effective frame dimensions
    for (const panel of opening.panels) {
      if (panel.componentInstance?.product?.productType === 'FRAME') {
        let frameWidth = opening.roughWidth ?? opening.finishedWidth ?? panel.width
        let frameHeight = opening.roughHeight ?? opening.finishedHeight ?? panel.height
        if (opening.openingType === 'FRAMED' && opening.roughWidth) {
          const widthTol = opening.widthToleranceTotal ?? framedDefaults.framedWidthTolerance
          const heightTol = opening.heightToleranceTotal ?? framedDefaults.framedHeightTolerance
          frameWidth = opening.roughWidth - widthTol
          frameHeight = (opening.roughHeight ?? 0) - heightTol
        }
        // Only update if dimensions have changed
        if (panel.width !== frameWidth || panel.height !== frameHeight) {
          await prisma.panel.update({
            where: { id: panel.id },
            data: {
              width: frameWidth,
              height: frameHeight
            }
          })
          // Update local panel object for accurate pricing in this calculation
          ;(panel as any).width = frameWidth
          ;(panel as any).height = frameHeight
        }
      }
    }

    // Re-evaluate preset part formulas with current opening dimensions
    // This handles dimension changes on openings that used a preset
    if (opening.presetId && opening.presetPartInstances?.length > 0) {
      const formulaVariables: PresetFormulaVariables = {
        roughWidth: opening.roughWidth ?? 0,
        roughHeight: opening.roughHeight ?? 0,
        finishedWidth: opening.finishedWidth ?? 0,
        finishedHeight: opening.finishedHeight ?? 0
      }

      for (const instance of opening.presetPartInstances) {
        if (instance.presetPart.formula) {
          const calculatedQty = evaluatePresetFormula(instance.presetPart.formula, formulaVariables)
          const newQuantity = calculatedQty ?? instance.presetPart.quantity ?? 1

          // Only update if quantity has changed
          if (newQuantity !== instance.calculatedQuantity) {
            await prisma.openingPresetPartInstance.update({
              where: { id: instance.id },
              data: { calculatedQuantity: newQuantity }
            })
            // Update local object for accurate pricing
            ;(instance as any).calculatedQuantity = newQuantity
          }
        }
      }
    }

    const priceBreakdown = {
      components: [] as any[],
      totalComponentCost: 0,
      totalStandardOptionCost: 0, // Track standard option costs separately (no markup)
      totalHybridRemainingCost: 0, // Track HYBRID remaining costs (no markup)
      // Track costs by category for accurate markup calculation
      totalExtrusionCost: 0,
      totalHardwareCost: 0,
      totalGlassCost: 0,
      totalPackagingCost: 0,
      totalOtherCost: 0,
      totalPrice: 0
    }

    // Get extrusion costing method from pricing mode (fallback to project's setting for backward compatibility, then to FULL_STOCK)
    const extrusionCostingMethod = opening.project.pricingMode?.extrusionCostingMethod || opening.project.extrusionCostingMethod || 'FULL_STOCK'

    // Detect FRAME panel and get jambThickness for this opening
    let jambThickness = 0
    for (const p of opening.panels) {
      if (p.componentInstance?.product?.productType === 'FRAME' &&
          p.componentInstance.product.jambThickness) {
        jambThickness = p.componentInstance.product.jambThickness
        break
      }
    }

    // Compute opening and interior dimensions
    // For FRAMED openings, apply tolerance to roughWidth/roughHeight
    let calcOpeningWidth = opening.roughWidth ?? 0
    let calcOpeningHeight = opening.roughHeight ?? 0

    if (opening.openingType === 'FRAMED' && opening.roughWidth) {
      const widthTol = opening.widthToleranceTotal ?? framedDefaults.framedWidthTolerance
      const heightTol = opening.heightToleranceTotal ?? framedDefaults.framedHeightTolerance
      calcOpeningWidth = opening.roughWidth - widthTol
      calcOpeningHeight = (opening.roughHeight ?? 0) - heightTol
    } else if (opening.openingType === 'THINWALL' && opening.finishedWidth) {
      // THINWALL: finishedWidth is the actual opening; subtract tolerance for panel sizing
      const widthTol = opening.widthToleranceTotal ?? thinwallDefaults.thinwallWidthTolerance
      const heightTol = opening.heightToleranceTotal ?? thinwallDefaults.thinwallHeightTolerance
      calcOpeningWidth = opening.finishedWidth - widthTol
      calcOpeningHeight = (opening.finishedHeight ?? calcOpeningHeight) - heightTol
    } else if (opening.finishedWidth) {
      // Fallback: use finishedWidth directly
      calcOpeningWidth = opening.finishedWidth
      calcOpeningHeight = opening.finishedHeight ?? calcOpeningHeight
    }

    // Fallback: derive opening dimensions from component panels if no explicit dims
    if (calcOpeningWidth === 0 || calcOpeningHeight === 0) {
      const nonFramePanels = opening.panels.filter(
        (p: any) => p.componentInstance?.product?.productType !== 'FRAME'
      )
      if (nonFramePanels.length > 0) {
        const totalPanelWidth = nonFramePanels.reduce((sum: number, p: any) => sum + p.width, 0)
        const maxPanelHeight = Math.max(...nonFramePanels.map((p: any) => p.height))

        if (totalPanelWidth > 0 && calcOpeningWidth === 0) {
          calcOpeningWidth = totalPanelWidth
        }
        if (maxPanelHeight > 0 && calcOpeningHeight === 0) {
          calcOpeningHeight = maxPanelHeight
        }
      }
    }

    const interiorWidth = jambThickness > 0 ? calcOpeningWidth - (2 * jambThickness) : calcOpeningWidth
    const interiorHeight = jambThickness > 0 ? calcOpeningHeight - jambThickness : calcOpeningHeight

    // Reusable base variables for all formulas in this opening
    const openingLevelVars = { interiorWidth, interiorHeight, openingWidth: calcOpeningWidth, openingHeight: calcOpeningHeight, jambThickness }

    // Calculate price for each panel's component
    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      const component = panel.componentInstance
      const product = component.product
      let componentCost = 0

      // For FRAME products, use full opening dimensions (not sibling panel sum)
      const isFrameProduct = product.productType === 'FRAME'
      let effectiveWidth = panel.width
      let effectiveHeight = panel.height

      if (isFrameProduct) {
        effectiveWidth = calcOpeningWidth || panel.width
        effectiveHeight = calcOpeningHeight || panel.height
      } else if (jambThickness > 0) {
        // TRIMMED component inside frame: height = interiorHeight
        effectiveHeight = interiorHeight
      }

      const componentBreakdown = {
        productName: product.name,
        panelId: panel.id,
        width: effectiveWidth,
        height: effectiveHeight,
        bomCosts: [] as any[],
        optionCosts: [] as any[],
        glassCost: null as any,
        totalBOMCost: 0,
        totalOptionCost: 0,
        totalGlassCost: 0,
        totalComponentCost: 0
      }

      // Parse selections to determine which option-linked BOMs should be included
      // and what quantities to use for RANGE mode options
      let selections: Record<string, any> = {}
      if (component.subOptionSelections) {
        try {
          selections = JSON.parse(component.subOptionSelections)
        } catch (e) {
          console.error('Error parsing subOptionSelections for BOM processing:', e)
        }
      }

      // Parse variant selections for option linked parts pricing
      let variantSelections: Record<string, number> = {}
      if (component.variantSelections) {
        try {
          variantSelections = JSON.parse(component.variantSelections)
        } catch (e) {
          console.error('Error parsing variantSelections:', e)
        }
      }

      // Build a map of optionId -> selected quantity for RANGE mode BOMs
      const optionQuantityMap = new Map<number, number>()
      for (const productSubOption of product.productSubOptions) {
        const categoryId = productSubOption.category.id.toString()
        const selectedOptionId = selections[categoryId]
        if (selectedOptionId) {
          // Check for RANGE mode quantity
          const quantityKey = `${categoryId}_qty`
          const rangeQuantity = selections[quantityKey] !== undefined
            ? parseInt(selections[quantityKey] as string)
            : null
          if (rangeQuantity !== null) {
            optionQuantityMap.set(parseInt(selectedOptionId), rangeQuantity)
          }
        }
      }

      for (const bom of product.productBOMs) {
        // Skip ALL option-linked BOM items - they will be handled in the options section
        // This ensures options are priced separately from base BOM items
        if (bom.optionId) {
          continue
        }

        const { cost, breakdown } = await calculateBOMItemPrice(
          bom,
          effectiveWidth,
          effectiveHeight,
          extrusionCostingMethod,
          opening.project.excludedPartNumbers || [],
          opening.finishColor,
          globalMaterialPricePerLb,
          openingLevelVars
        )
        componentBreakdown.bomCosts.push(breakdown)
        componentBreakdown.totalBOMCost += cost
        componentCost += cost

        // Track HYBRID remaining costs (no markup portion)
        if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
          priceBreakdown.totalHybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
        }

        // Track costs by category for accurate markup calculation
        if (breakdown.partType === 'Extrusion' || breakdown.partType === 'CutStock') {
          priceBreakdown.totalExtrusionCost += cost
        } else if (breakdown.partType === 'Hardware' || breakdown.partType === 'Fastener') {
          priceBreakdown.totalHardwareCost += cost
        } else if (breakdown.partType === 'Glass') {
          priceBreakdown.totalGlassCost += cost
        } else if (breakdown.partType === 'Packaging') {
          priceBreakdown.totalPackagingCost += cost
        } else {
          priceBreakdown.totalOtherCost += cost
        }
      }

      // Calculate sub-option costs with standard hardware logic
      // Standard hardware: included at cost (no markup), always added if nothing selected
      // Non-standard hardware: full price with markup
      const processedCategories = new Set<string>()

      if (component.subOptionSelections) {
        try {
          const selections = JSON.parse(component.subOptionSelections)
          const includedOptions = component.includedOptions ? JSON.parse(component.includedOptions) : []

          for (const [categoryId, optionId] of Object.entries(selections)) {
            processedCategories.add(categoryId)

            // Find the product sub-option (includes standardOptionId now)
            const productSubOption = product.productSubOptions.find((pso: any) =>
              pso.category.id === parseInt(categoryId)
            )

            if (!productSubOption) continue

            const category = productSubOption.category
            const standardOptionId = productSubOption.standardOptionId
            const standardOption = standardOptionId
              ? category.individualOptions.find((io: any) => io.id === standardOptionId)
              : null

            // Check if user explicitly selected "None" (null) - skip adding any option
            if (optionId === null) {
              // User explicitly selected "None" - no option price applied
              componentBreakdown.optionCosts.push({
                categoryName: category.name,
                optionName: 'None',
                price: 0,
                isStandard: false,
                isIncluded: false,
                isNone: true
              })
              continue
            }

            if (!optionId) {
              // No option selected (undefined/empty) - if there's a standard, include its cost at cost (no markup)
              if (standardOption) {
                // Look up quantity from ProductBOM if this is a cut-list option
                const optionBom = standardOption.isCutListItem
                  ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                  : null
                const quantity = optionBom?.quantity || 1

                // Calculate price using helper that handles both hardware and extrusions
                // Get selected variant for this option from variantSelections
                const standardSelectedVariantId = variantSelections[String(standardOption.id)]
                const priceResult = await calculateOptionPrice(
                  standardOption,
                  optionBom,
                  quantity,
                  effectiveWidth,
                  effectiveHeight,
                  extrusionCostingMethod,
                  opening.project.excludedPartNumbers || [],
                  opening.finishColor,
                  globalMaterialPricePerLb,
                  standardSelectedVariantId,
                  openingLevelVars
                )

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: standardOption.name,
                  price: priceResult.totalPrice, // Cost price, no markup
                  isStandard: true,
                  isIncluded: false,
                  linkedPartsCost: priceResult.linkedPartsCost
                })
                componentBreakdown.totalOptionCost += priceResult.totalPrice
                componentCost += priceResult.totalPrice
                priceBreakdown.totalStandardOptionCost += priceResult.totalPrice // Track for no-markup
                // Track in correct category based on part type
                if (priceResult.isExtrusion) {
                  priceBreakdown.totalExtrusionCost += priceResult.totalPrice
                  // Track hybrid remaining cost for extrusion options
                  if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                    priceBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                  }
                } else {
                  priceBreakdown.totalHardwareCost += priceResult.totalPrice
                }
              }
              continue
            }

            // Option was selected
            const selectedOption = category.individualOptions.find((io: any) =>
              io.id === parseInt(optionId as string)
            )

            if (selectedOption) {
              const isIncluded = includedOptions.includes(selectedOption.id)
              const isStandardSelected = standardOptionId === selectedOption.id

              // Look up quantity from ProductBOM if this is a cut-list option
              const optionBom = selectedOption.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === selectedOption.id)
                : null

              // Check for user-selected quantity (RANGE mode stores it as categoryId_qty)
              const quantityKey = `${categoryId}_qty`
              const userSelectedQuantity = selections[quantityKey] !== undefined
                ? parseInt(selections[quantityKey] as string)
                : null

              // Use user-selected quantity for RANGE mode, otherwise use BOM quantity
              const quantity = userSelectedQuantity !== null
                ? userSelectedQuantity
                : (optionBom?.quantity || 1)

              // Calculate price using helper that handles both hardware and extrusions
              // Get selected variant for this option from variantSelections
              const selectedVariantId = variantSelections[String(selectedOption.id)]
              const priceResult = await calculateOptionPrice(
                selectedOption,
                optionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                opening.project.excludedPartNumbers || [],
                opening.finishColor,
                globalMaterialPricePerLb,
                selectedVariantId,
                openingLevelVars
              )

              if (isStandardSelected) {
                // Standard option selected - cost only, no markup
                const optionPrice = isIncluded ? 0 : priceResult.totalPrice

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: true,
                  isIncluded: isIncluded,
                  linkedPartsCost: priceResult.linkedPartsCost
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice
                priceBreakdown.totalStandardOptionCost += optionPrice // Track for no-markup
                // Track in correct category based on part type
                if (priceResult.isExtrusion) {
                  priceBreakdown.totalExtrusionCost += optionPrice
                  // Track hybrid remaining cost for extrusion options
                  if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                    priceBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                  }
                } else {
                  priceBreakdown.totalHardwareCost += optionPrice
                }
              } else {
                // Non-standard option selected
                // Standard portion: at cost (no markup) - always include base standard cost
                // Upgrade portion: full price minus standard (markup applied at project level)
                const optionPrice = isIncluded ? 0 : priceResult.totalPrice

                // Get standard option price using helper
                const standardOptionBom = standardOption?.isCutListItem
                  ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                  : null
                // Use the same variant selection for standard option pricing comparison
                const standardVariantId = standardOption ? variantSelections[String(standardOption.id)] : undefined
                const standardPriceResult = standardOption
                  ? await calculateOptionPrice(
                      standardOption,
                      standardOptionBom,
                      quantity,
                      effectiveWidth,
                      effectiveHeight,
                      extrusionCostingMethod,
                      opening.project.excludedPartNumbers || [],
                      opening.finishColor,
                      globalMaterialPricePerLb,
                      standardVariantId,
                      openingLevelVars
                    )
                  : { unitPrice: 0, totalPrice: 0, isExtrusion: false }

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: false,
                  standardDeducted: standardPriceResult.unitPrice,
                  isIncluded: isIncluded,
                  linkedPartsCost: priceResult.linkedPartsCost
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice

                // Track the standard portion in standardOptionCost (no markup)
                // Track full option in correct category (quote route will subtract standardOptionCost before markup)
                priceBreakdown.totalStandardOptionCost += standardPriceResult.totalPrice
                if (priceResult.isExtrusion) {
                  priceBreakdown.totalExtrusionCost += optionPrice
                  // Track hybrid remaining cost for extrusion options
                  if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                    priceBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                  }
                } else {
                  priceBreakdown.totalHardwareCost += optionPrice
                }
              }
            }
          }
        } catch (error) {
          console.error('Error parsing sub-option selections:', error)
        }
      }

      // Add standard options for categories that weren't in selections at all
      for (const productSubOption of product.productSubOptions) {
        const categoryId = productSubOption.category.id.toString()
        if (!processedCategories.has(categoryId) && productSubOption.standardOptionId) {
          const standardOption = productSubOption.category.individualOptions.find(
            (io: any) => io.id === productSubOption.standardOptionId
          )
          if (standardOption) {
            // Look up quantity from ProductBOM if this is a cut-list option
            const optionBom = standardOption.isCutListItem
              ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
              : null
            const quantity = optionBom?.quantity || 1

            // Calculate price using helper that handles both hardware and extrusions
            // Get selected variant for this option from variantSelections
            const unprocessedSelectedVariantId = variantSelections[String(standardOption.id)]
            const priceResult = await calculateOptionPrice(
              standardOption,
              optionBom,
              quantity,
              effectiveWidth,
              effectiveHeight,
              extrusionCostingMethod,
              opening.project.excludedPartNumbers || [],
              opening.finishColor,
              globalMaterialPricePerLb,
              unprocessedSelectedVariantId,
              openingLevelVars
            )

            componentBreakdown.optionCosts.push({
              categoryName: productSubOption.category.name,
              optionName: standardOption.name,
              price: priceResult.totalPrice, // At cost
              linkedPartsCost: priceResult.linkedPartsCost,
              isStandard: true,
              isIncluded: false
            })
            componentBreakdown.totalOptionCost += priceResult.totalPrice
            componentCost += priceResult.totalPrice
            priceBreakdown.totalStandardOptionCost += priceResult.totalPrice // Track for no-markup
            // Track in correct category based on part type
            if (priceResult.isExtrusion) {
              priceBreakdown.totalExtrusionCost += priceResult.totalPrice
              // Track hybrid remaining cost for extrusion options
              if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                priceBreakdown.totalHybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
              }
            } else {
              priceBreakdown.totalHardwareCost += priceResult.totalPrice
            }
          }
        }
      }

      // Calculate glass cost if glass type is specified
      if (panel.glassType && panel.glassType !== 'N/A') {
        console.log(`[Glass Pricing] Panel ${panel.id} has glass type: ${panel.glassType}`)
        try {
          // Fetch glass type pricing from database (include attached parts)
          const glassType = await prisma.glassType.findUnique({
            where: { name: panel.glassType },
            include: {
              parts: {
                include: {
                  masterPart: true
                }
              }
            }
          })

          console.log(`[Glass Pricing] Found glass type in DB:`, glassType)
          console.log(`[Glass Pricing] Product glass formulas:`, {
            width: product.glassWidthFormula,
            height: product.glassHeightFormula,
            quantity: product.glassQuantityFormula
          })

          if (glassType && product.glassWidthFormula && product.glassHeightFormula) {
            const variables = {
              width: effectiveWidth,
              height: effectiveHeight,
              ...openingLevelVars
            }

            console.log(`[Glass Pricing] Variables for formulas:`, variables)

            // Calculate glass dimensions
            const glassWidth = evaluateFormula(product.glassWidthFormula, variables)
            const glassHeight = evaluateFormula(product.glassHeightFormula, variables)
            const glassQuantity = product.glassQuantityFormula
              ? evaluateFormula(product.glassQuantityFormula, variables)
              : 1

            console.log(`[Glass Pricing] Calculated dimensions - width: ${glassWidth}", height: ${glassHeight}", quantity: ${glassQuantity}`)

            // Check for invalid dimensions
            if (glassWidth <= 0 || glassHeight <= 0) {
              console.error(`[Glass Pricing] ERROR: Invalid glass dimensions! Width: ${glassWidth}, Height: ${glassHeight}`)
              console.error(`[Glass Pricing] Product formulas may be incorrect. Expected formulas like "width - 5" not "-5"`)
              console.error(`[Glass Pricing] Current formulas:`, {
                width: product.glassWidthFormula,
                height: product.glassHeightFormula
              })
            }

            // Calculate square footage (convert inches to square feet)
            const sqft = (glassWidth * glassHeight / 144) * glassQuantity
            const glassCost = sqft * glassType.pricePerSqFt

            console.log(`[Glass Pricing] Sqft: ${sqft}, Price/sqft: $${glassType.pricePerSqFt}, Total: $${glassCost}`)

            componentBreakdown.glassCost = {
              glassType: glassType.name,
              width: glassWidth,
              height: glassHeight,
              quantity: glassQuantity,
              sqft: Math.round(sqft * 100) / 100,
              pricePerSqFt: glassType.pricePerSqFt,
              totalCost: Math.round(glassCost * 100) / 100
            }

            componentBreakdown.totalGlassCost = Math.round(glassCost * 100) / 100
            componentCost += componentBreakdown.totalGlassCost
            // Track glass cost for accurate category markup calculation
            priceBreakdown.totalGlassCost += componentBreakdown.totalGlassCost

            console.log(`[Glass Pricing] Calculated glass cost: $${componentBreakdown.totalGlassCost}`)

            // Process glass type parts (e.g., vinyl frosting by linear feet)
            if (glassType.parts && glassType.parts.length > 0) {
              console.log(`[Glass Type Parts] Processing ${glassType.parts.length} attached parts`)

              // Initialize glass type parts array in breakdown
              ;(componentBreakdown as any).glassTypeParts = []

              for (const gtp of glassType.parts) {
                const partVariables = {
                  width: effectiveWidth,
                  height: effectiveHeight,
                  glassWidth: glassWidth,
                  glassHeight: glassHeight,
                  ...openingLevelVars
                }

                // Calculate quantity from formula or use fixed quantity
                let partQuantity = gtp.quantity || 1
                if (gtp.formula) {
                  partQuantity = evaluateFormula(gtp.formula, partVariables)
                }

                // Get part cost from MasterPart
                const unitCost = gtp.masterPart.cost || 0
                const partCost = unitCost * partQuantity

                console.log(`[Glass Type Parts] Part ${gtp.masterPart.partNumber}: qty=${partQuantity.toFixed(2)}, cost=$${partCost.toFixed(2)}`)

                // Add to breakdown
                ;(componentBreakdown as any).glassTypeParts.push({
                  partNumber: gtp.masterPart.partNumber,
                  partName: gtp.masterPart.baseName,
                  formula: gtp.formula,
                  quantity: Math.round(partQuantity * 100) / 100,
                  unitCost: unitCost,
                  totalCost: Math.round(partCost * 100) / 100
                })

                // Add to component cost and hardware category
                componentCost += partCost
                priceBreakdown.totalHardwareCost += partCost
              }
            }
          } else {
            console.log(`[Glass Pricing] Missing data - glassType: ${!!glassType}, widthFormula: ${!!product.glassWidthFormula}, heightFormula: ${!!product.glassHeightFormula}`)
          }
        } catch (error) {
          console.error('[Glass Pricing] Error calculating glass cost:', error)
        }
      } else {
        console.log(`[Glass Pricing] Panel ${panel.id} - No glass type or is N/A`)
      }

      componentBreakdown.totalComponentCost = componentCost
      priceBreakdown.components.push(componentBreakdown)
      priceBreakdown.totalComponentCost += componentCost
    }

    // Calculate preset part instance costs (opening-level parts like starter channels)
    if (opening.presetPartInstances && opening.presetPartInstances.length > 0) {
      for (const instance of opening.presetPartInstances) {
        const presetPart = instance.presetPart
        const masterPart = (presetPart as any).masterPart
        if (!masterPart) continue

        const partType = masterPart.partType || 'Hardware'
        const partNumber = masterPart.partNumber

        let quantity: number
        let formulaForPricing: string | null = null

        if (presetPart.formula && partType === 'Extrusion') {
          quantity = presetPart.quantity || 1
          formulaForPricing = String(instance.calculatedQuantity || 0)
        } else {
          quantity = instance.calculatedQuantity || presetPart.quantity || 1
          formulaForPricing = presetPart.formula
        }

        const bomForPricing = {
          partNumber: partNumber,
          partName: masterPart.baseName || partNumber,
          partType: partType,
          quantity: quantity,
          formula: formulaForPricing,
          cost: 0
        }

        const presetEffectiveWidth = calcOpeningWidth || opening.roughWidth || 0
        const presetEffectiveHeight = calcOpeningHeight || opening.roughHeight || 0

        const { cost, breakdown } = await calculateBOMItemPrice(
          bomForPricing,
          presetEffectiveWidth,
          presetEffectiveHeight,
          extrusionCostingMethod,
          opening.project.excludedPartNumbers || [],
          opening.finishColor,
          globalMaterialPricePerLb,
          openingLevelVars
        )

        priceBreakdown.totalComponentCost += cost

        // Track hybrid remaining cost
        if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
          priceBreakdown.totalHybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
        }

        // Categorize by part type
        if (partType === 'Extrusion' || partType === 'CutStock') {
          priceBreakdown.totalExtrusionCost += cost
        } else if (partType === 'Hardware' || partType === 'Fastener') {
          priceBreakdown.totalHardwareCost += cost
        } else if (partType === 'Glass') {
          priceBreakdown.totalGlassCost += cost
        } else if (partType === 'Packaging') {
          priceBreakdown.totalPackagingCost += cost
        } else {
          priceBreakdown.totalOtherCost += cost
        }
      }
    }

    priceBreakdown.totalPrice = Math.round(priceBreakdown.totalComponentCost * 100) / 100

    // Update the opening price in the database with timestamp
    await prisma.opening.update({
      where: { id: openingId },
      data: {
        price: priceBreakdown.totalPrice,
        extrusionCost: priceBreakdown.totalExtrusionCost,
        hardwareCost: priceBreakdown.totalHardwareCost,
        glassCost: priceBreakdown.totalGlassCost,
        packagingCost: priceBreakdown.totalPackagingCost,
        otherCost: priceBreakdown.totalOtherCost,
        standardOptionCost: priceBreakdown.totalStandardOptionCost,
        hybridRemainingCost: priceBreakdown.totalHybridRemainingCost,
        priceCalculatedAt: new Date()
      }
    })

    return NextResponse.json({
      openingId,
      calculatedPrice: priceBreakdown.totalPrice,
      breakdown: priceBreakdown
    })
  } catch (error) {
    console.error('Error calculating opening price:', error)
    return NextResponse.json(
      { error: 'Failed to calculate opening price' },
      { status: 500 }
    )
  }
}
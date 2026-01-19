import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
function findBestStockLengthRule(rules: any[], requiredLength: number): any | null {
  // Find matching rules based on length only
  const matchingRules = rules.filter(rule => {
    const matchesLength = (rule.minHeight === null || requiredLength >= rule.minHeight) &&
                         (rule.maxHeight === null || requiredLength <= rule.maxHeight)
    return matchesLength && rule.isActive
  })

  if (matchingRules.length === 0) return null

  // Sort by specificity (tightest range first)
  const bestRule = matchingRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
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
  selectedVariantId?: number | null
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
          globalMaterialPricePerLb
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
async function calculateBOMItemPrice(bom: any, componentWidth: number, componentHeight: number, extrusionCostingMethod?: string, excludedPartNumbers?: string[], finishColor?: string | null, globalMaterialPricePerLb?: number): Promise<{cost: number, breakdown: any}> {
  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1
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

  // Method 1: Direct cost from ProductBOM
  if (bom.cost && bom.cost > 0) {
    cost = bom.cost * (bom.quantity || 1)
    breakdown.method = 'direct_bom_cost'
    breakdown.unitCost = bom.cost
    breakdown.totalCost = cost
    breakdown.details = `Direct cost from ProductBOM: $${bom.cost} × ${bom.quantity || 1}`
    return { cost, breakdown }
  }

  // Method 2: Skip BOM formulas for extrusions - they are only for cut length calculations
  // Extrusion pricing should be determined by stock length rules based on component dimensions
  if (bom.formula && bom.partType !== 'Extrusion') {
    cost = evaluateFormula(bom.formula, variables)
    breakdown.method = 'bom_formula'
    breakdown.unitCost = cost / (bom.quantity || 1)
    breakdown.totalCost = cost
    breakdown.details = `Formula: ${bom.formula} = $${cost}`
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

        // For CutStock: Use StockLengthRules with fixed pricePerPiece from ExtrusionVariant
        if (masterPart.partType === 'CutStock' && masterPart.stockLengthRules.length > 0) {
          const requiredLength = calculateRequiredPartLength(bom, variables)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength)

          if (bestRule && bestRule.stockLength) {
            // Look up pricePerPiece from ExtrusionVariant for this stock length
            const variant = await prisma.extrusionVariant.findFirst({
              where: {
                masterPartId: masterPart.id,
                stockLength: bestRule.stockLength,
                isActive: true
              }
            })

            const pricePerPiece = variant?.pricePerPiece ?? bestRule.basePrice ?? 0

            if (pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength

              // Apply same costing methods as extrusions but with fixed price
              if (extrusionCostingMethod === 'PERCENTAGE_BASED' && usagePercentage < 0.5) {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'cutstock_percentage_based'
                breakdown.details = `CutStock percentage: ${(usagePercentage * 100).toFixed(1)}% of stock (${requiredLength}"/${bestRule.stockLength}") × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
              } else if (extrusionCostingMethod === 'HYBRID') {
                const remainingPercentage = 1 - usagePercentage
                if (usagePercentage >= 0.5) {
                  const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                  cost = usedPortionCost + remainingPortionCost
                  breakdown.method = 'cutstock_hybrid_split'
                  breakdown.details = `CutStock hybrid: ${(usagePercentage * 100).toFixed(1)}% used ($${usedPortionCost.toFixed(2)}) + ${(remainingPercentage * 100).toFixed(1)}% remaining ($${remainingPortionCost.toFixed(2)})`
                  ;(breakdown as any).hybridBreakdown = {
                    usedPercentage: usagePercentage,
                    remainingPercentage: remainingPercentage,
                    usedPortionCost,
                    remainingPortionCost
                  }
                } else {
                  cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  breakdown.method = 'cutstock_hybrid_percentage'
                  breakdown.details = `CutStock hybrid (<50%): ${(usagePercentage * 100).toFixed(1)}% of stock × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
                }
              } else {
                // FULL_STOCK - charge full piece price
                cost = pricePerPiece * (bom.quantity || 1)
                breakdown.method = 'cutstock_full_piece'
                breakdown.details = `CutStock full piece: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1}`
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

          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength)
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

                    if (finishPricing && finishPricing.costPerFoot > 0) {
                      const cutLengthFeet = requiredLength / 12
                      const finishCostPerPiece = cutLengthFeet * finishPricing.costPerFoot
                      const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                      breakdown.finishCost = totalFinishCost
                      breakdown.finishDetails = `${finishColor} finish: ${cutLengthFeet.toFixed(2)}' × $${finishPricing.costPerFoot}/ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
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

                  if (finishPricing && finishPricing.costPerFoot > 0) {
                    // Use full stock length when ≥50% used, cut length when <50%
                    const finishLengthInches = usagePercentage >= 0.5 ? bestRule.stockLength : requiredLength
                    const finishLengthFeet = finishLengthInches / 12
                    const finishCostPerPiece = finishLengthFeet * finishPricing.costPerFoot
                    const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                    const finishType = usagePercentage >= 0.5 ? 'full stock' : 'cut length'
                    breakdown.finishCost = totalFinishCost
                    breakdown.finishDetails = `${finishColor} finish (${finishType}): ${finishLengthFeet.toFixed(2)}' × $${finishPricing.costPerFoot}/ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
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

                if (finishPricing && finishPricing.costPerFoot > 0) {
                  // Use full stock length for finish cost (follows same threshold as material)
                  const finishLengthInches = bestRule.stockLength || requiredLength
                  const finishLengthFeet = finishLengthInches / 12
                  const finishCostPerPiece = finishLengthFeet * finishPricing.costPerFoot
                  const totalFinishCost = finishCostPerPiece * (bom.quantity || 1)

                  breakdown.finishCost = totalFinishCost
                  breakdown.finishDetails = `${finishColor} finish (full stock): ${finishLengthFeet.toFixed(2)}' × $${finishPricing.costPerFoot}/ft × ${bom.quantity || 1} = $${totalFinishCost.toFixed(2)}`
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

    // Auto-update frame panel dimensions based on sibling panels
    // This ensures frames resize when components are added/removed/modified
    for (const panel of opening.panels) {
      if (panel.componentInstance?.product?.productType === 'FRAME') {
        const frameDimensions = getFrameDimensions(opening.panels, panel.id)
        // Only update if dimensions have changed
        if (panel.width !== frameDimensions.width || panel.height !== frameDimensions.height) {
          await prisma.panel.update({
            where: { id: panel.id },
            data: {
              width: frameDimensions.width,
              height: frameDimensions.height
            }
          })
          // Update local panel object for accurate pricing in this calculation
          ;(panel as any).width = frameDimensions.width
          ;(panel as any).height = frameDimensions.height
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

    // Calculate price for each panel's component
    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      const component = panel.componentInstance
      const product = component.product
      let componentCost = 0

      // For FRAME products, calculate dimensions dynamically from sibling panels
      const isFrameProduct = product.productType === 'FRAME'
      let effectiveWidth = panel.width
      let effectiveHeight = panel.height

      if (isFrameProduct) {
        const frameDimensions = getFrameDimensions(opening.panels, panel.id)
        effectiveWidth = frameDimensions.width
        effectiveHeight = frameDimensions.height
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

      // Calculate BOM costs using proper pricing rules
      // Get extrusion costing method from pricing mode (fallback to project's setting for backward compatibility, then to FULL_STOCK)
      const extrusionCostingMethod = opening.project.pricingMode?.extrusionCostingMethod || opening.project.extrusionCostingMethod || 'FULL_STOCK'

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

      // Track option IDs whose BOMs are processed in the BOM loop
      // to prevent double-counting in the option pricing section
      const processedOptionBomIds = new Set<number>()

      for (const bom of product.productBOMs) {
        // Skip option-linked BOM items if the option is not selected
        if (bom.optionId) {
          // Find which category this option belongs to
          const linkedOption = product.productSubOptions.find((pso: any) =>
            pso.category.individualOptions?.some((io: any) => io.id === bom.optionId)
          )
          if (linkedOption) {
            const categoryId = linkedOption.category.id.toString()
            const selectedOptionId = selections[categoryId]
            // Skip this BOM if its option is not selected
            if (!selectedOptionId || parseInt(selectedOptionId) !== bom.optionId) {
              continue
            }
            // Track that this option's BOM will be processed (cost already added)
            processedOptionBomIds.add(bom.optionId)
          }
        }

        // For RANGE mode BOMs, override the quantity with user-selected value
        let bomWithQuantity = bom
        if (bom.optionId && bom.quantityMode === 'RANGE' && optionQuantityMap.has(bom.optionId)) {
          const userQuantity = optionQuantityMap.get(bom.optionId)!
          bomWithQuantity = { ...bom, quantity: userQuantity }
        }

        const { cost, breakdown } = await calculateBOMItemPrice(
          bomWithQuantity,
          effectiveWidth,
          effectiveHeight,
          extrusionCostingMethod,
          opening.project.excludedPartNumbers || [],
          opening.finishColor,
          globalMaterialPricePerLb
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
        } else if (breakdown.partType === 'Hardware') {
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
                  standardSelectedVariantId
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
                selectedVariantId
              )

              // Check if this option's BOM was already processed in the BOM loop
              // to prevent double-counting extrusion options with ProductBOM entries
              const bomAlreadyProcessed = processedOptionBomIds.has(selectedOption.id)

              if (isStandardSelected) {
                // Standard option selected - cost only, no markup
                // If BOM was already processed, don't add cost again (it's already in totalBOMCost)
                const optionPrice = isIncluded || bomAlreadyProcessed ? 0 : priceResult.totalPrice

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: true,
                  isIncluded: isIncluded,
                  linkedPartsCost: priceResult.linkedPartsCost,
                  ...(bomAlreadyProcessed && { bomProcessedSeparately: true })
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice
                priceBreakdown.totalStandardOptionCost += optionPrice // Track for no-markup
                // Track in correct category based on part type (only if not already processed in BOM)
                if (!bomAlreadyProcessed) {
                  if (priceResult.isExtrusion) {
                    priceBreakdown.totalExtrusionCost += optionPrice
                  } else {
                    priceBreakdown.totalHardwareCost += optionPrice
                  }
                }
              } else {
                // Non-standard option selected
                // Standard portion: at cost (no markup) - always include base standard cost
                // Upgrade portion: full price minus standard (markup applied at project level)
                // If BOM was already processed, don't add cost again
                const optionPrice = isIncluded || bomAlreadyProcessed ? 0 : priceResult.totalPrice

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
                      standardVariantId
                    )
                  : { unitPrice: 0, totalPrice: 0, isExtrusion: false }

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: false,
                  standardDeducted: standardPriceResult.unitPrice,
                  isIncluded: isIncluded,
                  linkedPartsCost: priceResult.linkedPartsCost,
                  ...(bomAlreadyProcessed && { bomProcessedSeparately: true })
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice

                // Track the standard portion in standardOptionCost (no markup)
                // Track full option in correct category (quote route will subtract standardOptionCost before markup)
                // Only add if not already processed in BOM loop
                if (!bomAlreadyProcessed) {
                  priceBreakdown.totalStandardOptionCost += standardPriceResult.totalPrice
                  if (priceResult.isExtrusion) {
                    priceBreakdown.totalExtrusionCost += optionPrice
                  } else {
                    priceBreakdown.totalHardwareCost += optionPrice
                  }
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
              unprocessedSelectedVariantId
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
              width: panel.width,
              height: panel.height
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
                  width: panel.width,
                  height: panel.height,
                  glassWidth: glassWidth,
                  glassHeight: glassHeight
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
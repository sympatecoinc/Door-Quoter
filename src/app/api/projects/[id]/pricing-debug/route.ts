import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, value.toString())
    }

    if (!expression || expression.trim() === '') {
      return 0
    }

    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    return 0
  }
}

// Function to find the best stock length rule for extrusions
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
  if (bom.formula) {
    try {
      return evaluateFormula(bom.formula, variables)
    } catch (error) {
      return 0
    }
  }
  return bom.quantity || 0
}

// Calculate extrusion price per piece using weight-based formula
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

// Helper function to calculate option price - handles both hardware and extrusions
async function calculateOptionPrice(
  option: { partNumber?: string | null; isCutListItem: boolean; id: number; name: string },
  optionBom: any | null,
  quantity: number,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  globalMaterialPricePerLb: number
): Promise<{ unitPrice: number; totalPrice: number; isExtrusion: boolean; breakdown?: any }> {
  if (!option.partNumber) {
    return { unitPrice: 0, totalPrice: 0, isExtrusion: false }
  }

  // Look up MasterPart to check if it's an extrusion
  const masterPart = await prisma.masterPart.findUnique({
    where: { partNumber: option.partNumber },
    select: { partType: true, cost: true }
  })

  if (!masterPart) {
    return { unitPrice: 0, totalPrice: 0, isExtrusion: false }
  }

  // If it's an extrusion with a BOM entry, use full extrusion pricing logic
  if (masterPart.partType === 'Extrusion' && optionBom) {
    // Create a BOM-like object for calculateBOMItemPrice
    const bomForPricing = {
      partNumber: option.partNumber,
      partName: option.name,
      partType: 'Extrusion',
      quantity: quantity,
      formula: optionBom.formula,
      cost: optionBom.cost
    }

    const { cost, breakdown } = await calculateBOMItemPrice(
      bomForPricing,
      componentWidth,
      componentHeight,
      extrusionCostingMethod,
      excludedPartNumbers,
      finishColor,
      globalMaterialPricePerLb
    )

    return {
      unitPrice: cost / quantity,
      totalPrice: cost,
      isExtrusion: true,
      breakdown
    }
  }

  // For hardware and other part types, use direct cost
  const unitPrice = masterPart.cost ?? 0
  return {
    unitPrice,
    totalPrice: unitPrice * quantity,
    isExtrusion: false
  }
}

// Calculate BOM item price with detailed breakdown
async function calculateBOMItemPrice(
  bom: any,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  globalMaterialPricePerLb: number
): Promise<{cost: number, breakdown: any}> {
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
    finishDetails: '',
    stockLength: 0,
    cutLength: 0
  }

  // Method 0: Check for Hardware items with LF unit and formula
  if (bom.formula && bom.partNumber) {
    try {
      const lfCheck = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        select: { unit: true, cost: true, partType: true }
      })

      if (lfCheck?.partType === 'Hardware' && lfCheck?.unit === 'LF' && lfCheck?.cost && lfCheck.cost > 0) {
        const dimensionInches = evaluateFormula(bom.formula, variables)
        const linearFeet = dimensionInches / 12
        cost = lfCheck.cost * linearFeet * (bom.quantity || 1)
        breakdown.method = 'master_part_hardware_lf'
        breakdown.unitCost = lfCheck.cost
        breakdown.totalCost = cost
        breakdown.details = `Hardware (LF): Formula "${bom.formula}" = ${dimensionInches}" = ${linearFeet.toFixed(2)} LF × $${lfCheck.cost}/LF × ${bom.quantity || 1}`
        return { cost, breakdown }
      }
    } catch (error) {
      // Continue to next method
    }
  }

  // NOTE: ProductBOM.cost is no longer used for pricing
  // All pricing should come from MasterPart (inventory level)
  // Extrusions use StockLengthRules, everything else uses MasterPart.cost

  // Method 1: Formula for non-extrusions (excluding CutStock which has its own hybrid costing)
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

  // Method 3: MasterPart lookup
  if (bom.partNumber) {
    try {
      const masterPart = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        include: {
          stockLengthRules: { where: { isActive: true } },
          pricingRules: { where: { isActive: true } }
        }
      }) as any // Cast to any to access isMillFinish

      if (masterPart) {
        // Hardware: direct cost
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_hardware'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }

        // CutStock: Use MasterPart.cost from inventory with hybrid percentage-based costing
        if (masterPart.partType === 'CutStock' && masterPart.stockLengthRules.length > 0) {
          const requiredLength = calculateRequiredPartLength(bom, variables)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, componentWidth, componentHeight)

          if (bestRule) {
            // Use MasterPart.cost from inventory (NOT weight-based), fallback to StockLengthRule basePrice
            const pricePerPiece = masterPart.cost ?? bestRule.basePrice ?? 0

            if (pricePerPiece > 0 && bestRule.stockLength) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // Set stock and cut length for display
              breakdown.stockLength = bestRule.stockLength
              breakdown.cutLength = requiredLength

              // Apply same costing methods as extrusions
              if (extrusionCostingMethod === 'HYBRID') {
                if (usagePercentage >= 0.5) {
                  // ≥50% used: charge used portion at markup + remaining at cost
                  const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                  const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                  cost = usedPortionCost + remainingPortionCost
                  breakdown.method = 'extrusion_hybrid_split'
                  breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used) | Piece price: $${pricePerPiece.toFixed(2)} | Used: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${usedPortionCost.toFixed(2)} (gets markup) | Remaining: ${(remainingPercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${remainingPortionCost.toFixed(2)} (no markup) | Material total: $${cost.toFixed(2)}`
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
                  breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used, <50%) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                }
              } else if (extrusionCostingMethod === 'PERCENTAGE_BASED') {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
              } else {
                // FULL_STOCK - charge full piece price
                cost = pricePerPiece * (bom.quantity || 1)
                breakdown.method = 'extrusion_full_stock'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock | Piece price: $${pricePerPiece.toFixed(2)} | Calc: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
              }

              breakdown.unitCost = cost / (bom.quantity || 1)
              breakdown.totalCost = cost
              return { cost, breakdown }
            }
          }
        }

        // Extrusions: stock length rules
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
              globalMaterialPricePerLb,
              bestRule.stockLength || 0
            )
            const pricePerPiece = calculatedPricePerPiece ?? bestRule.basePrice ?? 0

            if (usePercentageBased && bestRule.stockLength && pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // Set stock and cut length for display
              breakdown.stockLength = bestRule.stockLength
              breakdown.cutLength = requiredLength

              if (remainingPercentage > 0.5) {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                const excludedNote = isExcludedPart ? ' (Excluded Part)' : ''
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used)${excludedNote} | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(2)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost

                // Calculate finish cost for percentage-based pricing
                if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                  try {
                    const finishPricing = await prisma.extrusionFinishPricing.findFirst({
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
                    // Continue without finish cost
                  }
                }

                return { cost, breakdown }
              }
            }

            if (useHybrid && bestRule.stockLength && pricePerPiece > 0) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // Set stock and cut length for display
              breakdown.stockLength = bestRule.stockLength
              breakdown.cutLength = requiredLength

              if (usagePercentage >= 0.5) {
                const usedPortionCost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                const remainingPortionCost = pricePerPiece * remainingPercentage * (bom.quantity || 1)
                cost = usedPortionCost + remainingPortionCost
                breakdown.method = 'extrusion_hybrid_split'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used) | Piece price: $${pricePerPiece.toFixed(2)} | Used: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${usedPortionCost.toFixed(2)} (gets markup) | Remaining: ${(remainingPercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} = $${remainingPortionCost.toFixed(2)} (no markup) | Material total: $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
                ;(breakdown as any).hybridBreakdown = {
                  usedPercentage: usagePercentage,
                  remainingPercentage: remainingPercentage,
                  usedPortionCost: usedPortionCost,
                  remainingPortionCost: remainingPortionCost
                }
              } else {
                cost = pricePerPiece * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_hybrid_percentage'
                breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (${(usagePercentage * 100).toFixed(1)}% used, <50%) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: ${(usagePercentage * 100).toFixed(1)}% × $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
              }

              // Calculate finish cost for hybrid pricing
              // ≥50% used: charge for full stock finish (same as material)
              // <50% used: charge for cut length finish (percentage-based)
              if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                try {
                  const finishPricing = await prisma.extrusionFinishPricing.findFirst({
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
                  // Continue without finish cost
                }
              }

              return { cost, breakdown }
            }

            // Full stock method
            if (pricePerPiece > 0) {
              // Set stock and cut length for display
              breakdown.stockLength = bestRule.stockLength
              breakdown.cutLength = requiredLength

              cost = pricePerPiece * (bom.quantity || 1)
              breakdown.method = 'extrusion_full_stock'
              breakdown.details = `Cut ${requiredLength.toFixed(2)}" from ${bestRule.stockLength}" stock (full stock charged) | Piece price: $${pricePerPiece.toFixed(2)} | Calc: $${pricePerPiece.toFixed(2)} × ${bom.quantity || 1} qty = $${cost.toFixed(2)}`
              breakdown.unitCost = pricePerPiece
              breakdown.totalCost = cost

              // Calculate finish cost for full stock pricing (based on full stock length)
              if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
                try {
                  const finishPricing = await prisma.extrusionFinishPricing.findFirst({
                    where: { finishType: finishColor, isActive: true }
                  })

                  if (finishPricing && finishPricing.costPerSqFt > 0) {
                    // Use full stock length for finish cost
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
                  // Continue without finish cost
                }
              }

              return { cost, breakdown }
            }
          }
        }

        // Pricing rules
        if (masterPart.pricingRules.length > 0) {
          const rule = masterPart.pricingRules[0]
          if (rule.formula) {
            const ruleVariables = { ...variables, basePrice: rule.basePrice || 0 }
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

        // Direct MasterPart cost
        if (masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_direct'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `MasterPart direct: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }
      }
    } catch (error) {
      // Continue
    }
  }

  breakdown.method = 'no_cost_found'
  breakdown.details = 'No pricing method found'
  breakdown.totalCost = 0
  return { cost: 0, breakdown }
}

// Helper to get FRAME dimensions from sibling panels
function getFrameDimensions(panels: any[], currentPanelId: number): { width: number; height: number } {
  const siblingPanels = panels.filter(p =>
    p.id !== currentPanelId &&
    p.componentInstance?.product?.productType !== 'FRAME'
  )

  if (siblingPanels.length === 0) {
    return { width: 0, height: 0 }
  }

  const width = siblingPanels.reduce((sum, p) => sum + (p.width || 0), 0)
  const height = Math.max(...siblingPanels.map(p => p.height || 0))

  return { width, height }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Fetch global material price per lb
    const materialPricePerLbSetting = await prisma.globalSetting.findUnique({
      where: { key: 'materialPricePerLb' }
    })
    const globalMaterialPricePerLb = materialPricePerLbSetting
      ? parseFloat(materialPricePerLbSetting.value)
      : 0

    // Fetch project with all related data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pricingMode: true,
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              orderBy: { displayOrder: 'asc' },
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: {
                          include: { option: true }
                        },
                        productSubOptions: {
                          include: {
                            category: {
                              include: { individualOptions: true }
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

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const pricingMode = project.pricingMode
    const extrusionCostingMethod = pricingMode?.extrusionCostingMethod || project.extrusionCostingMethod || 'FULL_STOCK'

    // Build detailed pricing data
    const openingsData = []
    let projectTotalBaseCost = 0
    let projectTotalMarkedUpCost = 0

    for (const opening of project.openings) {
      const openingData: any = {
        name: opening.name,
        finishColor: opening.finishColor || 'N/A',
        dimensions: {
          roughWidth: opening.roughWidth,
          roughHeight: opening.roughHeight,
          finishedWidth: opening.finishedWidth,
          finishedHeight: opening.finishedHeight
        },
        components: [],
        costSummary: {
          extrusion: { base: 0, markup: 0, markedUp: 0 },
          hardware: { base: 0, markup: 0, markedUp: 0 },
          glass: { base: 0, markup: 0, markedUp: 0 },
          packaging: { base: 0, markup: 0, markedUp: 0 },
          other: { base: 0, markup: 0, markedUp: 0 },
          standardOptions: { base: 0, markedUp: 0 },
          hybridRemaining: { base: 0, markedUp: 0 }
        },
        totalBaseCost: 0,
        totalMarkedUpCost: 0
      }

      let standardOptionCost = 0
      let hybridRemainingCost = 0

      for (const panel of opening.panels) {
        if (!panel.componentInstance) continue

        const product = panel.componentInstance.product
        const isFrameProduct = product.productType === 'FRAME'

        let effectiveWidth = panel.width
        let effectiveHeight = panel.height
        if (isFrameProduct) {
          const frameDimensions = getFrameDimensions(opening.panels, panel.id)
          effectiveWidth = frameDimensions.width
          effectiveHeight = frameDimensions.height
        }

        const componentData: any = {
          productName: product.name,
          productType: product.productType,
          panelId: panel.id,
          dimensions: { width: effectiveWidth, height: effectiveHeight },
          bomItems: [],
          optionItems: [],
          glassItem: null,
          totalBOMCost: 0,
          totalOptionCost: 0,
          totalGlassCost: 0
        }

        // Parse selections
        let selections: Record<string, any> = {}
        if (panel.componentInstance.subOptionSelections) {
          try {
            selections = JSON.parse(panel.componentInstance.subOptionSelections)
          } catch (e) {}
        }

        // Build option quantity map for RANGE mode
        const optionQuantityMap = new Map<number, number>()
        for (const productSubOption of product.productSubOptions) {
          const categoryId = productSubOption.category.id.toString()
          const selectedOptionId = selections[categoryId]
          if (selectedOptionId) {
            const quantityKey = `${categoryId}_qty`
            const rangeQuantity = selections[quantityKey] !== undefined
              ? parseInt(selections[quantityKey] as string)
              : null
            if (rangeQuantity !== null) {
              optionQuantityMap.set(parseInt(selectedOptionId), rangeQuantity)
            }
          }
        }

        // Process BOM items
        for (const bom of product.productBOMs) {
          // Skip ALL option-linked BOM items - they will be handled in the options section
          // This ensures options are priced separately from base BOM items
          if (bom.optionId) {
            continue
          }

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
            project.excludedPartNumbers || [],
            opening.finishColor,
            globalMaterialPricePerLb
          )

          componentData.bomItems.push(breakdown)
          componentData.totalBOMCost += cost

          // Track hybrid remaining cost
          if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
            hybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
          }

          // Track by category (CutStock is treated as Extrusion for pricing purposes)
          if (breakdown.partType === 'Extrusion' || breakdown.partType === 'CutStock') {
            openingData.costSummary.extrusion.base += cost
          } else if (breakdown.partType === 'Hardware') {
            openingData.costSummary.hardware.base += cost
          } else if (breakdown.partType === 'Glass') {
            openingData.costSummary.glass.base += cost
          } else if (breakdown.partType === 'Packaging') {
            openingData.costSummary.packaging.base += cost
          } else {
            openingData.costSummary.other.base += cost
          }
        }

        // Process sub-option costs
        const processedCategories = new Set<string>()
        const includedOptions = panel.componentInstance.includedOptions
          ? JSON.parse(panel.componentInstance.includedOptions)
          : []

        for (const [categoryId, optionId] of Object.entries(selections)) {
          processedCategories.add(categoryId)

          const productSubOption = product.productSubOptions.find((pso: any) =>
            pso.category.id === parseInt(categoryId)
          )

          if (!productSubOption) continue

          const category = productSubOption.category
          const standardOptionId = productSubOption.standardOptionId
          const standardOption = standardOptionId
            ? category.individualOptions.find((io: any) => io.id === standardOptionId)
            : null

          if (optionId === null) {
            componentData.optionItems.push({
              category: category.name,
              optionName: 'None',
              price: 0,
              isStandard: false,
              isIncluded: false
            })
            continue
          }

          if (!optionId) {
            // No selection - use standard
            if (standardOption) {
              const optionBom = standardOption.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                : null
              const quantity = optionBom?.quantity || 1

              // Calculate price using helper that handles both hardware and extrusions
              const priceResult = await calculateOptionPrice(
                standardOption,
                optionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                project.excludedPartNumbers || [],
                opening.finishColor,
                globalMaterialPricePerLb
              )

              componentData.optionItems.push({
                category: category.name,
                optionName: standardOption.name,
                partNumber: standardOption.partNumber,
                unitPrice: priceResult.breakdown?.unitCost ?? priceResult.unitPrice,
                quantity,
                price: priceResult.totalPrice,
                isStandard: true,
                isIncluded: false,
                method: priceResult.breakdown?.method,
                details: priceResult.breakdown?.details
              })
              componentData.totalOptionCost += priceResult.totalPrice
              standardOptionCost += priceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += priceResult.totalPrice
              } else {
                openingData.costSummary.hardware.base += priceResult.totalPrice
              }
            }
            continue
          }

          // Option selected
          const selectedOption = category.individualOptions.find((io: any) =>
            io.id === parseInt(optionId as string)
          )

          if (selectedOption) {
            const isIncluded = includedOptions.includes(selectedOption.id)
            const isStandardSelected = standardOptionId === selectedOption.id

            const optionBom = selectedOption.isCutListItem
              ? product.productBOMs?.find((bom: any) => bom.optionId === selectedOption.id)
              : null

            const quantityKey = `${categoryId}_qty`
            const userSelectedQuantity = selections[quantityKey] !== undefined
              ? parseInt(selections[quantityKey] as string)
              : null
            const quantity = userSelectedQuantity !== null
              ? userSelectedQuantity
              : (optionBom?.quantity || 1)

            // Calculate price using helper that handles both hardware and extrusions
            const priceResult = await calculateOptionPrice(
              selectedOption,
              optionBom,
              quantity,
              effectiveWidth,
              effectiveHeight,
              extrusionCostingMethod,
              project.excludedPartNumbers || [],
              opening.finishColor,
              globalMaterialPricePerLb
            )

            if (isStandardSelected) {
              // Standard option selected - cost only, no markup
              const optionPrice = isIncluded ? 0 : priceResult.totalPrice

              componentData.optionItems.push({
                category: category.name,
                optionName: selectedOption.name,
                partNumber: selectedOption.partNumber,
                unitPrice: priceResult.breakdown?.unitCost ?? priceResult.unitPrice,
                quantity,
                price: optionPrice,
                isStandard: true,
                isIncluded,
                method: priceResult.breakdown?.method,
                details: priceResult.breakdown?.details
              })
              componentData.totalOptionCost += optionPrice
              standardOptionCost += optionPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += optionPrice
              } else {
                openingData.costSummary.hardware.base += optionPrice
              }
            } else {
              // Non-standard option selected
              const optionPrice = isIncluded ? 0 : priceResult.totalPrice

              // Get standard option price using helper
              const standardOptionBom = standardOption?.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                : null
              const standardPriceResult = standardOption
                ? await calculateOptionPrice(
                    standardOption,
                    standardOptionBom,
                    quantity,
                    effectiveWidth,
                    effectiveHeight,
                    extrusionCostingMethod,
                    project.excludedPartNumbers || [],
                    opening.finishColor,
                    globalMaterialPricePerLb
                  )
                : { unitPrice: 0, totalPrice: 0, isExtrusion: false }

              componentData.optionItems.push({
                category: category.name,
                optionName: selectedOption.name,
                partNumber: selectedOption.partNumber,
                unitPrice: priceResult.breakdown?.unitCost ?? priceResult.unitPrice,
                quantity,
                price: optionPrice,
                isStandard: false,
                isIncluded,
                standardDeducted: standardPriceResult.unitPrice,
                standardPrice: standardPriceResult.totalPrice,
                method: priceResult.breakdown?.method,
                details: priceResult.breakdown?.details
              })
              componentData.totalOptionCost += optionPrice
              // Track the standard portion in standardOptionCost (no markup)
              standardOptionCost += standardPriceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += optionPrice
              } else {
                openingData.costSummary.hardware.base += optionPrice
              }
            }
          }
        }

        // Add standard options for unprocessed categories
        for (const productSubOption of product.productSubOptions) {
          const categoryId = productSubOption.category.id.toString()
          if (!processedCategories.has(categoryId) && productSubOption.standardOptionId) {
            const standardOption = productSubOption.category.individualOptions.find(
              (io: any) => io.id === productSubOption.standardOptionId
            )
            if (standardOption) {
              const optionBom = standardOption.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                : null
              const quantity = optionBom?.quantity || 1

              // Calculate price using helper that handles both hardware and extrusions
              const priceResult = await calculateOptionPrice(
                standardOption,
                optionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                project.excludedPartNumbers || [],
                opening.finishColor,
                globalMaterialPricePerLb
              )

              componentData.optionItems.push({
                category: productSubOption.category.name,
                optionName: standardOption.name,
                partNumber: standardOption.partNumber,
                unitPrice: priceResult.breakdown?.unitCost ?? priceResult.unitPrice,
                quantity,
                price: priceResult.totalPrice,
                isStandard: true,
                isIncluded: false,
                method: priceResult.breakdown?.method,
                details: priceResult.breakdown?.details
              })
              componentData.totalOptionCost += priceResult.totalPrice
              standardOptionCost += priceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += priceResult.totalPrice
              } else {
                openingData.costSummary.hardware.base += priceResult.totalPrice
              }
            }
          }
        }

        // Calculate glass cost
        if (panel.glassType && panel.glassType !== 'N/A') {
          try {
            const glassType = await prisma.glassType.findUnique({
              where: { name: panel.glassType }
            })

            if (glassType && product.glassWidthFormula && product.glassHeightFormula) {
              const variables = { width: panel.width, height: panel.height }
              const glassWidth = evaluateFormula(product.glassWidthFormula, variables)
              const glassHeight = evaluateFormula(product.glassHeightFormula, variables)
              const glassQuantity = product.glassQuantityFormula
                ? evaluateFormula(product.glassQuantityFormula, variables)
                : 1

              const sqft = (glassWidth * glassHeight / 144) * glassQuantity
              const glassCost = sqft * glassType.pricePerSqFt

              componentData.glassItem = {
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
              componentData.totalGlassCost = Math.round(glassCost * 100) / 100
              openingData.costSummary.glass.base += componentData.totalGlassCost
            }
          } catch (error) {
            // Continue
          }
        }

        openingData.components.push(componentData)
      }

      // Store standard and hybrid costs
      openingData.costSummary.standardOptions.base = standardOptionCost
      openingData.costSummary.standardOptions.markedUp = standardOptionCost
      openingData.costSummary.hybridRemaining.base = hybridRemainingCost
      openingData.costSummary.hybridRemaining.markedUp = hybridRemainingCost

      // Calculate markups
      const extrusionMarkup = pricingMode?.extrusionMarkup ?? pricingMode?.markup ?? 0
      const hardwareMarkup = pricingMode?.hardwareMarkup ?? pricingMode?.markup ?? 0
      const glassMarkup = pricingMode?.glassMarkup ?? pricingMode?.markup ?? 0
      const packagingMarkup = pricingMode?.packagingMarkup ?? pricingMode?.markup ?? 0
      const otherMarkup = pricingMode?.markup ?? 0
      const discount = pricingMode?.discount ?? 0

      // Apply markups (subtract no-markup portions first)
      const extrusionForMarkup = openingData.costSummary.extrusion.base - hybridRemainingCost
      const hardwareForMarkup = openingData.costSummary.hardware.base - standardOptionCost

      openingData.costSummary.extrusion.markup = extrusionMarkup
      openingData.costSummary.extrusion.markedUp = extrusionForMarkup * (1 + extrusionMarkup / 100) * (1 - discount / 100) + hybridRemainingCost

      openingData.costSummary.hardware.markup = hardwareMarkup
      openingData.costSummary.hardware.markedUp = hardwareForMarkup * (1 + hardwareMarkup / 100) * (1 - discount / 100) + standardOptionCost

      openingData.costSummary.glass.markup = glassMarkup
      openingData.costSummary.glass.markedUp = openingData.costSummary.glass.base * (1 + glassMarkup / 100) * (1 - discount / 100)

      openingData.costSummary.packaging.markup = packagingMarkup
      openingData.costSummary.packaging.markedUp = openingData.costSummary.packaging.base * (1 + packagingMarkup / 100) * (1 - discount / 100)

      openingData.costSummary.other.markup = otherMarkup
      openingData.costSummary.other.markedUp = openingData.costSummary.other.base * (1 + otherMarkup / 100) * (1 - discount / 100)

      // Calculate totals
      openingData.totalBaseCost =
        openingData.costSummary.extrusion.base +
        openingData.costSummary.hardware.base +
        openingData.costSummary.glass.base +
        openingData.costSummary.packaging.base +
        openingData.costSummary.other.base

      openingData.totalMarkedUpCost =
        openingData.costSummary.extrusion.markedUp +
        openingData.costSummary.hardware.markedUp +
        openingData.costSummary.glass.markedUp +
        openingData.costSummary.packaging.markedUp +
        openingData.costSummary.other.markedUp

      projectTotalBaseCost += openingData.totalBaseCost
      projectTotalMarkedUpCost += openingData.totalMarkedUpCost

      openingsData.push(openingData)
    }

    // Calculate installation
    let installationCost = 0
    if (project.installationMethod === 'MANUAL') {
      installationCost = project.manualInstallationCost || 0
    } else {
      const complexityMultipliers: Record<string, number> = {
        'SIMPLE': 0.9,
        'STANDARD': 1.0,
        'COMPLEX': 1.2,
        'VERY_COMPLEX': 1.5
      }
      const multiplier = complexityMultipliers[project.installationComplexity] || 1.0
      let productInstallationSum = 0
      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (panel.componentInstance?.product?.installationPrice) {
            productInstallationSum += panel.componentInstance.product.installationPrice
          }
        }
      }
      installationCost = productInstallationSum * multiplier
    }

    const taxAmount = (projectTotalMarkedUpCost + installationCost) * (project.taxRate || 0)
    const grandTotal = projectTotalMarkedUpCost + installationCost + taxAmount

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status
      },
      pricingMode: pricingMode ? {
        name: pricingMode.name,
        extrusionMarkup: pricingMode.extrusionMarkup,
        hardwareMarkup: pricingMode.hardwareMarkup,
        glassMarkup: pricingMode.glassMarkup,
        packagingMarkup: pricingMode.packagingMarkup,
        globalMarkup: pricingMode.markup,
        discount: pricingMode.discount,
        extrusionCostingMethod: pricingMode.extrusionCostingMethod
      } : null,
      openings: openingsData,
      totals: {
        subtotalBase: projectTotalBaseCost,
        subtotalMarkedUp: projectTotalMarkedUpCost,
        installation: installationCost,
        taxRate: project.taxRate || 0,
        taxAmount,
        grandTotal
      }
    })
  } catch (error) {
    console.error('Error generating pricing debug:', error)
    return NextResponse.json(
      { error: 'Failed to generate pricing debug data' },
      { status: 500 }
    )
  }
}

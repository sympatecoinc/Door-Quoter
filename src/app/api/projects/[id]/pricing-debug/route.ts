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

// Function to find the best stock length rule for extrusions (matching pricing-calculator.ts)
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

  // Sort by specificity (rules with more dimension constraints are preferred), then by stock length
  return matchingRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0) + (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0) + (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0)
    if (bSpecificity !== aSpecificity) return bSpecificity - aSpecificity
    return a.stockLength - b.stockLength
  })[0]
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

// Helper function to get finish code from database (matching bom/route.ts)
async function getFinishCode(finishType: string): Promise<string> {
  try {
    const finish = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })
    return finish?.finishCode ? `-${finish.finishCode}` : ''
  } catch (error) {
    return ''
  }
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
  option: any,
  optionBom: any | null,
  quantity: number,
  componentWidth: number,
  componentHeight: number,
  extrusionCostingMethod: string,
  excludedPartNumbers: string[],
  finishColor: string | null,
  globalMaterialPricePerLb: number,
  selectedVariantId?: number | null,
  panelDirection?: string | null
): Promise<{ unitPrice: number; totalPrice: number; isExtrusion: boolean; breakdown?: any; linkedPartsCost?: number; linkedPartsBreakdown?: any[] }> {
  let baseUnitPrice = 0
  let baseTotalPrice = 0
  let isExtrusion = false
  let breakdown: any = null

  if (option.partNumber) {
    // Look up MasterPart to check if it's an extrusion
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: option.partNumber },
      select: { partType: true, cost: true, salePrice: true }
    })

    if (masterPart) {
      // Check for sale price first
      if (masterPart.salePrice && masterPart.salePrice > 0) {
        baseUnitPrice = masterPart.salePrice
        baseTotalPrice = masterPart.salePrice * quantity
      } else if (masterPart.partType === 'Extrusion' && optionBom) {
        // If it's an extrusion with a BOM entry, use full extrusion pricing logic
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
          panelDirection
        )

        baseUnitPrice = bomResult.cost / quantity
        baseTotalPrice = bomResult.cost
        isExtrusion = true
        breakdown = bomResult.breakdown
      } else {
        // For hardware and other part types, use direct cost
        baseUnitPrice = masterPart.cost ?? 0
        baseTotalPrice = baseUnitPrice * quantity
      }
    }
  }

  // Calculate linked parts cost
  let linkedPartsCost = 0
  const linkedPartsBreakdown: any[] = []
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
      const cost = partCost * linkedQuantity
      linkedPartsCost += cost
      linkedPartsBreakdown.push({
        partNumber: linkedPart.masterPart?.partNumber,
        partName: linkedPart.masterPart?.partName,
        quantity: linkedQuantity,
        unitCost: partCost,
        totalCost: cost,
        variantId: linkedPart.variantId,
        variantName: linkedPart.variant?.name
      })
    }
  }

  const totalPrice = baseTotalPrice + linkedPartsCost
  const unitPrice = quantity > 0 ? totalPrice / quantity : 0

  return {
    unitPrice,
    totalPrice,
    isExtrusion,
    breakdown,
    linkedPartsCost,
    linkedPartsBreakdown
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
  globalMaterialPricePerLb: number,
  panelDirection?: string | null
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
    cutLength: 0,
    bomQuantity: null as number | null,
    bomUnit: null as string | null
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
        // BOM reconciled quantity: ceil(linearFeet * quantity * 1.05) matching roundUpWithOverage
        breakdown.bomQuantity = Math.ceil(linearFeet * (bom.quantity || 1) * 1.05)
        breakdown.bomUnit = 'LF'
        await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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
    // BOM reconciled quantity for formula-based parts with IN/LF units
    if (masterPartUnit === 'IN') {
      breakdown.bomQuantity = Math.ceil(formulaResult * quantity * 1.05)
      breakdown.bomUnit = 'IN'
    } else if (masterPartUnit === 'LF') {
      breakdown.bomQuantity = Math.ceil((formulaResult / 12) * quantity * 1.05)
      breakdown.bomUnit = 'LF'
    }
    await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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
          await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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
              await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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

                await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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

              await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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

              await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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
          await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
          return { cost, breakdown }
        }

        // Direct MasterPart cost
        if (masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_direct'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `MasterPart direct: $${masterPart.cost} × ${bom.quantity || 1}`
          await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)
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

  // Build full part number (for parts that didn't return early with a MasterPart lookup)
  await buildFullPartNumber(breakdown, bom, finishColor, panelDirection)

  return { cost: 0, breakdown }
}

// Build full part number with finish code, stock length suffix, and direction suffix
// This matches the pattern in bom/route.ts for consistent output
async function buildFullPartNumber(
  breakdown: any,
  bom: any,
  finishColor: string | null,
  panelDirection?: string | null
): Promise<void> {
  if (!bom.partNumber) return

  const basePartNumber = bom.partNumber
  let fullPartNumber = basePartNumber

  try {
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: basePartNumber },
      select: {
        partType: true,
        isMillFinish: true,
        addFinishToPartNumber: true,
        appendDirectionToPartNumber: true
      }
    })

    if (!masterPart) return

    const isExtrusion = masterPart.partType === 'Extrusion'
    const isCutStock = masterPart.partType === 'CutStock'
    const isHardware = masterPart.partType === 'Hardware'

    // Add finish code for extrusions (not mill finish)
    if (isExtrusion && finishColor && !masterPart.isMillFinish) {
      const finishCode = await getFinishCode(finishColor)
      if (finishCode) {
        fullPartNumber = `${fullPartNumber}${finishCode}`
      }
    }

    // Add finish code for Hardware/CutStock with addFinishToPartNumber
    if ((isHardware || isCutStock) && masterPart.addFinishToPartNumber && finishColor) {
      const finishCode = await getFinishCode(finishColor)
      if (finishCode) {
        fullPartNumber = `${fullPartNumber}${finishCode}`
      }
    }

    // Append stock length for extrusions/CutStock
    if ((isExtrusion || isCutStock) && breakdown.stockLength) {
      fullPartNumber = `${fullPartNumber}-${breakdown.stockLength}`
    }

    // Append direction suffix for hardware parts
    if (isHardware && masterPart.appendDirectionToPartNumber && panelDirection) {
      const direction = panelDirection
      if (direction && direction !== 'None') {
        const directionCode = direction
          .replace(/-/g, ' ')
          .split(' ')
          .filter((word: string) => word.length > 0)
          .map((word: string) => word.charAt(0).toUpperCase())
          .join('')
        fullPartNumber = `${fullPartNumber}-${directionCode}`
      }
    }
  } catch (error) {
    // Continue with base part number on error
  }

  // Store both base and full part number
  breakdown.basePartNumber = basePartNumber
  breakdown.partNumber = fullPartNumber
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

// Helper to escape CSV fields
function csvEscape(val: any): string {
  const str = String(val ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

function pricingDebugToCSV(
  project: { id: number; name: string; status: string },
  pricingModeData: any,
  openingsData: any[],
  totals: any
): string {
  const lines: string[] = []

  // Header
  lines.push('=== PROJECT PRICING DEBUG ===')
  lines.push(`Project,${csvEscape(project.name)}`)
  lines.push(`Status,${csvEscape(project.status)}`)
  lines.push('')

  // Pricing mode
  lines.push('=== PRICING MODE ===')
  if (pricingModeData) {
    lines.push(`Name,${csvEscape(pricingModeData.name)}`)
    lines.push(`Extrusion Markup,${pricingModeData.extrusionMarkup ?? 0}%`)
    lines.push(`Hardware Markup,${pricingModeData.hardwareMarkup ?? 0}%`)
    lines.push(`Glass Markup,${pricingModeData.glassMarkup ?? 0}%`)
    lines.push(`Packaging Markup,${pricingModeData.packagingMarkup ?? 0}%`)
    lines.push(`Global Markup,${pricingModeData.globalMarkup ?? 0}%`)
    lines.push(`Discount,${pricingModeData.discount ?? 0}%`)
    lines.push(`Extrusion Costing,${csvEscape(pricingModeData.extrusionCostingMethod || 'FULL_STOCK')}`)
  } else {
    lines.push('Name,"None"')
  }
  lines.push('')

  const extrusionMarkup = pricingModeData?.extrusionMarkup ?? pricingModeData?.globalMarkup ?? 0
  const hardwareMarkup = pricingModeData?.hardwareMarkup ?? pricingModeData?.globalMarkup ?? 0
  const glassMarkup = pricingModeData?.glassMarkup ?? pricingModeData?.globalMarkup ?? 0
  const discount = pricingModeData?.discount ?? 0

  // Per-opening sections
  for (const opening of openingsData) {
    lines.push(`=== OPENING: ${opening.name} ===`)
    lines.push(`Finish Color,${csvEscape(opening.finishColor)}`)
    lines.push('')

    for (const comp of opening.components) {
      lines.push(`--- Component: ${comp.productName} (Panel ${comp.panelId}) ---`)
      lines.push(`Dimensions,${csvEscape(`${comp.dimensions.width}" W x ${comp.dimensions.height}" H`)}`)
      lines.push('')

      // BOM items table
      lines.push('BOM ITEMS')
      lines.push('Part Number,Part Name,Part Type,Stock Length,Cut Length,Quantity,BOM Qty,BOM Unit,Unit Cost,Finish Cost,Marked Up Cost,Non-Marked Up Cost,Total Cost,Method,Details,Finish Details')

      for (const item of comp.bomItems) {
        const isExtrusion = item.partType === 'Extrusion' || item.partType === 'CutStock'
        const categoryMarkup = isExtrusion ? extrusionMarkup
          : (item.partType === 'Hardware' || item.partType === 'Fastener') ? hardwareMarkup
          : item.partType === 'Glass' ? glassMarkup : 0

        const hybridBreakdown = (item as any).hybridBreakdown
        let markedUpCost: number
        let nonMarkedUpCost: number

        if (hybridBreakdown?.remainingPortionCost) {
          nonMarkedUpCost = hybridBreakdown.remainingPortionCost
          const materialForMarkup = item.totalCost - item.finishCost - hybridBreakdown.remainingPortionCost
          markedUpCost = materialForMarkup * (1 + categoryMarkup / 100) * (1 - discount / 100) + item.finishCost
        } else {
          nonMarkedUpCost = 0
          markedUpCost = (item.totalCost - item.finishCost) * (1 + categoryMarkup / 100) * (1 - discount / 100) + item.finishCost
        }

        // Round total first, then adjust components to ensure exact sum
        const totalCost = Math.round((markedUpCost + nonMarkedUpCost) * 100) / 100
        const roundedNonMarkedUp = Math.round(nonMarkedUpCost * 100) / 100
        const roundedMarkedUp = Math.round((totalCost - roundedNonMarkedUp) * 100) / 100

        const stockLenStr = item.stockLength ? `${item.stockLength}in` : ''
        const cutLenStr = item.cutLength ? `${item.cutLength.toFixed(2)}in` : ''

        lines.push([
          csvEscape(item.partNumber),
          csvEscape(item.partName),
          csvEscape(item.partType),
          csvEscape(stockLenStr),
          csvEscape(cutLenStr),
          item.quantity,
          item.bomQuantity !== null && item.bomQuantity !== undefined ? item.bomQuantity : '',
          item.bomUnit || '',
          `$${item.unitCost.toFixed(2)}`,
          `$${(item.finishCost || 0).toFixed(2)}`,
          `$${roundedMarkedUp.toFixed(2)}`,
          `$${roundedNonMarkedUp.toFixed(2)}`,
          `$${totalCost.toFixed(2)}`,
          csvEscape(item.method),
          csvEscape(item.details),
          csvEscape(item.finishDetails || '')
        ].join(','))
      }
      lines.push('')

      // Option items table
      lines.push('OPTION ITEMS')
      lines.push('Category,Option Name,Part Number,Quantity,Unit Price,Total Price,Method,Details,Is Standard,Is Included')
      for (const opt of comp.optionItems) {
        lines.push([
          csvEscape(opt.category),
          csvEscape(opt.optionName),
          csvEscape(opt.partNumber || ''),
          opt.quantity || 1,
          `$${(opt.unitPrice || 0).toFixed(2)}`,
          `$${(opt.price || 0).toFixed(2)}`,
          csvEscape(opt.method || ''),
          csvEscape(opt.details || ''),
          opt.isStandard ? 'Yes' : 'No',
          opt.isIncluded ? 'Yes' : 'No'
        ].join(','))
      }
      lines.push('')

      // Glass table
      lines.push('GLASS')
      lines.push('Glass Type,Width Formula,Height Formula,Calc Width,Calc Height,Qty,Sqft,Price/Sqft,Total Cost')
      if (comp.glassItem) {
        const g = comp.glassItem
        lines.push([
          csvEscape(g.glassType),
          csvEscape(g.widthFormula),
          csvEscape(g.heightFormula),
          g.calculatedWidth?.toFixed(3) ?? '',
          g.calculatedHeight?.toFixed(3) ?? '',
          g.quantity,
          g.sqft,
          `$${g.pricePerSqFt?.toFixed(2) ?? '0.00'}`,
          `$${g.totalCost?.toFixed(2) ?? '0.00'}`
        ].join(','))
      }
      lines.push('')

      lines.push(`Component BOM Total,$${comp.totalBOMCost.toFixed(2)}`)
      lines.push(`Component Options Total,$${comp.totalOptionCost.toFixed(2)}`)
      lines.push(`Component Glass Total,$${comp.totalGlassCost.toFixed(2)}`)
      lines.push('')
    }

    // Opening cost summary
    lines.push('--- OPENING COST SUMMARY ---')
    lines.push('Category,Base Cost,Markup %,Marked Up Cost')
    const cs = opening.costSummary
    lines.push(`Extrusion,$${cs.extrusion.base.toFixed(2)},${cs.extrusion.markup}%,$${cs.extrusion.markedUp.toFixed(2)}`)
    lines.push(`Hardware,$${cs.hardware.base.toFixed(2)},${cs.hardware.markup}%,$${cs.hardware.markedUp.toFixed(2)}`)
    lines.push(`Glass,$${cs.glass.base.toFixed(2)},${cs.glass.markup}%,$${cs.glass.markedUp.toFixed(2)}`)
    lines.push(`Packaging,$${cs.packaging.base.toFixed(2)},${cs.packaging.markup}%,$${cs.packaging.markedUp.toFixed(2)}`)
    lines.push(`Other,$${cs.other.base.toFixed(2)},${cs.other.markup}%,$${cs.other.markedUp.toFixed(2)}`)
    lines.push(`Standard Options (no markup),$${cs.standardOptions.base.toFixed(2)},0%,$${cs.standardOptions.markedUp.toFixed(2)}`)
    lines.push(`Hybrid Remaining (no markup),$${cs.hybridRemaining.base.toFixed(2)},0%,$${cs.hybridRemaining.markedUp.toFixed(2)}`)
    lines.push('')
    lines.push(`Opening Total (Base),$${opening.totalBaseCost.toFixed(2)}`)
    lines.push(`Opening Total (Marked Up),$${opening.totalMarkedUpCost.toFixed(2)}`)
    lines.push('')
    lines.push('')
  }

  // Project totals
  lines.push('=== PROJECT TOTALS ===')
  lines.push(`Subtotal (Base),$${totals.subtotalBase.toFixed(2)}`)
  lines.push(`Subtotal (Marked Up),$${totals.subtotalMarkedUp.toFixed(2)}`)
  lines.push(`Installation,$${totals.installation.toFixed(2)}`)
  lines.push(`Tax Rate,${(totals.taxRate * 100).toFixed(1)}%`)
  lines.push(`Tax Amount,$${totals.taxAmount.toFixed(2)}`)
  lines.push(`Grand Total,$${totals.grandTotal.toFixed(2)}`)
  lines.push('')

  // Extrusion markup breakdown
  lines.push('=== EXTRUSION MARKUP BREAKDOWN ===')
  lines.push('This section shows which portion of extrusion costs receive markup vs pass-through at cost')
  lines.push('')
  lines.push('Opening,Total Extrusion Cost,Extrusion With Markup,Extrusion Without Markup (Hybrid Remaining),Markup %,Marked Up Result')
  for (const opening of openingsData) {
    const cs = opening.costSummary
    const extrusionWithMarkup = cs.extrusion.base - cs.hybridRemaining.base
    lines.push([
      csvEscape(opening.name),
      `$${cs.extrusion.base.toFixed(2)}`,
      `$${extrusionWithMarkup.toFixed(2)}`,
      `$${cs.hybridRemaining.base.toFixed(2)}`,
      `${cs.extrusion.markup}%`,
      `$${cs.extrusion.markedUp.toFixed(2)}`
    ].join(','))
  }
  lines.push('')

  // Totals row for extrusion breakdown
  const totalExtBase = openingsData.reduce((s, o) => s + o.costSummary.extrusion.base, 0)
  const totalHybridRemaining = openingsData.reduce((s, o) => s + o.costSummary.hybridRemaining.base, 0)
  const totalExtWithMarkup = totalExtBase - totalHybridRemaining
  const totalExtMarkedUp = openingsData.reduce((s, o) => s + o.costSummary.extrusion.markedUp, 0)
  lines.push(`TOTALS,$${totalExtBase.toFixed(2)},$${totalExtWithMarkup.toFixed(2)},$${totalHybridRemaining.toFixed(2)},${extrusionMarkup}%,$${totalExtMarkedUp.toFixed(2)}`)
  lines.push('')
  lines.push('Note: "Extrusion With Markup" = portion that receives the extrusion markup percentage')
  lines.push('Note: "Extrusion Without Markup (Hybrid Remaining)" = portion passed through at cost (no markup applied)')
  lines.push('Note: Marked Up Result = (With Markup × (1 + Markup%)) × (1 - Discount%) + Without Markup')

  return lines.join('\n')
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Parse format query parameter
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

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

        // Get panel direction for part number suffix construction
        const panelDirection = ((panel as any).swingDirection && (panel as any).swingDirection !== 'None')
          ? (panel as any).swingDirection
          : (panel as any).slidingDirection || null

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

        // Parse variant selections
        let variantSelections: Record<string, number> = {}
        if (panel.componentInstance.variantSelections) {
          try {
            variantSelections = JSON.parse(panel.componentInstance.variantSelections)
          } catch (e) {}
        }

        // Process BOM items (matching pricing-calculator.ts logic)
        for (const bom of product.productBOMs) {
          // Skip ALL option-linked BOM items - they are handled in the options section
          if (bom.optionId) continue

          // Skip null-option BOMs if another option in same category is selected (matching pricing-calculator.ts)
          if (!bom.optionId && (bom as any).option === null) {
            const category = product.productSubOptions?.find((pso: any) =>
              pso.category?.individualOptions?.some((io: any) => io.id === bom.optionId)
            )
            if (category) {
              const categoryId = category.category.id.toString()
              const selectedInCategory = selections[categoryId]
              if (selectedInCategory && selectedInCategory !== bom.optionId?.toString()) continue
            }
          }

          const bomWithQuantity = bom

          const { cost, breakdown } = await calculateBOMItemPrice(
            bomWithQuantity,
            effectiveWidth,
            effectiveHeight,
            extrusionCostingMethod,
            project.excludedPartNumbers || [],
            opening.finishColor,
            globalMaterialPricePerLb,
            panelDirection
          )

          componentData.bomItems.push(breakdown)
          componentData.totalBOMCost += cost

          // Track hybrid remaining cost
          if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
            hybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
          }

          // Track by category (CutStock is treated as Extrusion, Fastener is treated as Hardware for pricing purposes)
          if (breakdown.partType === 'Extrusion' || breakdown.partType === 'CutStock') {
            openingData.costSummary.extrusion.base += cost
          } else if (breakdown.partType === 'Hardware' || breakdown.partType === 'Fastener') {
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
              // For standard options, use the selected variant or default variant
              const selectedVariantId = variantSelections[String(standardOption.id)]
              const priceResult = await calculateOptionPrice(
                standardOption,
                optionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                project.excludedPartNumbers || [],
                opening.finishColor,
                globalMaterialPricePerLb,
                selectedVariantId,
                panelDirection
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
                details: priceResult.breakdown?.details,
                linkedPartsCost: priceResult.linkedPartsCost,
                linkedParts: priceResult.linkedPartsBreakdown
              })
              componentData.totalOptionCost += priceResult.totalPrice
              standardOptionCost += priceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += priceResult.totalPrice
                // Track hybrid remaining cost for extrusion options
                if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                  hybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                }
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
            const selectedVariantId = variantSelections[String(selectedOption.id)]
            const priceResult = await calculateOptionPrice(
              selectedOption,
              optionBom,
              quantity,
              effectiveWidth,
              effectiveHeight,
              extrusionCostingMethod,
              project.excludedPartNumbers || [],
              opening.finishColor,
              globalMaterialPricePerLb,
              selectedVariantId,
              panelDirection
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
                details: priceResult.breakdown?.details,
                linkedPartsCost: priceResult.linkedPartsCost,
                linkedParts: priceResult.linkedPartsBreakdown
              })
              componentData.totalOptionCost += optionPrice
              standardOptionCost += optionPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += optionPrice
                // Track hybrid remaining cost for extrusion options
                if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                  hybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                }
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
              const standardVariantId = standardOption ? variantSelections[String(standardOption.id)] : null
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
                    globalMaterialPricePerLb,
                    standardVariantId,
                    panelDirection
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
                details: priceResult.breakdown?.details,
                linkedPartsCost: priceResult.linkedPartsCost,
                linkedParts: priceResult.linkedPartsBreakdown
              })
              componentData.totalOptionCost += optionPrice
              // Track the standard portion in standardOptionCost (no markup)
              standardOptionCost += standardPriceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += optionPrice
                // Track hybrid remaining cost for extrusion options
                if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                  hybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                }
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
              const selectedVariantId = variantSelections[String(standardOption.id)]
              const priceResult = await calculateOptionPrice(
                standardOption,
                optionBom,
                quantity,
                effectiveWidth,
                effectiveHeight,
                extrusionCostingMethod,
                project.excludedPartNumbers || [],
                opening.finishColor,
                globalMaterialPricePerLb,
                selectedVariantId,
                panelDirection
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
                details: priceResult.breakdown?.details,
                linkedPartsCost: priceResult.linkedPartsCost,
                linkedParts: priceResult.linkedPartsBreakdown
              })
              componentData.totalOptionCost += priceResult.totalPrice
              standardOptionCost += priceResult.totalPrice
              // Track in correct category based on part type
              if (priceResult.isExtrusion) {
                openingData.costSummary.extrusion.base += priceResult.totalPrice
                // Track hybrid remaining cost for extrusion options
                if (priceResult.breakdown?.hybridBreakdown?.remainingPortionCost) {
                  hybridRemainingCost += priceResult.breakdown.hybridBreakdown.remainingPortionCost
                }
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
              const variables = { width: effectiveWidth, height: effectiveHeight }
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

      // Process preset part instances (opening-level parts like starter channels, trim, etc.)
      if (opening.presetPartInstances && opening.presetPartInstances.length > 0) {
        const presetComponentData: any = {
          productName: 'Opening / Jamb Parts',
          productType: 'PRESET',
          panelId: null,
          dimensions: {
            width: opening.finishedWidth || opening.roughWidth || 0,
            height: opening.finishedHeight || opening.roughHeight || 0
          },
          bomItems: [],
          optionItems: [],
          glassItem: null,
          totalBOMCost: 0,
          totalOptionCost: 0,
          totalGlassCost: 0
        }

        for (const instance of opening.presetPartInstances) {
          const presetPart = instance.presetPart
          if (!presetPart?.masterPart) continue

          const masterPart = presetPart.masterPart

          // For extrusions with formula: calculatedQuantity = cut length, presetPart.quantity = piece count
          // For non-extrusions: calculatedQuantity or presetPart.quantity = piece count
          let quantity: number
          let formulaForPricing: string | null = null

          if (presetPart.formula && masterPart.partType === 'Extrusion') {
            quantity = presetPart.quantity || 1
            formulaForPricing = String(instance.calculatedQuantity || 0)
          } else {
            quantity = instance.calculatedQuantity || presetPart.quantity || 1
            formulaForPricing = presetPart.formula
          }

          // Build a BOM-like object for pricing
          const bomForPricing = {
            partNumber: masterPart.partNumber,
            partName: masterPart.baseName || masterPart.partNumber,
            partType: masterPart.partType || 'Hardware',
            quantity: quantity,
            formula: formulaForPricing,
            cost: 0
          }

          const effectiveWidth = opening.finishedWidth || opening.roughWidth || 0
          const effectiveHeight = opening.finishedHeight || opening.roughHeight || 0

          const { cost, breakdown } = await calculateBOMItemPrice(
            bomForPricing,
            effectiveWidth,
            effectiveHeight,
            extrusionCostingMethod,
            project.excludedPartNumbers || [],
            opening.finishColor,
            globalMaterialPricePerLb,
            null // preset parts are opening-level, no panel direction
          )

          presetComponentData.bomItems.push(breakdown)
          presetComponentData.totalBOMCost += cost

          // Track hybrid remaining cost
          if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
            hybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
          }

          // Track by category
          if (masterPart.partType === 'Extrusion' || masterPart.partType === 'CutStock') {
            openingData.costSummary.extrusion.base += cost
          } else if (masterPart.partType === 'Hardware' || masterPart.partType === 'Fastener') {
            openingData.costSummary.hardware.base += cost
          } else if (masterPart.partType === 'Glass') {
            openingData.costSummary.glass.base += cost
          } else if (masterPart.partType === 'Packaging') {
            openingData.costSummary.packaging.base += cost
          } else {
            openingData.costSummary.other.base += cost
          }
        }

        if (presetComponentData.bomItems.length > 0) {
          openingData.components.push(presetComponentData)
        }
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

    const pricingModeData = pricingMode ? {
      name: pricingMode.name,
      extrusionMarkup: pricingMode.extrusionMarkup,
      hardwareMarkup: pricingMode.hardwareMarkup,
      glassMarkup: pricingMode.glassMarkup,
      packagingMarkup: pricingMode.packagingMarkup,
      globalMarkup: pricingMode.markup,
      discount: pricingMode.discount,
      extrusionCostingMethod: pricingMode.extrusionCostingMethod
    } : null

    const totalsData = {
      subtotalBase: projectTotalBaseCost,
      subtotalMarkedUp: projectTotalMarkedUpCost,
      installation: installationCost,
      taxRate: project.taxRate || 0,
      taxAmount,
      grandTotal
    }

    // CSV format
    if (format === 'csv') {
      const csvContent = pricingDebugToCSV(
        { id: project.id, name: project.name, status: project.status },
        pricingModeData,
        openingsData,
        totalsData
      )
      const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-pricing-debug.csv`
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status
      },
      pricingMode: pricingModeData,
      openings: openingsData,
      totals: totalsData
    })
  } catch (error) {
    console.error('Error generating pricing debug:', error)
    return NextResponse.json(
      { error: 'Failed to generate pricing debug data' },
      { status: 500 }
    )
  }
}

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
function findBestStockLengthRule(rules: any[], requiredLength: number, finishColor?: string): any | null {
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

  // Select the correct price based on finish color and isMillFinish
  if (bestRule) {
    let priceToUse = bestRule.basePrice // Fallback price

    // Mill finish parts always use basePrice regardless of finish color
    if (bestRule.isMillFinish) {
      priceToUse = bestRule.basePrice
    } else {
      // Non-mill finish: use color-specific pricing
      if (finishColor === 'Black' && bestRule.basePriceBlack !== null && bestRule.basePriceBlack !== undefined) {
        priceToUse = bestRule.basePriceBlack
      } else if (finishColor === 'Clear' && bestRule.basePriceClear !== null && bestRule.basePriceClear !== undefined) {
        priceToUse = bestRule.basePriceClear
      }
    }

    // Return rule with selected price as basePrice for backwards compatibility
    return {
      ...bestRule,
      basePrice: priceToUse
    }
  }

  return null
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

// Helper function to get finish suffix for extrusion part numbers
function getFinishSuffix(finishColor: string): string {
  switch (finishColor) {
    case 'Black': return '-BL'
    case 'Clear': return '-C2'
    case 'Other': return '-AL' // Default for other finishes
    default: return ''
  }
}

// Helper function to apply finish code to part number, avoiding duplicates
function applyFinishCode(partNumber: string, finishColor: string): string {
  if (!partNumber || !finishColor) return partNumber
  
  const finishSuffix = getFinishSuffix(finishColor)
  if (!finishSuffix) return partNumber
  
  // If the part number already ends with the desired suffix, don't add it again
  if (partNumber.endsWith(finishSuffix)) {
    return partNumber
  }
  
  // If the part number ends with a different finish code, replace it
  const finishCodes = ['-BL', '-C2', '-AL']
  for (const code of finishCodes) {
    if (partNumber.endsWith(code)) {
      return partNumber.slice(0, -code.length) + finishSuffix
    }
  }
  
  // Otherwise, just append the finish code
  return partNumber + finishSuffix
}

// Function to calculate the price of a single BOM item using component dimensions
async function calculateBOMItemPrice(bom: any, componentWidth: number, componentHeight: number, finishColor?: string, extrusionCostingMethod?: string, excludedPartNumbers?: string[]): Promise<{cost: number, breakdown: any}> {
  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1
  }

  // Apply finish code to extrusion part numbers
  let effectivePartNumber = bom.partNumber
  if (bom.partType === 'Extrusion' && bom.partNumber && finishColor) {
    effectivePartNumber = applyFinishCode(bom.partNumber, finishColor)
  }

  let cost = 0
  const breakdown = {
    partNumber: effectivePartNumber,
    originalPartNumber: bom.partNumber, // Keep original for reference
    partName: bom.partName,
    partType: bom.partType,
    quantity: bom.quantity || 1,
    method: 'unknown',
    details: '',
    unitCost: 0,
    totalCost: 0,
    finishColor: bom.partType === 'Extrusion' ? finishColor : undefined
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
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_hardware'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`
          return { cost, breakdown }
        }

        // For Extrusions: Use StockLengthRules based on calculated part length from ProductBOM formula
        if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
          // Calculate the required part length from the ProductBOM formula
          const requiredLength = calculateRequiredPartLength(bom, variables)

          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength, finishColor)
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

            if (usePercentageBased && bestRule.stockLength && bestRule.basePrice) {
              // Calculate usage percentage
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              // If more than 50% of stock remains unused, use percentage-based cost
              if (remainingPercentage > 0.5) {
                cost = bestRule.basePrice * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_percentage_based'
                const excludedNote = isExcludedPart ? ' (Excluded Part)' : ''
                breakdown.details = `Percentage-based cost${excludedNote}: ${(usagePercentage * 100).toFixed(2)}% of stock (${requiredLength}"/${bestRule.stockLength}") × $${bestRule.basePrice} × ${bom.quantity || 1} = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
                return { cost, breakdown }
              }
              // If 50% or less remains, fall through to full stock cost
            }

            // FULL_STOCK method or percentage fallback
            if (bestRule.formula) {
              const extrusionVariables = {
                ...variables,
                basePrice: bestRule.basePrice || 0,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1,
                requiredLength: requiredLength
              }
              cost = evaluateFormula(bestRule.formula, extrusionVariables)
              breakdown.method = usePercentageBased ? 'extrusion_full_stock_fallback' : 'extrusion_rule_formula'
              breakdown.details = `${usePercentageBased ? 'Full stock cost (>50% used): ' : ''}Extrusion rule for ${requiredLength}" length: ${bestRule.formula} (basePrice: ${bestRule.basePrice}, stockLength: ${bestRule.stockLength}) = $${cost}`
            } else if (bestRule.basePrice) {
              cost = bestRule.basePrice * (bom.quantity || 1)
              breakdown.method = usePercentageBased ? 'extrusion_full_stock_fallback' : 'extrusion_rule_base'
              breakdown.details = `${usePercentageBased ? 'Full stock cost (>50% used): ' : ''}Extrusion base price for ${requiredLength}" length: $${bestRule.basePrice} × ${bom.quantity || 1}`
            }
            breakdown.unitCost = cost / (bom.quantity || 1)
            breakdown.totalCost = cost
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
        project: true, // Include project to get extrusion costing method and excluded parts
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productBOMs: true,
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: true
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

    const priceBreakdown = {
      components: [] as any[],
      totalComponentCost: 0,
      totalPrice: 0
    }

    // Calculate price for each panel's component
    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      const component = panel.componentInstance
      const product = component.product
      let componentCost = 0
      const componentBreakdown = {
        productName: product.name,
        panelId: panel.id,
        width: panel.width,
        height: panel.height,
        bomCosts: [] as any[],
        optionCosts: [] as any[],
        glassCost: null as any,
        totalBOMCost: 0,
        totalOptionCost: 0,
        totalGlassCost: 0,
        totalComponentCost: 0
      }

      // Calculate BOM costs using proper pricing rules
      for (const bom of product.productBOMs) {
        const { cost, breakdown } = await calculateBOMItemPrice(
          bom,
          panel.width,
          panel.height,
          opening.finishColor || '',
          opening.project.extrusionCostingMethod || 'FULL_STOCK',
          opening.project.excludedPartNumbers || []
        )
        componentBreakdown.bomCosts.push(breakdown)
        componentBreakdown.totalBOMCost += cost
        componentCost += cost
      }

      // Calculate sub-option costs
      if (component.subOptionSelections) {
        try {
          const selections = JSON.parse(component.subOptionSelections)
          const includedOptions = component.includedOptions ? JSON.parse(component.includedOptions) : []

          for (const [categoryId, optionId] of Object.entries(selections)) {
            if (!optionId) continue

            // Find the individual option
            const category = product.productSubOptions.find(pso =>
              pso.category.id === parseInt(categoryId)
            )?.category

            const individualOption = category?.individualOptions.find(io =>
              io.id === parseInt(optionId as string)
            )

            if (individualOption) {
              // Check if this option is marked as included (no charge)
              const isIncluded = includedOptions.includes(individualOption.id)
              const optionPrice = isIncluded ? 0 : individualOption.price

              componentBreakdown.optionCosts.push({
                categoryName: category?.name || '',
                optionName: individualOption.name,
                price: optionPrice,
                isIncluded: isIncluded
              })

              componentBreakdown.totalOptionCost += optionPrice
              componentCost += optionPrice
            }
          }
        } catch (error) {
          console.error('Error parsing sub-option selections:', error)
        }
      }

      // Calculate glass cost if glass type is specified
      if (panel.glassType && panel.glassType !== 'N/A') {
        console.log(`[Glass Pricing] Panel ${panel.id} has glass type: ${panel.glassType}`)
        try {
          // Fetch glass type pricing from database
          const glassType = await prisma.glassType.findUnique({
            where: { name: panel.glassType }
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

            console.log(`[Glass Pricing] Calculated glass cost: $${componentBreakdown.totalGlassCost}`)
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
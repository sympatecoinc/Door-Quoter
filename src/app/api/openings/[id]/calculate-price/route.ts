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

// Function to calculate the price of a single BOM item using component dimensions
async function calculateBOMItemPrice(bom: any, componentWidth: number, componentHeight: number, extrusionCostingMethod?: string, excludedPartNumbers?: string[], finishColor?: string | null): Promise<{cost: number, breakdown: any}> {
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
            if (useHybrid && bestRule.stockLength && bestRule.basePrice) {
              const usagePercentage = requiredLength / bestRule.stockLength
              const remainingPercentage = 1 - usagePercentage

              if (usagePercentage >= 0.5) {
                // >= 50% used: charge markup on used portion + cost on remaining
                // At this level, we return the BASE costs - markup is applied at quote generation
                // usedPortionCost will have markup applied, remainingPortionCost will not
                const usedPortionCost = bestRule.basePrice * usagePercentage * (bom.quantity || 1)
                const remainingPortionCost = bestRule.basePrice * remainingPercentage * (bom.quantity || 1)

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
                cost = bestRule.basePrice * usagePercentage * (bom.quantity || 1)
                breakdown.method = 'extrusion_hybrid_percentage'
                breakdown.details = `Hybrid (<50% used): ${(usagePercentage * 100).toFixed(1)}% of stock (${requiredLength}"/${bestRule.stockLength}") × $${bestRule.basePrice} × ${bom.quantity || 1} = $${cost.toFixed(2)}`
                breakdown.unitCost = cost / (bom.quantity || 1)
                breakdown.totalCost = cost
              }

              // Calculate finish cost for hybrid pricing (based on cut length used)
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

            // Calculate finish cost for extrusions if finish color is specified and NOT mill finish
            // Check isMillFinish from the MasterPart - if true, this extrusion never gets finish codes/costs
            if (finishColor && finishColor !== 'Mill Finish' && !masterPart.isMillFinish) {
              try {
                const finishPricing = await prisma.extrusionFinishPricing.findUnique({
                  where: { finishType: finishColor, isActive: true }
                })

                if (finishPricing && finishPricing.costPerFoot > 0) {
                  const cutLengthInches = requiredLength
                  const cutLengthFeet = cutLengthInches / 12
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
      for (const bom of product.productBOMs) {
        const { cost, breakdown } = await calculateBOMItemPrice(
          bom,
          effectiveWidth,
          effectiveHeight,
          extrusionCostingMethod,
          opening.project.excludedPartNumbers || [],
          opening.finishColor
        )
        componentBreakdown.bomCosts.push(breakdown)
        componentBreakdown.totalBOMCost += cost
        componentCost += cost

        // Track HYBRID remaining costs (no markup portion)
        if ((breakdown as any).hybridBreakdown?.remainingPortionCost) {
          priceBreakdown.totalHybridRemainingCost += (breakdown as any).hybridBreakdown.remainingPortionCost
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

            if (!optionId) {
              // No option selected - if there's a standard, include its cost at cost (no markup)
              if (standardOption) {
                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: standardOption.name,
                  price: standardOption.price, // Cost price, no markup
                  isStandard: true,
                  isIncluded: false
                })
                componentBreakdown.totalOptionCost += standardOption.price
                componentCost += standardOption.price
                priceBreakdown.totalStandardOptionCost += standardOption.price // Track for no-markup
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

              if (isStandardSelected) {
                // Standard option selected - cost only, no markup
                const optionPrice = isIncluded ? 0 : selectedOption.price

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: true,
                  isIncluded: isIncluded
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice
                priceBreakdown.totalStandardOptionCost += optionPrice // Track for no-markup
              } else {
                // Non-standard option selected - full price (markup applied at project level)
                const optionPrice = isIncluded ? 0 : selectedOption.price

                componentBreakdown.optionCosts.push({
                  categoryName: category.name,
                  optionName: selectedOption.name,
                  price: optionPrice,
                  isStandard: false,
                  standardDeducted: standardOption ? standardOption.price : 0,
                  isIncluded: isIncluded
                })

                componentBreakdown.totalOptionCost += optionPrice
                componentCost += optionPrice
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
            componentBreakdown.optionCosts.push({
              categoryName: productSubOption.category.name,
              optionName: standardOption.name,
              price: standardOption.price, // At cost
              isStandard: true,
              isIncluded: false
            })
            componentBreakdown.totalOptionCost += standardOption.price
            componentCost += standardOption.price
            priceBreakdown.totalStandardOptionCost += standardOption.price // Track for no-markup
          }
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
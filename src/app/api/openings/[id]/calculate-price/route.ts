import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0
  
  try {
    // Replace variables in formula
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
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

// Function to find the best stock length rule for extrusions based on component dimensions
function findBestStockLengthRule(rules: any[], componentWidth: number, componentHeight: number): any | null {
  const applicableRules = rules.filter(rule => {
    // Check dimension constraints based on component size (panel dimensions)
    const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                        (rule.maxWidth === null || componentWidth <= rule.maxWidth)
    const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                         (rule.maxHeight === null || componentHeight <= rule.maxHeight)
    
    return rule.isActive && matchesWidth && matchesHeight
  })
  
  // Return the rule with the most restrictive constraints (most specific)
  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                        (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                        (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
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
async function calculateBOMItemPrice(bom: any, componentWidth: number, componentHeight: number, finishColor?: string): Promise<{cost: number, breakdown: any}> {
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

        // For Extrusions: Use StockLengthRules based on component dimensions
        if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, componentWidth, componentHeight)
          if (bestRule) {
            if (bestRule.formula) {
              const extrusionVariables = {
                ...variables,
                basePrice: bestRule.basePrice || 0,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1
              }
              cost = evaluateFormula(bestRule.formula, extrusionVariables)
              breakdown.method = 'extrusion_rule_formula'
              breakdown.details = `Extrusion rule for ${componentWidth}"W × ${componentHeight}"H: ${bestRule.formula} (basePrice: ${bestRule.basePrice}, stockLength: ${bestRule.stockLength}) = $${cost}`
            } else if (bestRule.basePrice) {
              cost = bestRule.basePrice * (bom.quantity || 1)
              breakdown.method = 'extrusion_rule_base'
              breakdown.details = `Extrusion base price for ${componentWidth}"W × ${componentHeight}"H: $${bestRule.basePrice} × ${bom.quantity || 1}`
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

    const totalPrice = 0
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
        totalBOMCost: 0,
        totalOptionCost: 0,
        totalComponentCost: 0
      }

      // Calculate BOM costs using proper pricing rules
      for (const bom of product.productBOMs) {
        const { cost, breakdown } = await calculateBOMItemPrice(bom, panel.width, panel.height, opening.finishColor || '')
        componentBreakdown.bomCosts.push(breakdown)
        componentBreakdown.totalBOMCost += cost
        componentCost += cost
      }

      // Calculate sub-option costs
      if (component.subOptionSelections) {
        try {
          const selections = JSON.parse(component.subOptionSelections)
          
          for (const [categoryId, optionId] of Object.entries(selections)) {
            if (!optionId) continue
            
            // Find the individual option
            const category = product.productSubOptions.find(pso => 
              pso.category.id === parseInt(categoryId)
            )?.category
            
            const individualOption = category?.individualOptions.find(io => 
              io.id === parseInt(optionId as string)
            )

            if (individualOption && individualOption.price > 0) {
              componentBreakdown.optionCosts.push({
                categoryName: category?.name || '',
                optionName: individualOption.name,
                price: individualOption.price
              })
              
              componentBreakdown.totalOptionCost += individualOption.price
              componentCost += individualOption.price
            }
          }
        } catch (error) {
          console.error('Error parsing sub-option selections:', error)
        }
      }

      componentBreakdown.totalComponentCost = componentCost
      priceBreakdown.components.push(componentBreakdown)
      priceBreakdown.totalComponentCost += componentCost
    }

    priceBreakdown.totalPrice = Math.round(priceBreakdown.totalComponentCost * 100) / 100

    // Update the opening price in the database
    await prisma.opening.update({
      where: { id: openingId },
      data: {
        price: priceBreakdown.totalPrice
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
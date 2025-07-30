const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula, variables) {
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
    
    console.log(`  🔢 Formula evaluation: "${formula}" -> "${expression}"`)
    
    // Basic math evaluation (be careful with eval - this is simplified)
    const result = eval(expression)
    const finalResult = isNaN(result) ? 0 : Math.max(0, result)
    console.log(`  ✅ Formula result: ${finalResult}`)
    return finalResult
  } catch (error) {
    console.error('  ❌ Formula evaluation error for formula:', formula, 'error:', error)
    return 0
  }
}

// Function to find the best stock length rule for extrusions based on component dimensions
function findBestStockLengthRule(rules, componentWidth, componentHeight) {
  console.log(`  🔍 Finding best stock length rule for W:${componentWidth} H:${componentHeight}`)
  console.log(`  📋 Available rules: ${rules.length}`)
  
  rules.forEach((rule, index) => {
    console.log(`    Rule ${index + 1}: ${rule.name}`)
    console.log(`      - Width range: ${rule.minWidth || 'null'} - ${rule.maxWidth || 'null'}`)
    console.log(`      - Height range: ${rule.minHeight || 'null'} - ${rule.maxHeight || 'null'}`)
    console.log(`      - Stock length: ${rule.stockLength}`)
    console.log(`      - Base price: ${rule.basePrice}`)
    console.log(`      - Formula: ${rule.formula || 'none'}`)
    console.log(`      - Active: ${rule.isActive}`)
  })
  
  const applicableRules = rules.filter(rule => {
    // Check dimension constraints based on component size (panel dimensions)
    const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                        (rule.maxWidth === null || componentWidth <= rule.maxWidth)
    const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                         (rule.maxHeight === null || componentHeight <= rule.maxHeight)
    
    const matches = rule.isActive && matchesWidth && matchesHeight
    console.log(`    Rule "${rule.name}": width match=${matchesWidth}, height match=${matchesHeight}, active=${rule.isActive} -> applicable=${matches}`)
    
    return matches
  })
  
  console.log(`  ✅ Found ${applicableRules.length} applicable rules`)
  
  // Return the rule with the most restrictive constraints (most specific)
  const bestRule = applicableRules.sort((a, b) => {
    const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                        (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                        (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    console.log(`    Rule "${a.name}" specificity: ${aSpecificity}, Rule "${b.name}" specificity: ${bSpecificity}`)
    return bSpecificity - aSpecificity
  })[0] || null
  
  if (bestRule) {
    console.log(`  🎯 Best rule selected: "${bestRule.name}"`)
  } else {
    console.log(`  ❌ No applicable rule found`)
  }
  
  return bestRule
}

// Function to calculate the price of a single BOM item using component dimensions
async function calculateBOMItemPrice(bom, componentWidth, componentHeight) {
  console.log(`\n🔧 Calculating price for BOM item: ${bom.partName} (${bom.partNumber})`)
  console.log(`   Part Type: ${bom.partType}`)
  console.log(`   Quantity: ${bom.quantity || 1}`)
  console.log(`   Component dimensions: ${componentWidth}" W x ${componentHeight}" H`)
  
  const variables = {
    width: componentWidth || 0,
    height: componentHeight || 0,
    quantity: bom.quantity || 1
  }

  let cost = 0
  let breakdown = {
    partNumber: bom.partNumber,
    partName: bom.partName,
    partType: bom.partType,
    quantity: bom.quantity || 1,
    method: 'unknown',
    details: '',
    unitCost: 0,
    totalCost: 0
  }

  // Method 1: Direct cost from ProductBOM
  if (bom.cost && bom.cost > 0) {
    cost = bom.cost * (bom.quantity || 1)
    breakdown.method = 'direct_bom_cost'
    breakdown.unitCost = bom.cost
    breakdown.totalCost = cost
    breakdown.details = `Direct cost from ProductBOM: $${bom.cost} × ${bom.quantity || 1}`
    console.log(`  ✅ Method 1 - Direct BOM cost: $${cost}`)
    return { cost, breakdown }
  }

  // Method 2: Formula from ProductBOM
  if (bom.formula) {
    console.log(`  🔄 Method 2 - Using ProductBOM formula: "${bom.formula}"`)
    cost = evaluateFormula(bom.formula, variables)
    breakdown.method = 'bom_formula'
    breakdown.unitCost = cost / (bom.quantity || 1)
    breakdown.totalCost = cost
    breakdown.details = `Formula: ${bom.formula} = $${cost}`
    console.log(`  ✅ Method 2 - BOM formula result: $${cost}`)
    return { cost, breakdown }
  }

  // Method 3: Find MasterPart by partNumber and apply pricing rules
  if (bom.partNumber) {
    console.log(`  🔄 Method 3 - Looking up MasterPart: ${bom.partNumber}`)
    try {
      const masterPart = await prisma.masterPart.findUnique({
        where: { partNumber: bom.partNumber },
        include: {
          stockLengthRules: { where: { isActive: true } },
          pricingRules: { where: { isActive: true } }
        }
      })

      if (masterPart) {
        console.log(`  ✅ Found MasterPart: ${masterPart.baseName}`)
        console.log(`     Part Type: ${masterPart.partType}`)
        console.log(`     Direct Cost: ${masterPart.cost || 'none'}`)
        console.log(`     Stock Length Rules: ${masterPart.stockLengthRules.length}`)
        console.log(`     Pricing Rules: ${masterPart.pricingRules.length}`)
        
        // For Hardware: Use direct cost from MasterPart
        if (masterPart.partType === 'Hardware' && masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_hardware'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `Hardware cost: $${masterPart.cost} × ${bom.quantity || 1}`
          console.log(`  ✅ Hardware pricing: $${cost}`)
          return { cost, breakdown }
        }

        // For Extrusions: Use StockLengthRules based on component dimensions
        if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
          console.log(`  🔄 Extrusion pricing - finding best stock length rule`)
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, componentWidth, componentHeight)
          if (bestRule) {
            console.log(`  🎯 Using stock length rule: "${bestRule.name}"`)
            if (bestRule.formula) {
              const extrusionVariables = {
                ...variables,
                basePrice: bestRule.basePrice || 0,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1
              }
              console.log(`  📊 Extrusion variables:`, extrusionVariables)
              cost = evaluateFormula(bestRule.formula, extrusionVariables)
              breakdown.method = 'extrusion_rule_formula'
              breakdown.details = `Extrusion rule for ${componentWidth}"W × ${componentHeight}"H: ${bestRule.formula} (basePrice: ${bestRule.basePrice}, stockLength: ${bestRule.stockLength}) = $${cost}`
            } else if (bestRule.basePrice) {
              cost = bestRule.basePrice * (bom.quantity || 1)
              breakdown.method = 'extrusion_rule_base'
              breakdown.details = `Extrusion base price for ${componentWidth}"W × ${componentHeight}"H: $${bestRule.basePrice} × ${bom.quantity || 1}`
              console.log(`  ✅ Using base price: $${bestRule.basePrice} × ${bom.quantity || 1} = $${cost}`)
            }
            breakdown.unitCost = cost / (bom.quantity || 1)
            breakdown.totalCost = cost
            console.log(`  ✅ Extrusion final cost: $${cost}`)
            return { cost, breakdown }
          } else {
            console.log(`  ❌ No applicable stock length rule found for extrusion`)
          }
        }

        // For other part types: Use PricingRules
        if (masterPart.pricingRules.length > 0) {
          console.log(`  🔄 Using pricing rules`)
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
          console.log(`  ✅ Pricing rule result: $${cost}`)
          return { cost, breakdown }
        }

        // Fallback to MasterPart direct cost
        if (masterPart.cost && masterPart.cost > 0) {
          cost = masterPart.cost * (bom.quantity || 1)
          breakdown.method = 'master_part_direct'
          breakdown.unitCost = masterPart.cost
          breakdown.totalCost = cost
          breakdown.details = `MasterPart direct cost: $${masterPart.cost} × ${bom.quantity || 1}`
          console.log(`  ✅ MasterPart direct cost: $${cost}`)
          return { cost, breakdown }
        }
      } else {
        console.log(`  ❌ MasterPart not found for: ${bom.partNumber}`)
      }
    } catch (error) {
      console.error(`  ❌ Error looking up MasterPart for ${bom.partNumber}:`, error)
    }
  }

  breakdown.method = 'no_cost_found'
  breakdown.details = 'No pricing method found'
  breakdown.totalCost = 0
  console.log(`  ❌ No cost found for ${bom.partName}`)
  return { cost: 0, breakdown }
}

async function debugExtrusionPricing() {
  console.log('🚀 Starting Extrusion Pricing Debug')
  console.log('=====================================\n')
  
  // Get the opening data
  const opening = await prisma.opening.findUnique({
    where: { id: 5 }, // Using the opening ID we found
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
    console.log('❌ Opening not found')
    return
  }
  
  console.log(`📋 Opening: ${opening.name}`)
  console.log(`💰 Current Price: $${opening.price}`)
  console.log(`📏 Opening Size: ${opening.roughWidth || 'N/A'}" W x ${opening.roughHeight || 'N/A'}" H`)
  console.log(`🔢 Number of Panels: ${opening.panels.length}\n`)
  
  for (const panel of opening.panels) {
    if (!panel.componentInstance) continue
    
    console.log(`🏗️  Panel ${panel.id}: ${panel.width}" W x ${panel.height}" H`)
    const component = panel.componentInstance
    const product = component.product
    
    console.log(`📦 Product: ${product.name}`)
    console.log(`🔧 BOM Items: ${product.productBOMs.length}\n`)
    
    let totalPanelCost = 0
    
    // Process each BOM item
    for (const bom of product.productBOMs) {
      const { cost, breakdown } = await calculateBOMItemPrice(bom, panel.width, panel.height)
      totalPanelCost += cost
      
      console.log(`💰 ${bom.partName}: $${cost}`)
      console.log(`   Method: ${breakdown.method}`)
      console.log(`   Details: ${breakdown.details}\n`)
    }
    
    console.log(`💰 Total Panel Cost: $${totalPanelCost}`)
    console.log('─'.repeat(50))
  }
  
  await prisma.$disconnect()
}

// Run the debug
debugExtrusionPricing().catch(console.error)
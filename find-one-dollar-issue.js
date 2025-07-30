const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula, variables) {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0
  
  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      expression = expression.replace(regex, value.toString())
    }
    
    if (!expression || expression.trim() === '') return 0
    
    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    return 0
  }
}

// Function to find the best stock length rule
function findBestStockLengthRule(rules, componentWidth, componentHeight) {
  const applicableRules = rules.filter(rule => {
    const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                        (rule.maxWidth === null || componentWidth <= rule.maxWidth)
    const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                         (rule.maxHeight === null || componentHeight <= rule.maxHeight)
    
    return rule.isActive && matchesWidth && matchesHeight
  })
  
  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                        (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                        (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
}

async function findOneDollarIssue() {
  console.log('🔍 Searching for Scenarios that Could Cause $1 Pricing')
  console.log('===================================================\n')
  
  try {
    // Check all extrusion master parts
    const extrusions = await prisma.masterPart.findMany({
      where: { partType: 'Extrusion' },
      include: {
        stockLengthRules: { where: { isActive: true } },
        pricingRules: { where: { isActive: true } }
      }
    })
    
    console.log(`Found ${extrusions.length} extrusion master parts\n`)
    
    // Test various panel dimensions that might trigger edge cases
    const testDimensions = [
      { width: 1, height: 1, name: 'Very small panel' },
      { width: 10, height: 10, name: 'Small panel' },
      { width: 11, height: 11, name: 'Just above 10' },
      { width: 20, height: 20, name: 'Medium small' },
      { width: 24, height: 50, name: 'Minimum width threshold' },
      { width: 25, height: 50, name: 'Just above width threshold' },
      { width: 36, height: 83, name: 'Just below height threshold' },
      { width: 36, height: 84, name: 'At height threshold' },
      { width: 200, height: 200, name: 'Very large panel' }
    ]
    
    console.log('🧪 Testing different panel dimensions for each extrusion:\n')
    
    for (const extrusion of extrusions) {
      console.log(`🔧 Testing ${extrusion.partNumber} - ${extrusion.baseName}`)
      
      for (const dim of testDimensions) {
        let cost = 0
        let method = 'unknown'
        let details = ''
        
        // Test pricing logic for this extrusion with these dimensions
        if (extrusion.stockLengthRules.length > 0) {
          const bestRule = findBestStockLengthRule(extrusion.stockLengthRules, dim.width, dim.height)
          if (bestRule) {
            if (bestRule.formula) {
              const variables = {
                width: dim.width,
                height: dim.height,
                quantity: 1,
                basePrice: bestRule.basePrice || 0,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1
              }
              cost = evaluateFormula(bestRule.formula, variables)
              method = 'formula'
              details = `Rule: ${bestRule.name}, Formula: ${bestRule.formula}`
            } else if (bestRule.basePrice) {
              cost = bestRule.basePrice
              method = 'stock_rule_base'
              details = `Rule: ${bestRule.name}, Base: $${bestRule.basePrice}`
            }
          } else {
            // No applicable rule - fallback to master part cost
            cost = extrusion.cost || 0
            method = 'master_part_fallback'
            details = `No applicable rule, fallback to master part cost: $${extrusion.cost || 0}`
          }
        } else if (extrusion.pricingRules.length > 0) {
          const rule = extrusion.pricingRules[0]
          if (rule.formula) {
            const variables = {
              width: dim.width,
              height: dim.height,
              quantity: 1,
              basePrice: rule.basePrice || 0
            }
            cost = evaluateFormula(rule.formula, variables)
            method = 'pricing_rule_formula'
            details = `Pricing rule formula: ${rule.formula}`
          } else if (rule.basePrice) {
            cost = rule.basePrice
            method = 'pricing_rule_base'
            details = `Pricing rule base: $${rule.basePrice}`
          }
        } else {
          cost = extrusion.cost || 0
          method = 'master_part_direct'
          details = `Direct master part cost: $${extrusion.cost || 0}`
        }
        
        // Flag any results that are exactly $1 or suspiciously low
        if (cost === 1) {
          console.log(`  🎯 FOUND $1 PRICING: ${dim.name} (${dim.width}×${dim.height})`)
          console.log(`     Method: ${method}`)
          console.log(`     Details: ${details}`)
        } else if (cost > 0 && cost < 5) {
          console.log(`  ⚠️  Low pricing: ${dim.name} (${dim.width}×${dim.height}) = $${cost}`)
          console.log(`     Method: ${method}`)
          console.log(`     Details: ${details}`)
        }
      }
    }
    
    console.log('\n🔍 Checking for formulas that could evaluate to $1')
    
    // Look for formulas that might evaluate to 1 with certain inputs
    const allRules = await prisma.stockLengthRule.findMany({
      where: { 
        isActive: true,
        formula: { not: null }
      },
      include: {
        masterPart: true
      }
    })
    
    console.log(`Found ${allRules.length} rules with formulas\n`)
    
    for (const rule of allRules) {
      console.log(`📐 Rule: ${rule.name} (${rule.masterPart.partNumber})`)
      console.log(`   Formula: ${rule.formula}`)
      
      // Test with various input combinations that might result in $1
      const testInputs = [
        { width: 11, height: 96, basePrice: 1, stockLength: 120 },
        { width: 36, height: 11, basePrice: 1, stockLength: 120 },
        { width: 1, height: 1, basePrice: 1, stockLength: 120 },
        { width: 12, height: 12, basePrice: 12, stockLength: 120 },
        { width: 36, height: 96, basePrice: 0.01, stockLength: 120 }
      ]
      
      for (const input of testInputs) {
        const variables = {
          width: input.width,
          height: input.height,
          quantity: 1,
          basePrice: input.basePrice,
          stockLength: input.stockLength,
          piecesPerUnit: 1
        }
        
        const result = evaluateFormula(rule.formula, variables)
        if (result === 1) {
          console.log(`  🎯 FORMULA EVALUATES TO $1:`)
          console.log(`     Input: W:${input.width} H:${input.height} basePrice:${input.basePrice} stockLength:${input.stockLength}`)
          console.log(`     Formula: ${rule.formula} = $${result}`)
        } else if (result > 0 && result < 2) {
          console.log(`  ⚠️  Formula close to $1: $${result}`)
          console.log(`     Input: W:${input.width} H:${input.height} basePrice:${input.basePrice} stockLength:${input.stockLength}`)
        }
      }
    }
    
    console.log('\n🔍 Checking ProductBOM formulas for $1 results')
    
    const bomFormulas = await prisma.productBOM.findMany({
      where: {
        formula: { not: null },
        partType: 'Extrusion'
      }
    })
    
    for (const bom of bomFormulas) {
      console.log(`📦 BOM: ${bom.partName} - Formula: ${bom.formula}`)
      
      // Test with dimensions that might result in $1
      const testInputs = [
        { width: 11, height: 96 },
        { width: 12, height: 96 },
        { width: 1, height: 96 },
        { width: 2, height: 96 },
        { width: 36, height: 11 },
        { width: 36, height: 12 }
      ]
      
      for (const input of testInputs) {
        const variables = {
          width: input.width,
          height: input.height,
          quantity: 1
        }
        
        const result = evaluateFormula(bom.formula, variables)
        if (result === 1) {
          console.log(`  🎯 BOM FORMULA EVALUATES TO $1:`)
          console.log(`     Panel: ${input.width}×${input.height}`)
          console.log(`     Formula: ${bom.formula} = $${result}`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
findOneDollarIssue().catch(console.error)
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

async function debugExtraDollar() {
  console.log('🔍 Debugging Extra Dollar Issue')
  console.log('===============================\n')
  
  try {
    // Get the current opening
    const opening = await prisma.opening.findUnique({
      where: { id: 5 },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productBOMs: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!opening || !opening.panels[0]) {
      console.log('❌ Opening or panel not found')
      return
    }

    const panel = opening.panels[0]
    const product = panel.componentInstance.product
    
    console.log('📋 Current Configuration:')
    console.log(`   Opening ID: ${opening.id}`)
    console.log(`   Panel Dimensions: ${panel.width}"W × ${panel.height}"H`)
    console.log(`   Product: ${product.name}`)
    console.log(`   Current Stored Price: $${opening.price || 'not set'}`)
    
    console.log('\n🧮 Manual Step-by-step Calculation:')
    console.log('==================================')
    
    let manualTotal = 0
    const calculations = []
    
    // Process each BOM item manually
    for (let i = 0; i < product.productBOMs.length; i++) {
      const bom = product.productBOMs[i]
      console.log(`\n${i + 1}. ${bom.partName} (${bom.partNumber})`)
      console.log(`   Part Type: ${bom.partType}`)
      console.log(`   Quantity: ${bom.quantity || 1}`)
      console.log(`   Direct Cost: ${bom.cost || 'none'}`)
      console.log(`   Formula: ${bom.formula || 'none'}`)
      
      let itemCost = 0
      let method = ''
      let details = ''
      
      // Method 1: Direct cost from ProductBOM
      if (bom.cost && bom.cost > 0) {
        itemCost = bom.cost * (bom.quantity || 1)
        method = 'direct_bom_cost'
        details = `Direct cost: $${bom.cost} × ${bom.quantity || 1} = $${itemCost}`
      }
      // Method 2: Formula from ProductBOM  
      else if (bom.formula) {
        const variables = {
          width: panel.width,
          height: panel.height,
          quantity: bom.quantity || 1
        }
        itemCost = evaluateFormula(bom.formula, variables)
        method = 'bom_formula'
        details = `Formula: ${bom.formula} with width=${panel.width} = ${itemCost}`
      }
      // Method 3: Look up MasterPart
      else if (bom.partNumber) {
        const masterPart = await prisma.masterPart.findUnique({
          where: { partNumber: bom.partNumber },
          include: {
            stockLengthRules: { where: { isActive: true } },
            pricingRules: { where: { isActive: true } }
          }
        })
        
        if (masterPart && masterPart.stockLengthRules.length > 0) {
          const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, panel.width, panel.height)
          if (bestRule) {
            if (bestRule.formula) {
              const variables = {
                width: panel.width,
                height: panel.height,
                quantity: bom.quantity || 1,
                basePrice: bestRule.basePrice || 0,
                stockLength: bestRule.stockLength || 0,
                piecesPerUnit: bestRule.piecesPerUnit || 1
              }
              itemCost = evaluateFormula(bestRule.formula, variables)
              method = 'extrusion_rule_formula'
              details = `Rule "${bestRule.name}": ${bestRule.formula}`
            } else if (bestRule.basePrice) {
              itemCost = bestRule.basePrice * (bom.quantity || 1)
              method = 'extrusion_rule_base'
              details = `Rule "${bestRule.name}": $${bestRule.basePrice} × ${bom.quantity || 1} = $${itemCost}`
            }
          }
        }
      }
      
      console.log(`   💰 Calculated Cost: $${itemCost}`)
      console.log(`   📋 Method: ${method}`)
      console.log(`   📝 Details: ${details}`)
      
      manualTotal += itemCost
      calculations.push({
        partName: bom.partName,
        cost: itemCost,
        method: method,
        details: details
      })
    }
    
    console.log('\n📊 Manual Calculation Summary:')
    console.log('==============================')
    calculations.forEach((calc, i) => {
      console.log(`${i + 1}. ${calc.partName}: $${calc.cost}`)
    })
    console.log(`   ──────────────────────`)
    console.log(`   Manual Total: $${manualTotal}`)
    
    // Now call the API and compare
    console.log('\n🌐 API Call Comparison:')
    console.log('=======================')
    
    const response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const apiData = await response.json()
      console.log(`API Total: $${apiData.calculatedPrice}`)
      
      console.log('\nAPI Breakdown:')
      apiData.breakdown.components[0].bomCosts.forEach((item, i) => {
        console.log(`${i + 1}. ${item.partName}: $${item.totalCost} (${item.method})`)
      })
      
      console.log('\n🔍 Comparison:')
      console.log(`Manual Total: $${manualTotal}`)
      console.log(`API Total: $${apiData.calculatedPrice}`)
      console.log(`Difference: $${Math.abs(manualTotal - apiData.calculatedPrice)}`)
      
      if (Math.abs(manualTotal - apiData.calculatedPrice) > 0.01) {
        console.log('❌ DISCREPANCY FOUND!')
        
        // Compare item by item
        console.log('\n🔍 Item-by-item Comparison:')
        calculations.forEach((manual, i) => {
          const api = apiData.breakdown.components[0].bomCosts[i]
          if (api && Math.abs(manual.cost - api.totalCost) > 0.01) {
            console.log(`❌ ${manual.partName}:`)
            console.log(`   Manual: $${manual.cost} (${manual.method})`)
            console.log(`   API: $${api.totalCost} (${api.method})`)
            console.log(`   Difference: $${Math.abs(manual.cost - api.totalCost)}`)
          } else if (api) {
            console.log(`✅ ${manual.partName}: Both $${manual.cost}`)
          }
        })
      } else {
        console.log('✅ Manual and API calculations match!')
      }
    } else {
      console.log('❌ API call failed')
    }
    
    // Check if the user expectation is wrong
    console.log('\n💭 User Expectation Analysis:')
    console.log('============================')
    console.log('User reported: "should be $40 but shows $41"')
    console.log(`Current calculation: $${manualTotal}`)
    
    if (manualTotal === 41) {
      console.log('💡 The calculation appears to be mathematically correct.')
      console.log('💡 Possible issues:')
      console.log('   1. User expectation is based on different dimensions')
      console.log('   2. One of the pricing rules/formulas is incorrect')
      console.log('   3. There was a recent change that broke expectations')
      
      // Test with different width to see if we can get $40
      console.log('\n🧪 Testing different widths to find $40 total:')
      for (let testWidth = 30; testWidth <= 40; testWidth++) {
        const topTrimCost = Math.max(0, testWidth - 10)  // width-10 formula
        const bottomChannelCost = 15  // fixed cost
        const testTotal = topTrimCost + bottomChannelCost
        
        if (testTotal === 40) {
          console.log(`   ✅ Width ${testWidth}": Top Trim $${topTrimCost} + Bottom Channel $15 = $40`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during debugging:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the debug
debugExtraDollar().catch(console.error)
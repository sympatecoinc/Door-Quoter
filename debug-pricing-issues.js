const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Function to evaluate simple mathematical formulas
function evaluateFormula(formula, variables) {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0
  
  try {
    // Replace variables in formula
    let expression = formula.trim()
    console.log(`    🔤 Original formula: "${formula}"`)
    console.log(`    📊 Variables available:`, variables)
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      const beforeReplace = expression
      expression = expression.replace(regex, value.toString())
      if (beforeReplace !== expression) {
        console.log(`    🔄 Replaced "${key}" with "${value}": "${beforeReplace}" -> "${expression}"`)
      }
    }
    
    // Check if expression is empty after variable replacement
    if (!expression || expression.trim() === '') {
      console.log(`    ❌ Expression is empty after variable replacement`)
      return 0
    }
    
    console.log(`    🧮 Final expression to evaluate: "${expression}"`)
    
    // Basic math evaluation (be careful with eval - this is simplified)
    const result = eval(expression)
    const finalResult = isNaN(result) ? 0 : Math.max(0, result)
    console.log(`    ✅ Evaluation result: ${result} -> final: ${finalResult}`)
    return finalResult
  } catch (error) {
    console.error('    ❌ Formula evaluation error:', error)
    return 0
  }
}

async function testProblematicScenarios() {
  console.log('🔍 Testing Problematic Pricing Scenarios')
  console.log('===============================================\n')
  
  // Scenario 1: Test what happens with invalid formulas
  console.log('📋 Scenario 1: Invalid/Empty Formulas')
  console.log('───────────────────────────────────────')
  
  const testFormulas = [
    { name: 'Empty string', formula: '', variables: { width: 36, height: 96 } },
    { name: 'Only spaces', formula: '   ', variables: { width: 36, height: 96 } },
    { name: 'Undefined variable', formula: 'unknownVar * 2', variables: { width: 36, height: 96 } },
    { name: 'Missing operator', formula: 'width height', variables: { width: 36, height: 96 } },
    { name: 'Invalid syntax', formula: 'width + +', variables: { width: 36, height: 96 } },
    { name: 'Zero result', formula: 'width - width', variables: { width: 36, height: 96 } },
    { name: 'Negative result (should be 0)', formula: 'width - 100', variables: { width: 36, height: 96 } },
    { name: 'Normal formula', formula: 'width - 10', variables: { width: 36, height: 96 } }
  ]
  
  testFormulas.forEach((test, index) => {
    console.log(`\n  Test ${index + 1}: ${test.name}`)
    const result = evaluateFormula(test.formula, test.variables)
    console.log(`  💰 Result: $${result}`)
  })
  
  console.log('\n')
  
  // Scenario 2: Test stock length rule matching edge cases
  console.log('📋 Scenario 2: Stock Length Rule Edge Cases')  
  console.log('──────────────────────────────────────────')
  
  // Get all stock length rules
  const stockRules = await prisma.stockLengthRule.findMany({
    include: {
      masterPart: true
    }
  })
  
  console.log(`Found ${stockRules.length} stock length rules\n`)
  
  // Test different component dimensions
  const testDimensions = [
    { width: 36, height: 96, name: 'Current opening' },
    { width: 36, height: 84, name: 'Lower height' },
    { width: 36, height: 97, name: 'Just above boundary' },
    { width: 49, height: 96, name: 'Wider panel' },
    { width: 100, height: 96, name: 'Very wide panel' },
    { width: 12, height: 50, name: 'Small panel' }
  ]
  
  for (const dim of testDimensions) {
    console.log(`\n  🔍 Testing dimensions: ${dim.width}"W x ${dim.height}"H (${dim.name})`)
    
    for (const rule of stockRules) {
      const matchesWidth = (rule.minWidth === null || dim.width >= rule.minWidth) && 
                          (rule.maxWidth === null || dim.width <= rule.maxWidth)
      const matchesHeight = (rule.minHeight === null || dim.height >= rule.minHeight) && 
                           (rule.maxHeight === null || dim.height <= rule.maxHeight)
      
      const matches = rule.isActive && matchesWidth && matchesHeight
      
      if (matches) {
        console.log(`    ✅ ${rule.masterPart.partNumber} - ${rule.name}: $${rule.basePrice || 0}`)
        console.log(`       Range: W(${rule.minWidth || '∞'}-${rule.maxWidth || '∞'}) H(${rule.minHeight || '∞'}-${rule.maxHeight || '∞'})`)
      }
    }
  }
  
  console.log('\n')
  
  // Scenario 3: Check for $1 pricing scenarios
  console.log('📋 Scenario 3: Potential $1 Pricing Issues')
  console.log('─────────────────────────────────────────')
  
  // Check all master parts to see if any have $1 cost or base prices
  const masterParts = await prisma.masterPart.findMany({
    include: {
      stockLengthRules: true,
      pricingRules: true
    }
  })
  
  console.log('Parts with $1 pricing:')
  masterParts.forEach(part => {
    if (part.cost === 1) {
      console.log(`  💰 ${part.partNumber} - ${part.baseName}: Direct cost $1`)
    }
    
    part.stockLengthRules.forEach(rule => {
      if (rule.basePrice === 1) {
        console.log(`  💰 ${part.partNumber} - ${rule.name}: Stock rule base price $1`)
      }
    })
    
    part.pricingRules.forEach(rule => {
      if (rule.basePrice === 1) {
        console.log(`  💰 ${part.partNumber} - ${rule.name}: Pricing rule base price $1`)
      }
    })
  })
  
  console.log('\n')
  
  // Scenario 4: Test what happens when no rules match
  console.log('📋 Scenario 4: No Matching Rules Scenario')
  console.log('────────────────────────────────────────')
  
  // Find an extrusion with rules and test with dimensions that won't match
  const extrusionWithRules = await prisma.masterPart.findFirst({
    where: {
      partType: 'Extrusion',
      stockLengthRules: {
        some: {
          isActive: true
        }
      }
    },
    include: {
      stockLengthRules: { where: { isActive: true } }
    }
  })
  
  if (extrusionWithRules) {
    console.log(`Testing ${extrusionWithRules.partNumber} with impossible dimensions`)
    
    // Try dimensions that should not match any rule
    const impossibleDimensions = { width: 1000, height: 1000 }
    
    console.log(`  🔍 Testing W:${impossibleDimensions.width} H:${impossibleDimensions.height}`)
    
    const applicableRules = extrusionWithRules.stockLengthRules.filter(rule => {
      const matchesWidth = (rule.minWidth === null || impossibleDimensions.width >= rule.minWidth) && 
                          (rule.maxWidth === null || impossibleDimensions.width <= rule.maxWidth)
      const matchesHeight = (rule.minHeight === null || impossibleDimensions.height >= rule.minHeight) && 
                           (rule.maxHeight === null || impossibleDimensions.height <= rule.maxHeight)
      
      return rule.isActive && matchesWidth && matchesHeight
    })
    
    console.log(`  📊 Applicable rules: ${applicableRules.length}`)
    if (applicableRules.length === 0) {
      console.log(`  ❌ No rules would match - would result in $0 cost`)
      console.log(`  💡 Fallback to MasterPart direct cost: $${extrusionWithRules.cost || 0}`)
    }
  }
  
  await prisma.$disconnect()
}

// Run the comprehensive debug
testProblematicScenarios().catch(console.error)
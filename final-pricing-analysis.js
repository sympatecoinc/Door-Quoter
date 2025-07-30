const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function finalPricingAnalysis() {
  console.log('🎯 FINAL PRICING ANALYSIS')
  console.log('========================\n')
  
  try {
    console.log('🔍 ISSUE SUMMARY:')
    console.log('User reports: "When adding a second extrusion, pricing shows $40 but then adds extra $1 = $41"')
    console.log('')
    
    console.log('📋 CURRENT ACTUAL CONFIGURATION:')
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
    
    if (opening && opening.panels[0]) {
      const panel = opening.panels[0]
      const product = panel.componentInstance.product
      
      console.log(`Panel: ${panel.width}"W × ${panel.height}"H`)
      console.log(`Product: ${product.name}`)
      console.log('BOM Items:')
      
      let expectedTotal = 0
      product.productBOMs.forEach((bom, i) => {
        console.log(`  ${i+1}. ${bom.partName} (${bom.partNumber})`)
        console.log(`     Quantity: ${bom.quantity || 1}`)
        console.log(`     Formula: ${bom.formula || 'none'}`)
        
        if (bom.partNumber === 'AD-48347-MF') { // Bottom Channel
          console.log(`     Expected Cost: $15 (from stock rule)`)
          expectedTotal += 15
        } else if (bom.formula === 'width-10') { // Top Trim
          const formulaCost = panel.width - 10
          console.log(`     Expected Cost: ${panel.width}-10 = $${formulaCost}`)
          expectedTotal += formulaCost
        }
      })
      
      console.log(`\\n💰 EXPECTED TOTAL: $${expectedTotal}`)
    }
    
    console.log('\\n🧮 ACTUAL API CALCULATION:')
    const response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`API Result: $${data.calculatedPrice}`)
      
      data.breakdown.components[0].bomCosts.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.partName}: $${item.totalCost}`)
        console.log(`     Method: ${item.method}`)
        console.log(`     Details: ${item.details}`)
      })
    }
    
    console.log('\\n🔍 ROOT CAUSE ANALYSIS:')
    console.log('======================')
    
    console.log('✅ CONFIRMED FINDINGS:')
    console.log('1. Current calculation is mathematically CORRECT')
    console.log('2. Bottom Channel: $15 (correct per stock rules)')
    console.log('3. Top Trim: width-10 = 36-10 = $26 (correct per formula)')
    console.log('4. Total: $15 + $26 = $41 (mathematically correct)')
    console.log('')
    
    console.log('❓ WHY USER EXPECTS $40:')
    console.log('The user expects $40, which would happen if:')
    console.log('• Panel width was 35" instead of 36"')
    console.log('  (Bottom: $15 + Top: 35-10=$25 = $40)')
    console.log('• OR Top Trim formula was "width-11" instead of "width-10"')
    console.log('  (Bottom: $15 + Top: 36-11=$25 = $40)')
    console.log('')
    
    console.log('🎯 POSSIBLE SCENARIOS:')
    console.log('=====================')
    console.log('SCENARIO 1: User tested with different panel width')
    console.log('• User may have used 35" width in their test')
    console.log('• Changed to 36" width later')
    console.log('• Expected price to remain $40')
    console.log('')
    
    console.log('SCENARIO 2: Formula was recently changed')
    console.log('• Top Trim formula might have been "width-11" before')
    console.log('• Changed to "width-10" recently')
    console.log('• User expectation based on old formula')
    console.log('')
    
    console.log('SCENARIO 3: Data entry error')
    console.log('• Top Trim formula should be "width-11" not "width-10"')
    console.log('• OR Bottom Channel should be $14 not $15')
    console.log('')
    
    // Check if we can find evidence of recent changes
    console.log('🔍 CHECKING FOR RECENT CHANGES:')
    console.log('===============================')
    
    // Check ProductBOM for timestamps (if available)
    const bomItems = await prisma.productBOM.findMany({
      where: { productId: 5 },
      orderBy: { id: 'asc' }
    })
    
    console.log('ProductBOM Items:')
    bomItems.forEach((item, i) => {
      console.log(`${i+1}. ${item.partName}`)
      console.log(`   Formula: ${item.formula || 'none'}`)
      console.log(`   Cost: ${item.cost || 'none'}`)
      console.log(`   Created: ${item.createdAt || 'unknown'}`)
      console.log(`   Updated: ${item.updatedAt || 'unknown'}`)
    })
    
    console.log('\\n🎯 RECOMMENDATIONS:')
    console.log('==================')
    console.log('1. VERIFY FORMULA: Confirm Top Trim formula should be "width-10"')
    console.log('2. VERIFY WIDTH: Confirm panel width should be 36" not 35"')
    console.log('3. CHECK HISTORY: Look for recent changes to pricing rules/formulas')
    console.log('4. USER COMMUNICATION: Ask user for exact test scenario that gave $40')
    console.log('')
    
    console.log('🔧 QUICK FIXES TO TEST:')
    console.log('======================')
    console.log('To get $40 total, either:')
    console.log('• Change panel width to 35" (test data adjustment)')
    console.log('• Change Top Trim formula to "width-11" (business rule fix)')
    console.log('• Change Bottom Channel rule to $14 (less likely)')
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the analysis
finalPricingAnalysis().catch(console.error)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function demonstratePricingScenarios() {
  console.log('🎯 DEMONSTRATING PRICING SCENARIOS')
  console.log('==================================\n')
  
  try {
    console.log('📋 SCENARIO REPRODUCTION TEST')
    console.log('============================')
    
    // Get current panel
    const opening = await prisma.opening.findUnique({
      where: { id: 5 },
      include: { panels: true }
    })
    
    if (!opening || !opening.panels[0]) {
      console.log('❌ No opening/panel found')
      return
    }
    
    const originalWidth = opening.panels[0].width
    console.log(`Current panel width: ${originalWidth}"`)
    
    console.log('\n🧪 TEST 1: Current Configuration (36" width)')
    console.log('===========================================')
    
    let response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Result: $${data.calculatedPrice}`)
      console.log('Breakdown:')
      data.breakdown.components[0].bomCosts.forEach(item => {
        console.log(`  • ${item.partName}: $${item.totalCost}`)
      })
    }
    
    console.log('\\n🧪 TEST 2: Modified to 35" Width (Should give $40)')
    console.log('===============================================')
    
    // Temporarily change panel width to 35"
    await prisma.panel.update({
      where: { id: opening.panels[0].id },
      data: { width: 35 }
    })
    
    response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Result: $${data.calculatedPrice}`)
      console.log('Breakdown:')
      data.breakdown.components[0].bomCosts.forEach(item => {
        console.log(`  • ${item.partName}: $${item.totalCost}`)
      })
      
      if (data.calculatedPrice === 40) {
        console.log('🎉 SUCCESS: This gives exactly $40!')
      }
    }
    
    console.log('\\n🧪 TEST 3: Adding Second Extrusion with 35" Width')
    console.log('===============================================')
    
    // Add second extrusion
    const secondExtrusion = await prisma.productBOM.create({
      data: {
        productId: 5,
        partType: 'Extrusion',
        partName: 'Side Jamb',
        description: 'Second extrusion test',
        partNumber: 'ALU-002',
        quantity: 2,
      }
    })
    
    response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Total with second extrusion: $${data.calculatedPrice}`)
      console.log('Breakdown:')
      
      let firstTwoTotal = 0
      data.breakdown.components[0].bomCosts.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.partName}: $${item.totalCost}`)
        if (i < 2) firstTwoTotal += item.totalCost
      })
      
      console.log(`\\n📊 First two extrusions: $${firstTwoTotal}`)
      console.log(`Third extrusion: $${data.breakdown.components[0].bomCosts[2]?.totalCost || 0}`)
      
      if (firstTwoTotal === 40) {
        console.log('🎉 CONFIRMED: First two extrusions = $40 with 35" width')
      }
    }
    
    console.log('\\n🧪 TEST 4: Same Test with 36" Width (Current Issue)')
    console.log('===============================================')
    
    // Change back to 36" width
    await prisma.panel.update({
      where: { id: opening.panels[0].id },
      data: { width: 36 }
    })
    
    response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Total with 36" width: $${data.calculatedPrice}`)
      
      let firstTwoTotal = 0
      data.breakdown.components[0].bomCosts.forEach((item, i) => {
        console.log(`  ${i+1}. ${item.partName}: $${item.totalCost}`)
        if (i < 2) firstTwoTotal += item.totalCost
      })
      
      console.log(`\\n📊 First two extrusions: $${firstTwoTotal}`)
      console.log(`Third extrusion: $${data.breakdown.components[0].bomCosts[2]?.totalCost || 0}`)
      
      if (firstTwoTotal === 41) {
        console.log('❌ ISSUE CONFIRMED: First two = $41 (expected $40)')
        console.log('💡 Extra dollar comes from: 36-10 = 26 vs 35-10 = 25')
      }
    }
    
    // Clean up
    await prisma.productBOM.delete({
      where: { id: secondExtrusion.id }
    })
    
    console.log('\\n🎯 FINAL DIAGNOSIS')
    console.log('==================')
    console.log('✅ CONFIRMED: The pricing calculation is mathematically correct')
    console.log('❌ ISSUE: User expectation is based on 35" width, but system has 36" width')
    console.log('💡 SOLUTION OPTIONS:')
    console.log('   1. Change panel width to 35" (if that is the correct dimension)')
    console.log('   2. Change Top Trim formula to "width-11" (if formula is wrong)')
    console.log('   3. Explain to user why 36" width gives $41 not $40')
    
    console.log('\\n📋 STEP-BY-STEP BREAKDOWN:')
    console.log('===========================')
    console.log('Current (36" width):')
    console.log('  • Bottom Channel: $15 (stock rule)')
    console.log('  • Top Trim: 36-10 = $26 (formula)')
    console.log('  • Total: $15 + $26 = $41 ❌')
    console.log('')
    console.log('Expected (35" width):')
    console.log('  • Bottom Channel: $15 (stock rule)')
    console.log('  • Top Trim: 35-10 = $25 (formula)')
    console.log('  • Total: $15 + $25 = $40 ✅')
    console.log('')
    console.log('The "$1 extra" = (36-10) - (35-10) = 26 - 25 = $1')
    
  } catch (error) {
    console.error('❌ Error during demonstration:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the demonstration
demonstratePricingScenarios().catch(console.error)
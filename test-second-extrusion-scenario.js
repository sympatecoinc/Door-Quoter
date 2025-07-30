const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSecondExtrusionScenario() {
  console.log('🔍 Testing Second Extrusion Scenario')
  console.log('===================================\n')
  
  try {
    console.log('📋 Step 1: Current State')
    console.log('Bottom Channel: $15')
    console.log('Top Trim (width-10): $26')
    console.log('Current Total: $41')
    console.log('')
    
    console.log('📋 Step 2: Adding a second extrusion temporarily')
    
    // Add another extrusion to test the scenario
    const secondExtrusion = await prisma.productBOM.create({
      data: {
        productId: 5,
        partType: 'Extrusion',
        partName: 'Side Jamb',
        description: 'Additional extrusion for testing',
        partNumber: 'ALU-002', // Side Jamb Extrusion
        quantity: 2,
      }
    })
    
    console.log(`✅ Added second extrusion: ${secondExtrusion.partName} (ID: ${secondExtrusion.id})`)
    
    // Calculate new price
    const response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`\n💰 New Total with Second Extrusion: $${data.calculatedPrice}`)
      
      console.log('\nBreakdown:')
      data.breakdown.components[0].bomCosts.forEach((item, i) => {
        console.log(`${i + 1}. ${item.partName}: $${item.totalCost}`)
      })
      
      // Calculate what the first two extrusions should cost
      const firstTwoExtrusions = data.breakdown.components[0].bomCosts.slice(0, 2)
      const firstTwoTotal = firstTwoExtrusions.reduce((sum, item) => sum + item.totalCost, 0)
      
      console.log(`\n🔍 Analysis:`)
      console.log(`First two extrusions total: $${firstTwoTotal}`)
      console.log(`Third extrusion (Side Jamb × 2): $${data.breakdown.components[0].bomCosts[2]?.totalCost || 0}`)
      
      console.log(`\n💭 User Expectation Analysis:`)
      if (firstTwoTotal === 40) {
        console.log('✅ First two extrusions DO equal $40')
        console.log('❓ But current configuration shows $41 for first two')
        console.log('💡 This suggests the user tested with different dimensions')
      } else if (firstTwoTotal === 41) {
        console.log('❌ First two extrusions equal $41, not $40')
        console.log('💡 The user\'s expectation might be based on:')
        console.log('   - Different panel width (35" would give $40)')
        console.log('   - Incorrect formula expectation')
        console.log('   - Different pricing rules in the past')
      }
      
      // Test what panel width would give exactly $40 for first two
      console.log('\n🧪 Testing panel widths that would give $40 for first two extrusions:')
      console.log('Bottom Channel is always $15 (based on stock rules)')
      console.log('Top Trim formula: width-10')
      console.log('For $40 total: 15 + (width-10) = 40')
      console.log('Therefore: width-10 = 25')
      console.log('Therefore: width = 35')
      console.log('✅ Panel width of 35" would give exactly $40 for the first two extrusions')
      
    } else {
      console.log('❌ API call failed')
    }
    
    // Clean up
    console.log('\n📋 Step 3: Cleaning up test data')
    await prisma.productBOM.delete({
      where: { id: secondExtrusion.id }
    })
    console.log('✅ Removed test extrusion')
    
    console.log('\n🎯 CONCLUSION:')
    console.log('=============')
    console.log('The "$1 extra" issue is likely due to:')
    console.log('1. User expectation based on 35" width panels (which would be $40)')
    console.log('2. Current test uses 36" width panels (which correctly calculates to $41)')
    console.log('3. The extra $1 comes from: (36-10) - (35-10) = 26 - 25 = $1')
    console.log('')
    console.log('RECOMMENDATION:')
    console.log('- Verify with user what panel dimensions they expect')
    console.log('- If formula "width-10" is incorrect, it should be adjusted')
    console.log('- If panel width should be 35", update the test data')
    
  } catch (error) {
    console.error('❌ Error during test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testSecondExtrusionScenario().catch(console.error)
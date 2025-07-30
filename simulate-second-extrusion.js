const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simulateSecondExtrusionIssue() {
  console.log('🔍 Simulating Second Extrusion Addition Issue')
  console.log('==============================================\n')
  
  try {
    // Step 1: Add a third extrusion to the product to simulate the user's scenario
    console.log('📋 Step 1: Current Product BOMs for "New Door" (Product ID 5)')
    
    const currentBOMs = await prisma.productBOM.findMany({
      where: { productId: 5 },
      orderBy: { id: 'asc' }
    })
    
    console.log('Current BOM items:')
    currentBOMs.forEach((bom, index) => {
      console.log(`  ${index + 1}. ${bom.partName} (${bom.partNumber}) - ${bom.partType}`)
      console.log(`     Quantity: ${bom.quantity || 1}`)
      console.log(`     Cost: ${bom.cost || 'none'}`)
      console.log(`     Formula: ${bom.formula || 'none'}`)
    })
    
    console.log('\n📋 Step 2: Adding a third extrusion to simulate the issue')
    
    // Add a third extrusion that might cause pricing issues
    const newExtrusion = await prisma.productBOM.create({
      data: {
        productId: 5,
        partType: 'Extrusion',
        partName: 'Side Jamb',
        description: 'Vertical side extrusion',
        partNumber: 'ALU-002', // This exists in MasterParts
        quantity: 2, // Typical for side jambs (left and right)
        // Intentionally not setting cost or formula to test fallback logic
      }
    })
    
    console.log(`✅ Added new extrusion: ${newExtrusion.partName} (ID: ${newExtrusion.id})`)
    
    console.log('\n📋 Step 3: Recalculating price with new extrusion')
    
    // Test the pricing API
    const response = await fetch('http://localhost:3000/api/openings/5/calculate-price', {
      method: 'POST'
    })
    
    if (!response.ok) {
      console.log('❌ API call failed:', response.status, response.statusText)
      return
    }
    
    const pricingData = await response.json()
    
    console.log('💰 New pricing breakdown:')
    console.log(`   Total Price: $${pricingData.calculatedPrice}`)
    
    pricingData.breakdown.components[0].bomCosts.forEach((bom, index) => {
      console.log(`\n   ${index + 1}. ${bom.partName} (${bom.partNumber})`)
      console.log(`      Method: ${bom.method}`)
      console.log(`      Unit Cost: $${bom.unitCost}`)
      console.log(`      Quantity: ${bom.quantity}`)
      console.log(`      Total Cost: $${bom.totalCost}`)
      console.log(`      Details: ${bom.details}`)
    })
    
    console.log('\n📋 Step 4: Checking for potential $1 pricing issue')
    
    // Look for any BOM items that resulted in very low pricing
    const lowPricedItems = pricingData.breakdown.components[0].bomCosts.filter(bom => 
      bom.totalCost <= 1 && bom.totalCost > 0
    )
    
    if (lowPricedItems.length > 0) {
      console.log('⚠️  Found items with very low pricing (≤ $1):')
      lowPricedItems.forEach(item => {
        console.log(`   - ${item.partName}: $${item.totalCost}`)
        console.log(`     Method: ${item.method}`)
        console.log(`     Details: ${item.details}`)
      })
    } else {
      console.log('✅ No items found with $1 pricing')
    }
    
    console.log('\n📋 Step 5: Investigating ALU-002 master part details')
    
    // Check the master part that was added
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: 'ALU-002' },
      include: {
        stockLengthRules: { where: { isActive: true } },
        pricingRules: { where: { isActive: true } }
      }
    })
    
    if (masterPart) {
      console.log(`🔍 Master Part: ${masterPart.baseName}`)
      console.log(`   Part Type: ${masterPart.partType}`)
      console.log(`   Direct Cost: ${masterPart.cost || 'none'}`)
      console.log(`   Stock Length Rules: ${masterPart.stockLengthRules.length}`)
      console.log(`   Pricing Rules: ${masterPart.pricingRules.length}`)
      
      if (masterPart.stockLengthRules.length > 0) {
        console.log('\n   📏 Stock Length Rules:')
        masterPart.stockLengthRules.forEach((rule, index) => {
          console.log(`     ${index + 1}. ${rule.name}`)
          console.log(`        Height range: ${rule.minHeight || '∞'} - ${rule.maxHeight || '∞'}`)
          console.log(`        Width range: ${rule.minWidth || '∞'} - ${rule.maxWidth || '∞'}`)
          console.log(`        Base price: $${rule.basePrice || 0}`)
          console.log(`        Stock length: ${rule.stockLength || 'N/A'}`)
          console.log(`        Formula: ${rule.formula || 'none'}`)
        })
      }
    }
    
    // Clean up - remove the test extrusion
    console.log('\n📋 Step 6: Cleaning up test data')
    await prisma.productBOM.delete({
      where: { id: newExtrusion.id }
    })
    console.log('✅ Removed test extrusion')
    
  } catch (error) {
    console.error('❌ Error during simulation:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the simulation
simulateSecondExtrusionIssue().catch(console.error)
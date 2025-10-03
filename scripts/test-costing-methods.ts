import { prisma } from '../src/lib/prisma'

async function testCostingMethods() {
  console.log('=== TESTING EXTRUSION COSTING METHODS ===\n')

  // Get a project with openings
  const project = await prisma.project.findFirst({
    include: {
      openings: {
        include: {
          panels: true
        }
      }
    }
  })

  if (!project) {
    console.log('No projects found in database')
    await prisma.$disconnect()
    return
  }

  const opening = project.openings[0]
  if (!opening) {
    console.log('No openings found in project')
    await prisma.$disconnect()
    return
  }

  console.log(`Project: ${project.name} (ID: ${project.id})`)
  console.log(`Opening: ${opening.name} (ID: ${opening.id})`)
  console.log(`Current costing method: ${project.extrusionCostingMethod || 'FULL_STOCK'}\n`)

  // Test with FULL_STOCK method
  console.log('--- Testing FULL_STOCK Method ---')
  await prisma.project.update({
    where: { id: project.id },
    data: { extrusionCostingMethod: 'FULL_STOCK' }
  })

  const fullStockResponse = await fetch(`http://localhost:3000/api/openings/${opening.id}/calculate-price`, {
    method: 'POST'
  })
  const fullStockData = await fullStockResponse.json()

  if (fullStockData.error) {
    console.log('Error:', fullStockData.error)
  } else {
    console.log(`Calculated Price: $${fullStockData.calculatedPrice}`)
    console.log('\nBreakdown:')
    for (const component of fullStockData.breakdown.components) {
      console.log(`  ${component.productName}: $${component.totalComponentCost.toFixed(2)}`)
      for (const bom of component.bomCosts) {
        if (bom.partType === 'Extrusion' && bom.totalCost > 0) {
          console.log(`    - ${bom.partName}: $${bom.totalCost.toFixed(2)} (${bom.method})`)
        }
      }
    }
  }

  console.log('\n--- Testing PERCENTAGE_BASED Method ---')
  await prisma.project.update({
    where: { id: project.id },
    data: { extrusionCostingMethod: 'PERCENTAGE_BASED' }
  })

  const percentageResponse = await fetch(`http://localhost:3000/api/openings/${opening.id}/calculate-price`, {
    method: 'POST'
  })
  const percentageData = await percentageResponse.json()

  if (percentageData.error) {
    console.log('Error:', percentageData.error)
  } else {
    console.log(`Calculated Price: $${percentageData.calculatedPrice}`)
    console.log('\nBreakdown:')
    for (const component of percentageData.breakdown.components) {
      console.log(`  ${component.productName}: $${component.totalComponentCost.toFixed(2)}`)
      for (const bom of component.bomCosts) {
        if (bom.partType === 'Extrusion' && bom.totalCost > 0) {
          console.log(`    - ${bom.partName}: $${bom.totalCost.toFixed(2)} (${bom.method})`)
        }
      }
    }
  }

  console.log('\n--- Comparison ---')
  if (fullStockData.calculatedPrice && percentageData.calculatedPrice) {
    const difference = fullStockData.calculatedPrice - percentageData.calculatedPrice
    const percentageSavings = (difference / fullStockData.calculatedPrice) * 100
    console.log(`Full Stock: $${fullStockData.calculatedPrice.toFixed(2)}`)
    console.log(`Percentage-Based: $${percentageData.calculatedPrice.toFixed(2)}`)
    console.log(`Savings: $${difference.toFixed(2)} (${percentageSavings.toFixed(2)}%)`)
  }

  await prisma.$disconnect()
}

testCostingMethods()

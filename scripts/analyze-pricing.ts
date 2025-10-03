import { prisma } from '../src/lib/prisma'

async function analyzePricing() {
  // Check all ProductBOM entries
  const allBOMs = await prisma.productBOM.findMany({
    select: {
      id: true,
      partType: true,
      partName: true,
      partNumber: true,
      formula: true,
      cost: true,
      quantity: true,
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  console.log('=== ALL ProductBOM ENTRIES ===')
  console.log('Total BOM entries:', allBOMs.length)
  console.log()

  // Group by partType
  const byType: Record<string, any[]> = {}
  for (const bom of allBOMs) {
    if (!byType[bom.partType]) {
      byType[bom.partType] = []
    }
    byType[bom.partType].push(bom)
  }

  console.log('BOM entries by type:')
  for (const [type, items] of Object.entries(byType)) {
    console.log(`  ${type}: ${items.length}`)
  }
  console.log()

  // Check MasterParts
  const masterParts = await prisma.masterPart.findMany({
    select: {
      id: true,
      partType: true,
      partNumber: true,
      partName: true,
      cost: true,
      stockLengthRules: {
        where: { isActive: true }
      },
      pricingRules: {
        where: { isActive: true }
      }
    }
  })

  console.log('=== MASTER PARTS ===')
  console.log('Total master parts:', masterParts.length)
  console.log()

  const extrusionMasterParts = masterParts.filter(mp => mp.partType === 'Extrusion')
  console.log('Extrusion master parts:', extrusionMasterParts.length)

  if (extrusionMasterParts.length > 0) {
    console.log('\nExtrusion master parts with stock length rules:')
    for (const mp of extrusionMasterParts) {
      console.log(`  ${mp.partNumber} - ${mp.partName}`)
      console.log(`    Stock length rules: ${mp.stockLengthRules.length}`)
      console.log(`    Pricing rules: ${mp.pricingRules.length}`)
      console.log(`    Direct cost: ${mp.cost ? '$' + mp.cost : 'none'}`)
    }
  }

  // Check if any ProductBOM entries reference extrusion master parts
  const extrusionPartNumbers = extrusionMasterParts.map(mp => mp.partNumber)
  const bomsReferencingExtrusions = allBOMs.filter(bom =>
    bom.partNumber && extrusionPartNumbers.includes(bom.partNumber)
  )

  console.log('\n=== ProductBOMs referencing Extrusion MasterParts ===')
  console.log('Count:', bomsReferencingExtrusions.length)

  if (bomsReferencingExtrusions.length > 0) {
    console.log('\nDetails:')
    for (const bom of bomsReferencingExtrusions) {
      console.log(`  Product: ${bom.product.name}`)
      console.log(`    Part: ${bom.partNumber} - ${bom.partName}`)
      console.log(`    Part Type in BOM: ${bom.partType}`)
      console.log(`    Has formula: ${!!bom.formula}`)
      console.log(`    Has cost: ${bom.cost ? '$' + bom.cost : 'no'}`)
      console.log()
    }
  }

  await prisma.$disconnect()
}

analyzePricing()

import { prisma } from '../src/lib/prisma'

async function checkExtrusionPricing() {
  const extrusions = await prisma.productBOM.findMany({
    where: {
      partType: 'Extrusion'
    },
    select: {
      id: true,
      partName: true,
      partNumber: true,
      partType: true,
      formula: true,
      cost: true,
      quantity: true,
      product: {
        select: {
          name: true
        }
      }
    }
  })

  console.log('=== EXTRUSION ProductBOM ENTRIES ===')
  console.log('Total extrusions found:', extrusions.length)
  console.log()

  const withCost = extrusions.filter(e => e.cost && e.cost > 0)
  const withFormula = extrusions.filter(e => e.formula && e.formula.trim().length > 0)

  console.log('Extrusions WITH cost field set:', withCost.length)
  console.log('Extrusions WITH formula field set:', withFormula.length)
  console.log()

  if (withCost.length > 0) {
    console.log('⚠️  ISSUE FOUND: The following extrusions have COST values:')
    console.log('These will be priced using direct cost instead of stock length rules!')
    console.log()
    for (const ext of withCost) {
      console.log(`- ${ext.product.name} | ${ext.partName} | Part#: ${ext.partNumber} | Cost: $${ext.cost}`)
    }
  }

  await prisma.$disconnect()
}

checkExtrusionPricing()

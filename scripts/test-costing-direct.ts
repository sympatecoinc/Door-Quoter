import { prisma } from '../src/lib/prisma'

// Simulate the pricing logic
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, value.toString())
    }

    if (!expression || expression.trim() === '') {
      return 0
    }

    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    console.error('Formula evaluation error for formula:', formula, 'error:', error)
    return 0
  }
}

async function testCostingDirect() {
  console.log('=== TESTING EXTRUSION COSTING METHODS (DIRECT) ===\n')

  // Get sample opening with product BOMs
  const opening = await prisma.opening.findFirst({
    include: {
      project: true,
      panels: {
        include: {
          componentInstance: {
            include: {
              product: {
                include: {
                  productBOMs: {
                    where: {
                      partType: 'Extrusion'
                    },
                    take: 3  // Just test first 3 extrusions
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  if (!opening || !opening.panels[0]?.componentInstance) {
    console.log('No suitable opening found for testing')
    await prisma.$disconnect()
    return
  }

  const panel = opening.panels[0]
  const product = panel.componentInstance.product

  console.log(`Opening: ${opening.name}`)
  console.log(`Panel dimensions: ${panel.width}" x ${panel.height}"`)
  console.log(`Product: ${product.name}`)
  console.log(`Testing ${product.productBOMs.length} extrusions\n`)

  for (const bom of product.productBOMs) {
    if (!bom.partNumber) continue

    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber: bom.partNumber },
      include: {
        stockLengthRules: { where: { isActive: true } }
      }
    })

    if (!masterPart || masterPart.stockLengthRules.length === 0) continue

    const variables = {
      width: panel.width,
      height: panel.height,
      quantity: bom.quantity || 1
    }

    const requiredLength = bom.formula ? evaluateFormula(bom.formula, variables) : bom.quantity || 0
    const bestRule = masterPart.stockLengthRules[0]

    if (!bestRule.stockLength || !bestRule.basePrice) continue

    console.log(`\n${bom.partName} (${bom.partNumber})`)
    console.log(`  Required length: ${requiredLength.toFixed(2)}"`)
    console.log(`  Stock length: ${bestRule.stockLength}"`)
    console.log(`  Base price: $${bestRule.basePrice}`)

    // Calculate FULL_STOCK cost
    const fullStockCost = bestRule.basePrice * (bom.quantity || 1)
    console.log(`  FULL_STOCK: $${fullStockCost.toFixed(2)}`)

    // Calculate PERCENTAGE_BASED cost
    const usagePercentage = requiredLength / bestRule.stockLength
    const remainingPercentage = 1 - usagePercentage

    if (remainingPercentage > 0.5) {
      const percentageCost = bestRule.basePrice * usagePercentage * (bom.quantity || 1)
      console.log(`  PERCENTAGE_BASED: $${percentageCost.toFixed(2)} (${(usagePercentage * 100).toFixed(2)}% used, ${(remainingPercentage * 100).toFixed(2)}% remains)`)
      console.log(`  💰 Savings: $${(fullStockCost - percentageCost).toFixed(2)}`)
    } else {
      console.log(`  PERCENTAGE_BASED: $${fullStockCost.toFixed(2)} (fallback - >50% used)`)
      console.log(`  No savings (not enough material remaining)`)
    }
  }

  await prisma.$disconnect()
}

testCostingDirect()

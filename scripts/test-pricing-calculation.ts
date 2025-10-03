import { prisma } from '../src/lib/prisma'

// Simple formula evaluator (copied from the route)
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      // Create case-insensitive regex to match variable names
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

async function testPricingCalculation() {
  console.log('=== TESTING PRICING CALCULATION ===\n')

  // Get a sample opening with panels
  const opening = await prisma.opening.findFirst({
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

  if (!opening) {
    console.log('No openings found in database')
    await prisma.$disconnect()
    return
  }

  console.log(`Opening: ${opening.name}`)
  console.log(`  Finish Color: ${opening.finishColor || 'None'}`)
  console.log(`  Current Price: $${opening.price}`)
  console.log(`  Panels: ${opening.panels.length}\n`)

  let totalCalculatedCost = 0

  for (const panel of opening.panels) {
    if (!panel.componentInstance) {
      console.log(`Panel ${panel.id}: No component instance`)
      continue
    }

    const product = panel.componentInstance.product
    console.log(`Panel ${panel.id}: ${product.name}`)
    console.log(`  Dimensions: ${panel.width}" x ${panel.height}"`)
    console.log(`  BOMs: ${product.productBOMs.length}`)

    let panelCost = 0

    for (const bom of product.productBOMs) {
      const variables = {
        width: panel.width,
        height: panel.height,
        quantity: bom.quantity || 1
      }

      console.log(`\n  BOM: ${bom.partName}`)
      console.log(`    Part Type: ${bom.partType}`)
      console.log(`    Part Number: ${bom.partNumber || 'N/A'}`)
      console.log(`    Formula: ${bom.formula || 'None'}`)
      console.log(`    Direct Cost: ${bom.cost ? '$' + bom.cost : 'None'}`)
      console.log(`    Quantity: ${bom.quantity || 1}`)

      let itemCost = 0

      // Check pricing method
      if (bom.cost && bom.cost > 0) {
        itemCost = bom.cost * (bom.quantity || 1)
        console.log(`    ✓ Method: Direct BOM cost`)
        console.log(`    ✓ Calculation: $${bom.cost} × ${bom.quantity || 1} = $${itemCost}`)
      } else if (bom.formula && bom.partType !== 'Extrusion') {
        itemCost = evaluateFormula(bom.formula, variables)
        console.log(`    ✓ Method: BOM formula (non-extrusion)`)
        console.log(`    ✓ Calculation: ${bom.formula} = $${itemCost}`)
      } else if (bom.partNumber) {
        // Check master part
        const masterPart = await prisma.masterPart.findUnique({
          where: { partNumber: bom.partNumber },
          include: {
            stockLengthRules: { where: { isActive: true } },
            pricingRules: { where: { isActive: true } }
          }
        })

        if (masterPart) {
          console.log(`    ✓ Found MasterPart: ${masterPart.baseName}`)
          console.log(`      Part Type: ${masterPart.partType}`)
          console.log(`      Direct Cost: ${masterPart.cost ? '$' + masterPart.cost : 'None'}`)
          console.log(`      Stock Length Rules: ${masterPart.stockLengthRules.length}`)
          console.log(`      Pricing Rules: ${masterPart.pricingRules.length}`)

          if (masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
            // Calculate required length from BOM formula
            let requiredLength = 0
            if (bom.formula) {
              requiredLength = evaluateFormula(bom.formula, variables)
              console.log(`      Required Length: ${requiredLength}" (from formula: ${bom.formula})`)
            } else {
              requiredLength = bom.quantity || 0
              console.log(`      Required Length: ${requiredLength}" (from quantity)`)
            }

            // Find best stock length rule
            const bestRule = masterPart.stockLengthRules
              .filter(rule => {
                const matchesLength = (rule.minHeight === null || requiredLength >= rule.minHeight) &&
                                    (rule.maxHeight === null || requiredLength <= rule.maxHeight)
                return rule.isActive && matchesLength
              })
              .sort((a, b) => {
                const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
                const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
                return bSpecificity - aSpecificity
              })[0]

            if (bestRule) {
              console.log(`      Best Rule: ${bestRule.name}`)
              console.log(`        Base Price: $${bestRule.basePrice || 0}`)
              console.log(`        Stock Length: ${bestRule.stockLength || 'N/A'}`)
              console.log(`        Formula: ${bestRule.formula || 'None'}`)

              if (bestRule.formula) {
                const extrusionVariables = {
                  ...variables,
                  basePrice: bestRule.basePrice || 0,
                  stockLength: bestRule.stockLength || 0,
                  piecesPerUnit: bestRule.piecesPerUnit || 1,
                  requiredLength: requiredLength
                }
                itemCost = evaluateFormula(bestRule.formula, extrusionVariables)
                console.log(`        ✓ Calculation: ${bestRule.formula} = $${itemCost}`)
              } else if (bestRule.basePrice) {
                itemCost = bestRule.basePrice * (bom.quantity || 1)
                console.log(`        ✓ Calculation: $${bestRule.basePrice} × ${bom.quantity || 1} = $${itemCost}`)
              }
            } else {
              console.log(`      ⚠️ No matching stock length rule for ${requiredLength}"`)
            }
          } else if (masterPart.cost && masterPart.cost > 0) {
            itemCost = masterPart.cost * (bom.quantity || 1)
            console.log(`      ✓ Method: MasterPart direct cost`)
            console.log(`      ✓ Calculation: $${masterPart.cost} × ${bom.quantity || 1} = $${itemCost}`)
          }
        } else {
          console.log(`    ⚠️ MasterPart not found for part number: ${bom.partNumber}`)
        }
      } else {
        console.log(`    ⚠️ No pricing method available`)
      }

      panelCost += itemCost
      console.log(`    Item Cost: $${itemCost.toFixed(2)}`)
    }

    totalCalculatedCost += panelCost
    console.log(`  Panel Total: $${panelCost.toFixed(2)}\n`)
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`Database Price: $${opening.price.toFixed(2)}`)
  console.log(`Calculated Price: $${totalCalculatedCost.toFixed(2)}`)
  console.log(`Difference: $${Math.abs(opening.price - totalCalculatedCost).toFixed(2)}`)

  if (Math.abs(opening.price - totalCalculatedCost) > 0.01) {
    console.log(`\n⚠️ PRICING MISMATCH DETECTED!`)
  } else {
    console.log(`\n✓ Prices match!`)
  }

  await prisma.$disconnect()
}

testPricingCalculation()

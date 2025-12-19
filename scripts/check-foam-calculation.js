const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Same formula evaluation function as in BOM route
function evaluateFormula(formula, variables) {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0;
  try {
    let expression = formula.trim();
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp('\\b' + key + '\\b', 'gi');
      expression = expression.replace(regex, value.toString());
    }
    if (!expression || expression.trim() === '') return 0;
    const result = eval(expression);
    return isNaN(result) ? 0 : Math.max(0, result);
  } catch (error) {
    console.error('Formula evaluation error:', formula, error);
    return 0;
  }
}

async function main() {
  // Panel dimensions from Foam Test project
  const width = 36;
  const height = 96;
  const variables = { width, height, Width: width, Height: height };

  // Get FOAM ROLL ProductBOM entries for ThinWall - Active Door (productId: 7)
  const foamBoms = await prisma.productBOM.findMany({
    where: {
      productId: 7,
      partNumber: 'FOAM ROLL'
    }
  });

  console.log('=== FOAM ROLL BOMs for ThinWall - Active Door ===');
  console.log('Panel dimensions: width =', width, ', height =', height);
  let totalLinearFeet = 0;

  for (const bom of foamBoms) {
    const calculatedLength = evaluateFormula(bom.formula, variables);
    const totalForThisBom = calculatedLength * (bom.quantity || 1);
    totalLinearFeet += totalForThisBom;

    console.log('\nBOM Entry id:', bom.id);
    console.log('  Formula:', bom.formula);
    console.log('  Quantity:', bom.quantity);
    console.log('  Unit:', bom.unit);
    console.log('  Calculated length from formula:', calculatedLength);
    console.log('  Total for this entry (length × quantity):', totalForThisBom, 'LF');
  }

  console.log('\n=== TOTAL EXPECTED LINEAR FEET ===');
  console.log(totalLinearFeet, 'LF (in inches)');

  // Convert to feet if needed (formulas give inches)
  console.log('\n(If output needs to be in actual feet:)');
  console.log(totalLinearFeet / 12, 'FT');
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from '../src/lib/prisma'

async function main() {
  const planViews = await prisma.productPlanView.findMany({
    include: {
      product: {
        select: {
          name: true,
          productType: true
        }
      }
    }
  })
  
  console.log('Plan Views:')
  for (const pv of planViews) {
    console.log(`  ${pv.product.productType}: ${pv.product.name} - "${pv.name}" - orientation: ${pv.orientation}`)
  }
}

main().finally(() => prisma.$disconnect())

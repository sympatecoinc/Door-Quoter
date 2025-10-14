import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const cornerProducts = await prisma.product.findMany({
    where: {
      productType: 'CORNER_90'
    }
  })

  console.log('Corner products found:', cornerProducts.length)
  cornerProducts.forEach(product => {
    console.log(`- ID: ${product.id}, Name: "${product.name}", Type: ${product.productType}`)
  })
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })

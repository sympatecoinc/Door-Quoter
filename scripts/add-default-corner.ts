import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating default 90° Corner product...')

  // Check if a corner product already exists
  const existingCorner = await prisma.product.findFirst({
    where: {
      productType: 'CORNER_90'
    }
  })

  if (existingCorner) {
    console.log('✓ A 90° Corner product already exists:', existingCorner.name)
    return
  }

  // Create default corner product
  const corner = await prisma.product.create({
    data: {
      name: '90° Corner',
      description: 'Standard 90-degree corner for directional transitions',
      type: 'Product',
      productType: 'CORNER_90',
      withTrim: 'Without Trim',
      archived: false
    }
  })

  console.log('✓ Created default 90° Corner product:', corner.name)
  console.log('  ID:', corner.id)
  console.log('  Type:', corner.productType)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

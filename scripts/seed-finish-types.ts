import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedFinishTypes() {
  console.log('Seeding finish types...')

  const finishTypes = [
    { finishType: 'Powder Coated', costPerFoot: 2.50, isActive: true },
    { finishType: 'Anodized', costPerFoot: 1.75, isActive: true },
  ]

  for (const finish of finishTypes) {
    const existing = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType: finish.finishType }
    })

    if (existing) {
      console.log(`- ${finish.finishType} already exists, skipping`)
    } else {
      await prisma.extrusionFinishPricing.create({
        data: finish
      })
      console.log(`✓ Created ${finish.finishType} at $${finish.costPerFoot}/ft`)
    }
  }

  console.log('Done!')
}

seedFinishTypes()
  .catch((error) => {
    console.error('Error seeding finish types:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

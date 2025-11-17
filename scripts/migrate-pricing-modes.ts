import { PrismaClient } from '@prisma/client'
import { getDefaultPricingMode } from '../src/lib/pricing-mode'

const prisma = new PrismaClient()

async function migratePricingModes() {
  console.log('🔍 Checking for projects without pricing modes...')

  // Find projects without pricing mode
  const projectsWithoutMode = await prisma.project.findMany({
    where: { pricingModeId: null },
    select: { id: true, name: true }
  })

  console.log(`Found ${projectsWithoutMode.length} projects without pricing mode`)

  if (projectsWithoutMode.length === 0) {
    console.log('✅ All projects already have pricing modes!')
    return
  }

  // Get default pricing mode
  const defaultMode = await getDefaultPricingMode(prisma)
  console.log(`📋 Using default pricing mode: ${defaultMode.name} (ID: ${defaultMode.id})`)

  // Update all projects
  const result = await prisma.project.updateMany({
    where: { pricingModeId: null },
    data: { pricingModeId: defaultMode.id }
  })

  console.log(`✅ Updated ${result.count} projects with default pricing mode`)

  // Verify
  const remaining = await prisma.project.count({
    where: { pricingModeId: null }
  })

  if (remaining === 0) {
    console.log('✅ Migration complete! All projects now have pricing modes.')
  } else {
    console.log(`⚠️  Warning: ${remaining} projects still without pricing mode`)
  }
}

migratePricingModes()
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

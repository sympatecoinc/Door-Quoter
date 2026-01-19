/**
 * Script to update all panels with glassType "Clear" to use the first actual glass type from the database
 *
 * Usage: npx ts-node scripts/fix-glass-types.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Fetching glass types from database...')

  // Get all glass types
  const glassTypes = await prisma.glassType.findMany({
    orderBy: { name: 'asc' }
  })

  if (glassTypes.length === 0) {
    console.error('ERROR: No glass types found in database!')
    console.log('Please add glass types in Master Parts → Glass tab first.')
    process.exit(1)
  }

  console.log(`Found ${glassTypes.length} glass types:`)
  glassTypes.forEach((gt, i) => {
    console.log(`  ${i + 1}. ${gt.name} ($${gt.pricePerSqFt}/sqft)`)
  })

  const defaultGlassType = glassTypes[0]
  console.log(`\nDefault glass type will be: "${defaultGlassType.name}"`)

  // Find all panels with "Clear" glass type
  const panelsWithClear = await prisma.panel.findMany({
    where: { glassType: 'Clear' },
    include: {
      opening: {
        select: { name: true, projectId: true }
      }
    }
  })

  console.log(`\nFound ${panelsWithClear.length} panels with glassType "Clear"`)

  if (panelsWithClear.length === 0) {
    console.log('Nothing to update!')
    process.exit(0)
  }

  // Show affected panels
  console.log('\nPanels to be updated:')
  const projectIds = new Set<number>()
  panelsWithClear.forEach(panel => {
    projectIds.add(panel.opening.projectId)
    console.log(`  - Panel ${panel.id} in opening "${panel.opening.name}" (Project ${panel.opening.projectId})`)
  })

  console.log(`\nThis will affect ${projectIds.size} project(s)`)

  // Update all panels
  console.log(`\nUpdating panels to use "${defaultGlassType.name}"...`)

  const result = await prisma.panel.updateMany({
    where: { glassType: 'Clear' },
    data: { glassType: defaultGlassType.name }
  })

  console.log(`\n✓ Successfully updated ${result.count} panels`)
  console.log(`  Glass type changed from "Clear" to "${defaultGlassType.name}"`)
}

main()
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

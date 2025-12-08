/**
 * Script to backfill svgOriginId for existing SubOptionCategories
 *
 * Usage: npx ts-node scripts/backfill-svg-origin-ids.ts
 * Or: npm run backfill:svg-origin-ids
 */

import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Backfilling svgOriginId for existing categories ===\n')

  // Find all categories without svgOriginId
  const categoriesWithoutOriginId = await prisma.subOptionCategory.findMany({
    where: {
      svgOriginId: null
    }
  })

  console.log(`Found ${categoriesWithoutOriginId.length} categories without svgOriginId\n`)

  if (categoriesWithoutOriginId.length === 0) {
    console.log('Nothing to update!')
    return
  }

  // Update each category with a unique svgOriginId
  for (const category of categoriesWithoutOriginId) {
    const svgOriginId = `origin-${nanoid(8)}`

    await prisma.subOptionCategory.update({
      where: { id: category.id },
      data: { svgOriginId }
    })

    console.log(`✓ Category "${category.name}" (ID: ${category.id}) → ${svgOriginId}`)
  }

  console.log(`\n=== Done! Updated ${categoriesWithoutOriginId.length} categories ===`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

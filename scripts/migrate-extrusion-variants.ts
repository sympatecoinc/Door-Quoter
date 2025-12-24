/**
 * Migration Script: Create ExtrusionVariant records from existing data
 *
 * This script creates extrusion variants for each extrusion MasterPart,
 * combining stock lengths from StockLengthRules with all active finishes.
 *
 * Run with: npx ts-node scripts/migrate-extrusion-variants.ts
 * Or: npx tsx scripts/migrate-extrusion-variants.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateExtrusionVariants() {
  console.log('Starting extrusion variant migration...\n')

  // Get all extrusion MasterParts with their stock length rules
  const extrusions = await prisma.masterPart.findMany({
    where: { partType: 'Extrusion' },
    include: {
      stockLengthRules: {
        where: { isActive: true }
      }
    }
  })

  console.log(`Found ${extrusions.length} extrusion profiles\n`)

  // Get all active finishes
  const finishes = await prisma.extrusionFinishPricing.findMany({
    where: { isActive: true }
  })

  console.log(`Found ${finishes.length} active finishes:`)
  finishes.forEach(f => console.log(`  - ${f.finishType} (${f.finishCode || 'no code'})`))
  console.log('')

  // Finish options: null (Mill) + all active finishes
  const finishIds: (number | null)[] = [null, ...finishes.map(f => f.id)]

  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const extrusion of extrusions) {
    console.log(`Processing ${extrusion.partNumber} - ${extrusion.baseName}...`)

    // Get unique stock lengths from rules
    const stockLengths = [...new Set(
      extrusion.stockLengthRules
        .map(r => r.stockLength)
        .filter((l): l is number => l !== null)
    )].sort((a, b) => a - b)

    if (stockLengths.length === 0) {
      console.log(`  No stock lengths defined, skipping`)
      continue
    }

    console.log(`  Stock lengths: ${stockLengths.map(l => `${l / 12}ft`).join(', ')}`)

    for (const stockLength of stockLengths) {
      for (const finishId of finishIds) {
        try {
          // Check if variant already exists
          // Note: Prisma's compound unique doesn't work well with null, so use findFirst
          const existing = await prisma.extrusionVariant.findFirst({
            where: {
              masterPartId: extrusion.id,
              stockLength,
              finishPricingId: finishId
            }
          })

          if (existing) {
            skippedCount++
            continue
          }

          // Create the variant
          await prisma.extrusionVariant.create({
            data: {
              masterPartId: extrusion.id,
              stockLength,
              finishPricingId: finishId,
              qtyOnHand: 0,
              binLocation: extrusion.binLocation, // Copy from parent
              reorderPoint: extrusion.reorderPoint,
              reorderQty: extrusion.reorderQty
            }
          })

          createdCount++
        } catch (error) {
          console.log(`  Error creating variant for ${stockLength}" ${finishId ?? 'Mill'}: ${error}`)
          errorCount++
        }
      }
    }
  }

  console.log('\n--- Migration Complete ---')
  console.log(`Created: ${createdCount} variants`)
  console.log(`Skipped (already exist): ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
}

migrateExtrusionVariants()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

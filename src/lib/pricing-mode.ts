import { PrismaClient, PricingMode } from '@prisma/client'

/**
 * Get the default pricing mode, creating one if none exists.
 *
 * Logic:
 * 1. Query for pricing mode with isDefault: true
 * 2. If found, return it
 * 3. If not found, check if any pricing modes exist
 * 4. If none exist, create default pricing mode with 0% markup
 * 5. If pricing modes exist but none are default, set first one as default
 * 6. Return the default pricing mode
 *
 * @param prisma - PrismaClient instance
 * @returns Promise<PricingMode> - The default pricing mode
 */
export async function getDefaultPricingMode(prisma: PrismaClient): Promise<PricingMode> {
  // Try to find existing default pricing mode
  let defaultMode = await prisma.pricingMode.findFirst({
    where: { isDefault: true }
  })

  if (defaultMode) {
    return defaultMode
  }

  // No default found - check if any pricing modes exist
  const existingModes = await prisma.pricingMode.findMany({
    orderBy: { id: 'asc' }
  })

  if (existingModes.length === 0) {
    // No pricing modes exist - create a default one
    defaultMode = await prisma.pricingMode.create({
      data: {
        name: 'Default',
        description: 'Default pricing mode (no markup)',
        isDefault: true,
        markup: 0,
        extrusionMarkup: 0,
        hardwareMarkup: 0,
        glassMarkup: 0,
        discount: 0
      }
    })
    return defaultMode
  }

  // Pricing modes exist but none are default - set first one as default
  defaultMode = await prisma.pricingMode.update({
    where: { id: existingModes[0].id },
    data: { isDefault: true }
  })

  return defaultMode
}

/**
 * Ensure a project has a pricing mode, applying default if null/undefined.
 *
 * Logic:
 * - If pricingModeId is provided and not null, return it as-is
 * - If pricingModeId is null or undefined, get/create default and return its ID
 *
 * @param pricingModeId - The pricing mode ID (may be null, undefined, or a number)
 * @param prisma - PrismaClient instance
 * @returns Promise<number> - The final pricing mode ID to use
 */
export async function ensureProjectPricingMode(
  pricingModeId: number | null | undefined,
  prisma: PrismaClient
): Promise<number> {
  // If a pricing mode ID was explicitly provided, use it
  if (pricingModeId !== null && pricingModeId !== undefined) {
    return pricingModeId
  }

  // No pricing mode provided - get or create default
  const defaultMode = await getDefaultPricingMode(prisma)
  return defaultMode.id
}

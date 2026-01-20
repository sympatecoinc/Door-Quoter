import { prisma } from '@/lib/prisma'

// Product types that are eligible for setting opening tolerances
export const TOLERANCE_ELIGIBLE_TYPES = ['SWING_DOOR', 'SLIDING_DOOR', 'FIXED_PANEL']

/**
 * Check if a product type is eligible for setting opening tolerances
 */
export function isToleranceEligible(productType: string): boolean {
  return TOLERANCE_ELIGIBLE_TYPES.includes(productType)
}

/**
 * Calculate and apply tolerances to an opening from a product
 * Returns the new tolerance values and product ID, or null if no change needed
 * Tolerances are now applied at the product level only - no global defaults
 */
export async function calculateProductTolerances(
  opening: {
    id: number
    roughWidth: number | null
    roughHeight: number | null
    openingType: string | null
    isFinishedOpening: boolean
    toleranceProductId: number | null
    widthToleranceTotal: number | null
    heightToleranceTotal: number | null
  },
  product: {
    id: number
    productType: string
    widthTolerance: number | null
    heightTolerance: number | null
  }
): Promise<{
  widthToleranceTotal: number
  heightToleranceTotal: number
  toleranceProductId: number
  finishedWidth: number | null
  finishedHeight: number | null
} | null> {
  // Only apply for finished openings
  if (!opening.isFinishedOpening) {
    return null
  }

  // Only tolerance-eligible products can set tolerances
  if (!isToleranceEligible(product.productType)) {
    return null
  }

  // If opening already has a tolerance product, don't override (first-product-wins)
  if (opening.toleranceProductId !== null) {
    return null
  }

  // Use product tolerances, defaulting to 0 if not set
  const widthTolerance = product.widthTolerance ?? 0
  const heightTolerance = product.heightTolerance ?? 0

  const finishedWidth = opening.roughWidth !== null
    ? opening.roughWidth - widthTolerance
    : null
  const finishedHeight = opening.roughHeight !== null
    ? opening.roughHeight - heightTolerance
    : null

  return {
    widthToleranceTotal: widthTolerance,
    heightToleranceTotal: heightTolerance,
    toleranceProductId: product.id,
    finishedWidth,
    finishedHeight
  }
}

/**
 * Recalculate tolerances after a product is removed from an opening
 * Finds the next eligible product or uses 0 tolerances if none remain
 */
export async function recalculateTolerancesAfterDeletion(
  openingId: number
): Promise<{
  widthToleranceTotal: number
  heightToleranceTotal: number
  toleranceProductId: number | null
  finishedWidth: number | null
  finishedHeight: number | null
} | null> {
  // Get the opening with its panels and component instances
  const opening = await prisma.opening.findUnique({
    where: { id: openingId },
    include: {
      panels: {
        include: {
          componentInstance: {
            include: {
              product: true
            }
          }
        }
      }
    }
  })

  if (!opening || !opening.isFinishedOpening) {
    return null
  }

  // Find the first remaining tolerance-eligible product
  let nextToleranceProduct: { id: number; widthTolerance: number | null; heightTolerance: number | null } | null = null

  for (const panel of opening.panels) {
    if (panel.componentInstance?.product) {
      const product = panel.componentInstance.product
      if (isToleranceEligible(product.productType)) {
        // Found an eligible product
        nextToleranceProduct = {
          id: product.id,
          widthTolerance: product.widthTolerance,
          heightTolerance: product.heightTolerance
        }
        break
      }
    }
  }

  // Calculate new tolerances
  let widthTolerance: number
  let heightTolerance: number
  let toleranceProductId: number | null = null

  if (nextToleranceProduct) {
    toleranceProductId = nextToleranceProduct.id
    // Use product tolerances, defaulting to 0 if not set
    widthTolerance = nextToleranceProduct.widthTolerance ?? 0
    heightTolerance = nextToleranceProduct.heightTolerance ?? 0
  } else {
    // No eligible products remain, use 0 tolerances
    widthTolerance = 0
    heightTolerance = 0
  }

  const finishedWidth = opening.roughWidth !== null
    ? opening.roughWidth - widthTolerance
    : null
  const finishedHeight = opening.roughHeight !== null
    ? opening.roughHeight - heightTolerance
    : null

  return {
    widthToleranceTotal: widthTolerance,
    heightToleranceTotal: heightTolerance,
    toleranceProductId,
    finishedWidth,
    finishedHeight
  }
}

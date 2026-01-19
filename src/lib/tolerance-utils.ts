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
 * Get global tolerance defaults from ToleranceSettings
 */
export async function getGlobalToleranceDefaults(): Promise<{
  thinwallWidthTolerance: number
  thinwallHeightTolerance: number
  framedWidthTolerance: number
  framedHeightTolerance: number
}> {
  const settings = await prisma.toleranceSettings.findFirst({
    where: { name: 'default' }
  })

  return {
    thinwallWidthTolerance: settings?.thinwallWidthTolerance ?? 1.0,
    thinwallHeightTolerance: settings?.thinwallHeightTolerance ?? 1.5,
    framedWidthTolerance: settings?.framedWidthTolerance ?? 0.5,
    framedHeightTolerance: settings?.framedHeightTolerance ?? 0.75
  }
}

/**
 * Get tolerances for an opening type from global defaults
 */
export async function getDefaultTolerances(openingType: string | null): Promise<{
  widthTolerance: number
  heightTolerance: number
}> {
  const defaults = await getGlobalToleranceDefaults()

  if (openingType === 'FRAMED') {
    return {
      widthTolerance: defaults.framedWidthTolerance,
      heightTolerance: defaults.framedHeightTolerance
    }
  }

  // Default to THINWALL tolerances
  return {
    widthTolerance: defaults.thinwallWidthTolerance,
    heightTolerance: defaults.thinwallHeightTolerance
  }
}

/**
 * Calculate and apply tolerances to an opening from a product
 * Returns the new tolerance values and product ID, or null if no change needed
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

  // If product has custom tolerances, use them; otherwise use opening type defaults
  let widthTolerance: number
  let heightTolerance: number

  if (product.widthTolerance !== null && product.heightTolerance !== null) {
    widthTolerance = product.widthTolerance
    heightTolerance = product.heightTolerance
  } else if (product.widthTolerance !== null || product.heightTolerance !== null) {
    // If only one is set, get defaults for the other
    const defaults = await getDefaultTolerances(opening.openingType)
    widthTolerance = product.widthTolerance ?? defaults.widthTolerance
    heightTolerance = product.heightTolerance ?? defaults.heightTolerance
  } else {
    // Product has no custom tolerances, use defaults (but still claim the tolerance slot)
    const defaults = await getDefaultTolerances(opening.openingType)
    widthTolerance = defaults.widthTolerance
    heightTolerance = defaults.heightTolerance
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
    toleranceProductId: product.id,
    finishedWidth,
    finishedHeight
  }
}

/**
 * Recalculate tolerances after a product is removed from an opening
 * Finds the next eligible product or reverts to defaults
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

  // Find the first remaining tolerance-eligible product with custom tolerances
  let nextToleranceProduct: { id: number; widthTolerance: number | null; heightTolerance: number | null } | null = null

  for (const panel of opening.panels) {
    if (panel.componentInstance?.product) {
      const product = panel.componentInstance.product
      if (isToleranceEligible(product.productType)) {
        // Found an eligible product - use it even if it has no custom tolerances
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
    if (nextToleranceProduct.widthTolerance !== null && nextToleranceProduct.heightTolerance !== null) {
      widthTolerance = nextToleranceProduct.widthTolerance
      heightTolerance = nextToleranceProduct.heightTolerance
    } else {
      const defaults = await getDefaultTolerances(opening.openingType)
      widthTolerance = nextToleranceProduct.widthTolerance ?? defaults.widthTolerance
      heightTolerance = nextToleranceProduct.heightTolerance ?? defaults.heightTolerance
    }
  } else {
    // No eligible products remain, use opening type defaults
    const defaults = await getDefaultTolerances(opening.openingType)
    widthTolerance = defaults.widthTolerance
    heightTolerance = defaults.heightTolerance
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

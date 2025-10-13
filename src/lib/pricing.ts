// Pricing utility functions for applying category-specific markups

export interface PricingMode {
  markup: number
  extrusionMarkup: number
  hardwareMarkup: number
  glassMarkup: number
  discount: number
}

export interface CostBreakdown {
  extrusion: number
  hardware: number
  glass: number
  other: number
}

/**
 * Calculate price with category-specific markup for a single component type
 */
export function calculateMarkupPrice(
  baseCost: number,
  partType: 'Extrusion' | 'Hardware' | 'Glass' | 'Other',
  pricingMode: PricingMode | null
): number {
  if (!pricingMode) return baseCost

  // Determine which markup to apply based on part type
  let categoryMarkup = 0

  if (partType === 'Extrusion' && pricingMode.extrusionMarkup > 0) {
    categoryMarkup = pricingMode.extrusionMarkup
  } else if (partType === 'Hardware' && pricingMode.hardwareMarkup > 0) {
    categoryMarkup = pricingMode.hardwareMarkup
  } else if (partType === 'Glass' && pricingMode.glassMarkup > 0) {
    categoryMarkup = pricingMode.glassMarkup
  } else if (pricingMode.markup > 0) {
    // Fallback to global markup if category-specific markup is not set
    categoryMarkup = pricingMode.markup
  }

  // Apply category markup
  let price = baseCost * (1 + categoryMarkup / 100)

  // Apply discount if set
  if (pricingMode.discount > 0) {
    price *= (1 - pricingMode.discount / 100)
  }

  return price
}

/**
 * Calculate total marked-up price from a cost breakdown
 */
export function calculateTotalMarkedUpPrice(
  costBreakdown: CostBreakdown,
  pricingMode: PricingMode | null
): number {
  const markedUpExtrusion = calculateMarkupPrice(costBreakdown.extrusion, 'Extrusion', pricingMode)
  const markedUpHardware = calculateMarkupPrice(costBreakdown.hardware, 'Hardware', pricingMode)
  const markedUpGlass = calculateMarkupPrice(costBreakdown.glass, 'Glass', pricingMode)
  const markedUpOther = calculateMarkupPrice(costBreakdown.other, 'Other', pricingMode)

  return markedUpExtrusion + markedUpHardware + markedUpGlass + markedUpOther
}

/**
 * Estimate cost breakdown by part type based on BOM counts
 * This is an approximation used when detailed cost data is not available
 */
export function estimateCostBreakdown(
  totalCost: number,
  bomCounts: { Extrusion: number; Hardware: number; Glass: number; Other: number },
  hardwareOptionsCost: number = 0
): CostBreakdown {
  const totalBOMCount = bomCounts.Extrusion + bomCounts.Hardware + bomCounts.Glass + bomCounts.Other
  const remainingCost = totalCost - hardwareOptionsCost

  let breakdown: CostBreakdown = {
    extrusion: 0,
    hardware: hardwareOptionsCost,
    glass: 0,
    other: 0
  }

  if (totalBOMCount > 0 && remainingCost > 0) {
    breakdown.extrusion = (remainingCost * bomCounts.Extrusion) / totalBOMCount
    breakdown.hardware += (remainingCost * bomCounts.Hardware) / totalBOMCount
    breakdown.glass = (remainingCost * bomCounts.Glass) / totalBOMCount
    breakdown.other = (remainingCost * bomCounts.Other) / totalBOMCount
  }

  return breakdown
}

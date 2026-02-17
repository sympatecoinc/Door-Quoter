/**
 * Component Size Validation Utility
 *
 * Validates component dimensions against opening constraints and product min/max
 * size constraints. Applies to any opening with dimensions (finished or rough).
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ProductSizeConstraints {
  minWidth?: number | null
  maxWidth?: number | null
  minHeight?: number | null
  maxHeight?: number | null
}

export interface OpeningConstraints {
  finishedWidth: number
  finishedHeight: number
  existingPanelWidths: number[] // Widths of other panels in the opening (exclude current panel when editing)
  overlap?: number // Sliding door panel overlap allowance in inches (allows total width to exceed opening by this amount)
}

export interface AutoSizeResult {
  width: number | null
  height: number | null
  error: string | null
}

/**
 * Validates component dimensions against opening and product constraints.
 * Applies to any opening with constraint dimensions (finishedWidth/Height or roughWidth/Height).
 *
 * @param width - Component width to validate
 * @param height - Component height to validate
 * @param opening - Opening constraints (constraint dimensions and existing panel widths)
 * @param product - Product size constraints (min/max width/height)
 * @returns ValidationResult with valid flag, errors, and warnings
 */
export function validateComponentSize(
  width: number,
  height: number,
  opening: OpeningConstraints,
  product: ProductSizeConstraints
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate height against finished opening height
  if (height > opening.finishedHeight) {
    errors.push(
      `Component height (${height}") exceeds opening finished height (${opening.finishedHeight}")`
    )
  }

  // Calculate total width including this component
  const otherPanelsTotalWidth = opening.existingPanelWidths.reduce((sum, w) => sum + w, 0)
  const totalWidth = otherPanelsTotalWidth + width
  const overlapAllowance = opening.overlap || 0
  const effectiveWidth = opening.finishedWidth + overlapAllowance

  // Validate total width against finished opening width (plus overlap allowance)
  if (totalWidth > effectiveWidth) {
    const available = effectiveWidth - otherPanelsTotalWidth
    errors.push(
      `Total component width (${totalWidth.toFixed(3)}") exceeds opening allowed width (${effectiveWidth}"). ` +
      `Available space: ${available.toFixed(3)}"`
    )
  }

  // Validate against product min/max constraints
  if (product.minWidth !== null && product.minWidth !== undefined && width < product.minWidth) {
    errors.push(
      `Width (${width}") is below product minimum (${product.minWidth}")`
    )
  }

  if (product.maxWidth !== null && product.maxWidth !== undefined && width > product.maxWidth) {
    errors.push(
      `Width (${width}") exceeds product maximum (${product.maxWidth}")`
    )
  }

  if (product.minHeight !== null && product.minHeight !== undefined && height < product.minHeight) {
    errors.push(
      `Height (${height}") is below product minimum (${product.minHeight}")`
    )
  }

  if (product.maxHeight !== null && product.maxHeight !== undefined && height > product.maxHeight) {
    errors.push(
      `Height (${height}") exceeds product maximum (${product.maxHeight}")`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Calculates auto-size dimensions based on remaining space in opening.
 * Respects product min/max constraints.
 *
 * @param opening - Opening constraints (finished dimensions and existing panel widths)
 * @param product - Product size constraints (min/max width/height)
 * @returns AutoSizeResult with calculated width/height or error message
 */
export function calculateAutoSize(
  opening: OpeningConstraints,
  product: ProductSizeConstraints
): AutoSizeResult {
  // Calculate available width (including overlap allowance for sliding doors)
  const usedWidth = opening.existingPanelWidths.reduce((sum, w) => sum + w, 0)
  const overlapAllowance = opening.overlap || 0
  let availableWidth = opening.finishedWidth + overlapAllowance - usedWidth

  // Height is always the full finished height (initially)
  let finalHeight = opening.finishedHeight

  // Check if available width is positive
  if (availableWidth <= 0) {
    return {
      width: null,
      height: null,
      error: `No space available - existing components already use ${usedWidth.toFixed(3)}" of ${(opening.finishedWidth + overlapAllowance).toFixed(3)}" allowed width`
    }
  }

  // Apply product min/max constraints to width
  if (product.minWidth !== null && product.minWidth !== undefined) {
    if (availableWidth < product.minWidth) {
      return {
        width: null,
        height: null,
        error: `Available space (${availableWidth.toFixed(3)}") is less than product minimum width (${product.minWidth}")`
      }
    }
  }

  if (product.maxWidth !== null && product.maxWidth !== undefined) {
    if (availableWidth > product.maxWidth) {
      availableWidth = product.maxWidth
    }
  }

  // Apply product min/max constraints to height
  if (product.minHeight !== null && product.minHeight !== undefined) {
    if (finalHeight < product.minHeight) {
      return {
        width: null,
        height: null,
        error: `Opening height (${finalHeight}") is less than product minimum height (${product.minHeight}")`
      }
    }
  }

  if (product.maxHeight !== null && product.maxHeight !== undefined) {
    if (finalHeight > product.maxHeight) {
      finalHeight = product.maxHeight
    }
  }

  return {
    width: availableWidth,
    height: finalHeight,
    error: null
  }
}

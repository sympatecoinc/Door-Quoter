// Shared helper for determining effective opening dimensions
// Handles THINWALL vs FRAMED logic and component-based calculation fallback

interface OpeningInput {
  openingType?: string | null
  roughWidth?: number | null
  roughHeight?: number | null
  finishedWidth?: number | null
  finishedHeight?: number | null
  widthToleranceTotal?: number | null
  heightToleranceTotal?: number | null
  panels?: {
    width: number
    height: number
    componentInstance?: {
      product?: {
        productType?: string | null
        jambThickness?: number | null
      } | null
    } | null
  }[]
}

interface OpeningSize {
  label: 'Finished' | 'Rough'
  displayWidth: number
  displayHeight: number
  isCalculated: boolean
}

interface ToleranceDefaults {
  framedWidthTolerance?: number
  framedHeightTolerance?: number
  thinwallWidthTolerance?: number
  thinwallHeightTolerance?: number
}

// Hardcoded fallback tolerances — only used when opening has no stored tolerance
// AND caller doesn't provide DB-loaded defaults from GlobalSettings
const DEFAULT_FRAMED_WIDTH_TOLERANCE = 0.5
const DEFAULT_FRAMED_HEIGHT_TOLERANCE = 0.75
const DEFAULT_THINWALL_WIDTH_TOLERANCE = 1.0
const DEFAULT_THINWALL_HEIGHT_TOLERANCE = 1.5

/**
 * Returns the effective opening size with correct label for display.
 *
 * Tier 1 — Explicit dimensions on the opening:
 *   THINWALL → finishedWidth/finishedHeight, label "Finished"
 *   FRAMED   → roughWidth/roughHeight, label "Rough"
 *
 * Tier 2 — Calculate from component (panel) dimensions:
 *   Sum non-FRAME panel widths, max non-FRAME panel heights.
 *   THINWALL → that's the finished size, label "Finished"
 *   FRAMED   → add jamb thickness + tolerances to get rough size, label "Rough"
 *
 * Tier 3 — Return null if nothing can be determined.
 */
export function getEffectiveOpeningSize(
  opening: OpeningInput,
  toleranceDefaults?: ToleranceDefaults
): OpeningSize | null {
  const isThinwall = opening.openingType === 'THINWALL'

  // --- Tier 1: Explicit dimensions ---
  if (isThinwall) {
    // Prefer finishedWidth/Height; fall back to roughWidth/Height for backward compat
    // (older openings stored the "finished" value in the rough fields)
    const w = opening.finishedWidth || opening.roughWidth
    const h = opening.finishedHeight || opening.roughHeight
    if (w && h) {
      return {
        label: 'Finished',
        displayWidth: w,
        displayHeight: h,
        isCalculated: false,
      }
    }
  } else {
    // FRAMED or unset — prefer roughWidth/Height
    const w = opening.roughWidth || opening.finishedWidth
    const h = opening.roughHeight || opening.finishedHeight
    if (w && h) {
      return {
        label: 'Rough',
        displayWidth: w,
        displayHeight: h,
        isCalculated: false,
      }
    }
  }

  // --- Tier 2: Calculate from components ---
  const panels = opening.panels ?? []
  const nonFramePanels = panels.filter(
    (p) => p.componentInstance?.product?.productType !== 'FRAME'
  )

  if (nonFramePanels.length === 0) return null

  const totalPanelWidth = nonFramePanels.reduce((sum, p) => sum + p.width, 0)
  const maxPanelHeight = Math.max(...nonFramePanels.map((p) => p.height))

  if (totalPanelWidth <= 0 || maxPanelHeight <= 0) return null

  if (isThinwall) {
    // THINWALL: finished opening = panel dimensions + tolerance
    // (panels are sized to finishedSize - tolerance, so reverse that)
    const widthTol = opening.widthToleranceTotal
      ?? toleranceDefaults?.thinwallWidthTolerance
      ?? DEFAULT_THINWALL_WIDTH_TOLERANCE
    const heightTol = opening.heightToleranceTotal
      ?? toleranceDefaults?.thinwallHeightTolerance
      ?? DEFAULT_THINWALL_HEIGHT_TOLERANCE
    return {
      label: 'Finished',
      displayWidth: totalPanelWidth + widthTol,
      displayHeight: maxPanelHeight + heightTol,
      isCalculated: true,
    }
  }

  // FRAMED: reverse-calculate rough from panel (interior) dimensions
  // Interior → Finished: add 2*jamb (width), add jamb (height)
  // Finished → Rough: add tolerances
  let jambThickness = 0
  for (const p of panels) {
    if (
      p.componentInstance?.product?.productType === 'FRAME' &&
      p.componentInstance.product.jambThickness
    ) {
      jambThickness = p.componentInstance.product.jambThickness
      break
    }
  }

  const widthTol = opening.widthToleranceTotal
    ?? toleranceDefaults?.framedWidthTolerance
    ?? DEFAULT_FRAMED_WIDTH_TOLERANCE
  const heightTol = opening.heightToleranceTotal
    ?? toleranceDefaults?.framedHeightTolerance
    ?? DEFAULT_FRAMED_HEIGHT_TOLERANCE

  const roughWidth = totalPanelWidth + 2 * jambThickness + widthTol
  const roughHeight = maxPanelHeight + jambThickness + heightTol

  return {
    label: 'Rough',
    displayWidth: roughWidth,
    displayHeight: roughHeight,
    isCalculated: true,
  }
}

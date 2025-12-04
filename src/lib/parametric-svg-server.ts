// Server-Side Parametric SVG Processing Engine
// Uses xmldom instead of browser DOMParser for Node.js compatibility

import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

export interface ScalingDimensions {
  width: number
  height: number
}

export interface ComponentScaling {
  original: ScalingDimensions
  target: ScalingDimensions
  scaleX: number
  scaleY: number
}

export interface ElementTransform {
  elementId: string
  elementType: ComponentType
  transform: string
}

export type ComponentType =
  | 'vertical'     // Scales height only (stiles)
  | 'horizontal'   // Scales width only (rails)
  | 'grow'         // Scales both dimensions (glass areas)
  | 'fixed'        // No scaling (hardware, text)
  | 'glassstop'    // Scales with glass opening
  | 'trim'         // Outer trim that spans full width

export type ViewMode = 'elevation' | 'plan'

/**
 * Checks if an element or any of its ancestors has "static" in ID or class
 * Only applies to plan view mode
 */
function isInStaticLayer(element: Element, mode: ViewMode): boolean {
  // Only check for static layers in plan view
  if (mode !== 'plan') return false

  let current: Element | null = element

  while (current) {
    // Check if current node has getAttribute (is an Element, not Document/etc)
    if (typeof current.getAttribute !== 'function') {
      break
    }

    const id = (current.getAttribute('id') || '').toLowerCase()
    const className = (current.getAttribute('class') || '').toLowerCase()

    if (id.includes('static') || className.includes('static')) {
      return true
    }

    // Stop at SVG root
    if (current.tagName === 'svg') {
      break
    }

    // Move up to parent - only if it's an Element
    const parent = current.parentNode
    if (parent && parent.nodeType === 1) { // nodeType 1 = Element
      current = parent as Element
    } else {
      break
    }
  }

  return false
}

/**
 * Detects component type based on element ID/class naming conventions
 */
export function detectComponentType(element: Element, mode?: ViewMode): ComponentType {
  // Check if element is in a static layer first (plan view only)
  if (mode && isInStaticLayer(element, mode)) return 'fixed'

  const id = (element.getAttribute('id') || '').toLowerCase()
  const className = (element.getAttribute('class') || '').toLowerCase()
  const combined = `${id} ${className}`.toLowerCase()

  // Check for static on element itself (plan view only)
  if (mode === 'plan' && combined.includes('static')) return 'fixed'
  // Check for glasstop (both spellings: "glasstop" and "glassstop")
  if (combined.includes('glasstop')) return 'glassstop'
  // Check for trim elements (outer frame that spans full width)
  if (combined.includes('trim')) return 'trim'
  if (combined.includes('vertical') || combined.includes('stile')) return 'vertical'
  if (combined.includes('horizontal') || combined.includes('rail')) return 'horizontal'
  if (combined.includes('grow') || combined.includes('glass-area')) return 'grow'
  if (combined.includes('fixed') || combined.includes('hardware') || combined.includes('text')) return 'fixed'

  return 'grow'
}

/**
 * Calculates scale factors based on original and target dimensions
 */
export function calculateScaleFactors(
  originalDimensions: ScalingDimensions,
  targetDimensions: ScalingDimensions
): ComponentScaling {
  const scaleX = targetDimensions.width / originalDimensions.width
  const scaleY = targetDimensions.height / originalDimensions.height

  return {
    original: originalDimensions,
    target: targetDimensions,
    scaleX,
    scaleY
  }
}

/**
 * Extracts original dimensions from SVG viewBox or width/height attributes
 */
export function extractOriginalDimensions(svgElement: Element): ScalingDimensions {
  // Try viewBox first
  const viewBox = svgElement.getAttribute('viewBox')
  if (viewBox) {
    const values = viewBox.trim().split(/\s+/)
    if (values.length === 4) {
      const width = parseFloat(values[2])
      const height = parseFloat(values[3])
      if (width > 0 && height > 0) {
        return { width, height }
      }
    }
  }

  // Fallback to width/height attributes
  const width = parseFloat(svgElement.getAttribute('width') || '0')
  const height = parseFloat(svgElement.getAttribute('height') || '0')

  if (width > 0 && height > 0) {
    return { width, height }
  }

  // Default fallback
  return { width: 100, height: 100 }
}

/**
 * Applies component-aware scaling transformation to an element
 */
export function scaleElement(
  element: Element,
  componentType: ComponentType,
  scaling: ComponentScaling,
  originalDimensions: ScalingDimensions,
  mode: ViewMode,
  leftStileWidth: number,
  rightStileWidth: number
): ElementTransform {
  const tagName = element.tagName

  // Only process rect elements
  if (tagName === 'rect') {
    const x = parseFloat(element.getAttribute('x') || '0')
    const y = parseFloat(element.getAttribute('y') || '0')
    const width = parseFloat(element.getAttribute('width') || '0')
    const height = parseFloat(element.getAttribute('height') || '0')

    console.log(`Scaling ${element.getAttribute('id')} (${componentType}): x=${x}, y=${y}, w=${width}, h=${height}`)

    // Remove any existing transforms
    if (element.getAttribute('transform')) {
      element.removeAttribute('transform')
    }

    switch (componentType) {
      case 'vertical':
        // Stiles: Keep constant WIDTH, position at edges of SCALED coordinate system
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          // Scale Y position and height to preserve relationship with trims
          const scaledY = y * scaling.scaleY
          const scaledHeight = height * scaling.scaleY

          if (x > origViewBoxWidth * 0.5) {
            // Right stile - position at right edge of SCALED width
            element.setAttribute('x', (targetPixelWidth - rightStileWidth).toString())
            element.setAttribute('y', scaledY.toString())
            element.setAttribute('width', rightStileWidth.toString())
            element.setAttribute('height', scaledHeight.toString())
            console.log(`  → Vertical (RIGHT): x → ${targetPixelWidth - rightStileWidth}, y → ${scaledY}, width → ${rightStileWidth}, height → ${scaledHeight}`)
          } else {
            // Left stile - stays at x=0
            element.setAttribute('x', '0')
            element.setAttribute('y', scaledY.toString())
            element.setAttribute('width', leftStileWidth.toString())
            element.setAttribute('height', scaledHeight.toString())
            console.log(`  → Vertical (LEFT): x=0, y → ${scaledY}, width → ${leftStileWidth}, height → ${scaledHeight}`)
          }
        } else if (mode === 'plan') {
          // Plan view: Scale width with scaleX
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX
          const scaledWidth = width * scaling.scaleX

          if (x > origViewBoxWidth * 0.5) {
            // Right side element
            element.setAttribute('x', (targetPixelWidth - scaledWidth).toString())
            element.setAttribute('width', scaledWidth.toString())
            console.log(`  → Vertical PLAN (RIGHT): x → ${targetPixelWidth - scaledWidth}, width → ${scaledWidth}`)
          } else {
            // Left side element
            element.setAttribute('width', scaledWidth.toString())
            console.log(`  → Vertical PLAN (LEFT): width → ${scaledWidth}`)
          }
        }
        break

      case 'horizontal':
        // Rails: Span between stiles in SCALED coordinate system
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          // Scale Y position and height to fit within scaled viewBox
          const scaledY = y * scaling.scaleY
          const scaledRailHeight = height * scaling.scaleY

          // Rails must span between left and right stiles in SCALED coordinate space
          const newX = leftStileWidth
          const newWidth = targetPixelWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', newX.toString())
          element.setAttribute('y', scaledY.toString())
          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', scaledRailHeight.toString())
          console.log(`  → Horizontal: x → ${newX}, y → ${scaledY}, width → ${newWidth}, height → ${scaledRailHeight}`)
        } else if (mode === 'plan') {
          // Plan view: Scale width with scaleX
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX
          const newWidth = width * scaling.scaleX

          element.setAttribute('width', newWidth.toString())
          console.log(`  → Horizontal PLAN: width → ${newWidth}`)
        }
        break

      case 'grow':
        // Glass area: Fill space between stiles in SCALED coordinate system
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          const newX = leftStileWidth
          const newWidth = targetPixelWidth - leftStileWidth - rightStileWidth

          // Scale Y position and height for elevation views
          const scaledY = y * scaling.scaleY
          const scaledHeight = height * scaling.scaleY

          element.setAttribute('x', newX.toString())
          element.setAttribute('y', scaledY.toString())
          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', scaledHeight.toString())
          console.log(`  → Grow: x → ${newX}, y → ${scaledY}, width → ${newWidth}, height → ${scaledHeight}`)
        } else if (mode === 'plan') {
          // Plan view: Scale both dimensions
          const newWidth = width * scaling.scaleX
          const newHeight = height * scaling.scaleY

          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', newHeight.toString())
          console.log(`  → Grow PLAN: width → ${newWidth}, height → ${newHeight}`)
        }
        break

      case 'glassstop':
        // Glass stops logic - position in SCALED coordinate system
        const isHorizontalGS = element.getAttribute('id')?.includes('horizontal') || width > height
        const isVerticalGS = element.getAttribute('id')?.includes('vertical') || height > width

        if (mode === 'elevation') {
          if (isVerticalGS) {
            const origViewBoxWidth = originalDimensions.width
            const targetPixelWidth = origViewBoxWidth * scaling.scaleX

            // Vertical glassstops are thin strips at the inner edge of stiles
            // Keep their original width (typically 3-4 pixels)
            const glassStopWidth = width

            // Scale Y position and height for elevation views
            const glassStopY = y * scaling.scaleY
            const glassStopHeight = height * scaling.scaleY

            if (x > origViewBoxWidth * 0.5) {
              // Right-side glassstop - position in glass area, ending at inner edge of right stile
              const newX = targetPixelWidth - rightStileWidth - glassStopWidth

              element.setAttribute('x', newX.toString())
              element.setAttribute('y', glassStopY.toString())
              element.setAttribute('width', glassStopWidth.toString())
              element.setAttribute('height', glassStopHeight.toString())
              console.log(`  → Glassstop-V (RIGHT): x → ${newX}, y → ${glassStopY}, width → ${glassStopWidth}, height → ${glassStopHeight}`)
            } else {
              // Left-side glassstop - position in glass area, starting at inner edge of left stile
              const newX = leftStileWidth

              element.setAttribute('x', newX.toString())
              element.setAttribute('y', glassStopY.toString())
              element.setAttribute('width', glassStopWidth.toString())
              element.setAttribute('height', glassStopHeight.toString())
              console.log(`  → Glassstop-V (LEFT): x → ${newX}, y → ${glassStopY}, width → ${glassStopWidth}, height → ${glassStopHeight}`)
            }
          } else if (isHorizontalGS) {
            const origViewBoxWidth = originalDimensions.width
            const targetPixelWidth = origViewBoxWidth * scaling.scaleX
            const newWidthGS = targetPixelWidth - leftStileWidth - rightStileWidth

            // Scale Y position and height for elevation views
            const scaledY = y * scaling.scaleY
            const scaledGlassStopHeight = height * scaling.scaleY

            element.setAttribute('x', leftStileWidth.toString())
            element.setAttribute('y', scaledY.toString())
            element.setAttribute('width', newWidthGS.toString())
            element.setAttribute('height', scaledGlassStopHeight.toString())
            console.log(`  → Glassstop-H: x → ${leftStileWidth}, y → ${scaledY}, width → ${newWidthGS}, height → ${scaledGlassStopHeight}`)
          }
        } else if (mode === 'plan') {
          // Plan view: Scale both dimensions
          const glassStopScaleX = Math.max(0.5, scaling.scaleX * 0.9)
          const glassStopScaleY = Math.max(0.5, scaling.scaleY * 0.9)
          const newWidth = width * glassStopScaleX
          const newHeight = height * glassStopScaleY

          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', newHeight.toString())
          console.log(`  → Glassstop PLAN: width → ${newWidth}, height → ${newHeight}`)
        }
        break

      case 'trim':
        // Outer trim elements: span full width, scale y position and height
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX
          const targetPixelHeight = originalDimensions.height * scaling.scaleY

          // Scale Y position and height proportionally
          const scaledY = y * scaling.scaleY
          const scaledHeight = height * scaling.scaleY

          // Trim spans full width (from edge to edge)
          element.setAttribute('x', '0')
          element.setAttribute('y', scaledY.toString())
          element.setAttribute('width', targetPixelWidth.toString())
          element.setAttribute('height', scaledHeight.toString())
          console.log(`  → Trim: x → 0, y → ${scaledY}, width → ${targetPixelWidth}, height → ${scaledHeight}`)
        } else if (mode === 'plan') {
          // Plan view: Scale width to full scaled width
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          element.setAttribute('width', targetPixelWidth.toString())
          console.log(`  → Trim PLAN: width → ${targetPixelWidth}`)
        }
        break

      case 'fixed':
        // Fixed elements: keep size constant, but in plan view translate right-side elements
        if (mode === 'plan') {
          const origViewBoxWidth = originalDimensions.width
          const midpoint = origViewBoxWidth / 2
          const widthDelta = (origViewBoxWidth * scaling.scaleX) - origViewBoxWidth

          if (x > midpoint) {
            // Right-side fixed element - translate to new right edge
            const newX = x + widthDelta
            element.setAttribute('x', newX.toString())
            console.log(`  → Fixed PLAN (RIGHT): x → ${newX} (translated by ${widthDelta})`)
          } else {
            console.log(`  → Fixed PLAN (LEFT): no changes`)
          }
        } else {
          console.log(`  → Fixed: no changes`)
        }
        break
    }
  }

  return {
    elementId: element.getAttribute('id') || 'unnamed',
    elementType: componentType,
    transform: ''
  }
}

/**
 * Plan view specific adjustments (SERVER-SIDE compatible version)
 * Handles groups with semantic IDs/classes for proper scaling behavior
 *
 * Plan View SVG Structure:
 * - left-jamb: Static elements at left edge, no transform
 * - grow: Center elements, scaled horizontally around left edge
 * - mullions: Evenly distributed markers, scaled around center
 * - right-jamb: Static elements at right edge, translated by widthDelta
 */
function adjustPlanViewElements(svgElement: Element, scaling: ComponentScaling, originalDimensions: ScalingDimensions) {
  // Get the original viewBox width for calculating translations
  const origWidth = originalDimensions.width
  const targetWidth = origWidth * scaling.scaleX
  const widthDelta = targetWidth - origWidth
  const midpoint = origWidth / 2

  console.log(`Plan view adjustment: origWidth=${origWidth}, targetWidth=${targetWidth}, widthDelta=${widthDelta}, midpoint=${midpoint}`)

  // Helper function to get the X bounds (min and max) of a group's content
  const getGroupXBounds = (group: Element): { min: number; max: number } => {
    let minX = Infinity
    let maxX = -Infinity

    const processElement = (elem: Element) => {
      if (elem.tagName === 'rect') {
        const x = parseFloat(elem.getAttribute('x') || '0')
        const width = parseFloat(elem.getAttribute('width') || '0')
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x + width)
      }
      if (elem.tagName === 'path') {
        const d = elem.getAttribute('d') || ''
        // Extract all x coordinates from path data (M, L, H commands and coordinate pairs)
        const matches = d.match(/[MLH]\s*([0-9.-]+)|,\s*([0-9.-]+)\s+([0-9.-]+)/g)
        if (matches) {
          matches.forEach(match => {
            const nums = match.match(/[0-9.-]+/g)
            if (nums) {
              nums.forEach(num => {
                const val = parseFloat(num)
                // Sanity check: positive and within reasonable SVG bounds (allow up to 10000 for high-res SVGs)
                if (!isNaN(val) && val > 0 && val < 10000) {
                  minX = Math.min(minX, val)
                  maxX = Math.max(maxX, val)
                }
              })
            }
          })
        }
      }
      // Recurse into child elements
      for (let i = 0; i < elem.childNodes.length; i++) {
        const child = elem.childNodes[i]
        if (child.nodeType === 1) {
          processElement(child as Element)
        }
      }
    }

    for (let i = 0; i < group.childNodes.length; i++) {
      const child = group.childNodes[i]
      if (child.nodeType === 1) {
        processElement(child as Element)
      }
    }

    return {
      min: minX === Infinity ? 0 : minX,
      max: maxX === -Infinity ? origWidth : maxX
    }
  }

  // Helper function to get the left X position of a group's content
  const getGroupXPosition = (group: Element): number => {
    return getGroupXBounds(group).min
  }

  // First pass: Find the grow group and calculate where its right edge will end up
  // This is needed to properly position the right-jamb
  let growScaledRightEdge = origWidth + widthDelta  // Default to far right if no grow group
  let growOriginalRightEdge = origWidth

  const findGrowGroup = (node: Element) => {
    if (node.tagName !== 'g') return
    const id = (node.getAttribute('id') || '').toLowerCase()
    if (id === 'grow') {
      const bounds = getGroupXBounds(node)
      growOriginalRightEdge = bounds.max
      // Calculate where the right edge ends up after scaling from pivot at bounds.min
      const pivotX = bounds.min
      growScaledRightEdge = pivotX + (bounds.max - pivotX) * scaling.scaleX
      console.log(`  Pre-scan: grow group right edge will move from ${bounds.max.toFixed(1)} to ${growScaledRightEdge.toFixed(1)}`)
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) findGrowGroup(child as Element)
    }
  }

  // Run pre-scan to find grow group dimensions
  for (let i = 0; i < svgElement.childNodes.length; i++) {
    const child = svgElement.childNodes[i]
    if (child.nodeType === 1) findGrowGroup(child as Element)
  }

  // Find and process groups with semantic IDs
  const processGroup = (node: Element) => {
    // Skip non-group elements
    if (node.tagName !== 'g') {
      return
    }

    const id = (node.getAttribute('id') || '').toLowerCase()
    const className = (node.getAttribute('class') || '').toLowerCase()

    console.log(`  Processing group: id="${id}", class="${className}"`)

    // Right jamb: translate to maintain connection with scaled grow group
    if (id === 'right-jamb' || className.includes('translate-horizontal')) {
      const bounds = getGroupXBounds(node)

      // Calculate translation to keep right-jamb attached to the scaled grow group
      // The original gap between grow's right edge and right-jamb's left edge should be preserved
      const originalGap = bounds.min - growOriginalRightEdge
      const rightJambTranslation = growScaledRightEdge + originalGap - bounds.min

      const currentTransform = node.getAttribute('transform') || ''
      const translateTransform = `translate(${rightJambTranslation}, 0)`
      const newTransform = currentTransform ?
        `${currentTransform} ${translateTransform}` :
        translateTransform
      node.setAttribute('transform', newTransform)
      console.log(`  → Right jamb: original gap to grow = ${originalGap.toFixed(1)}, translated by ${rightJambTranslation.toFixed(1)}`)
      return // Don't process children
    }

    // Grow group: apply scale transform around the group's left edge
    // This stretches the glass/grow area to fill the new width while keeping static elements fixed
    if (id === 'grow' || className.includes('stretch-horizontal')) {
      const bounds = getGroupXBounds(node)
      console.log(`  ★★★ GROW GROUP FOUND ★★★`)
      console.log(`  → Grow group bounds: ${bounds.min.toFixed(1)} to ${bounds.max.toFixed(1)}`)

      // The grow group should stretch horizontally to fill the new width
      // Use a scale transform around the left edge of the group content
      const pivotX = bounds.min

      // Apply: translate to pivot, scale, translate back
      const currentTransform = node.getAttribute('transform') || ''
      const scaleTransform = `translate(${pivotX}, 0) scale(${scaling.scaleX}, 1) translate(${-pivotX}, 0)`
      const newTransform = currentTransform ?
        `${currentTransform} ${scaleTransform}` :
        scaleTransform
      node.setAttribute('transform', newTransform)

      console.log(`  → Applied scale transform: ${scaleTransform}`)
      console.log(`  → Pivot at x=${pivotX}, scaleX=${scaling.scaleX}`)
      console.log(`  → Right edge moves from ${bounds.max.toFixed(1)} to ${growScaledRightEdge.toFixed(1)}`)
      return // Don't process children
    }

    // Mullions: apply scale transform centered on the SVG midpoint
    // Mullions are evenly distributed across the door, so they scale proportionally
    if (id === 'mullions' || className.includes('reposition-horizontal')) {
      const bounds = getGroupXBounds(node)
      console.log(`  → Mullions bounds: ${bounds.min.toFixed(1)} to ${bounds.max.toFixed(1)}`)

      // Scale mullions around the center of the door width
      // This keeps them evenly distributed as the door expands
      const centerX = origWidth / 2

      const currentTransform = node.getAttribute('transform') || ''
      const scaleTransform = `translate(${centerX}, 0) scale(${scaling.scaleX}, 1) translate(${-centerX}, 0)`
      const newTransform = currentTransform ?
        `${currentTransform} ${scaleTransform}` :
        scaleTransform
      node.setAttribute('transform', newTransform)

      console.log(`  → Applied mullion scale transform: ${scaleTransform}`)
      return // Don't process children
    }

    // Static groups: determine if left or right based on content position
    if (id.includes('static') || className.includes('static') || id === 'left-jamb' || id === 'left-detail') {
      const groupX = getGroupXPosition(node)
      console.log(`  → Static group "${id}" at x=${groupX}`)

      // If this static group is on the right side of the SVG, translate it
      // Use the same translation as the right-jamb to maintain alignment
      if (groupX > midpoint) {
        const originalGap = groupX - growOriginalRightEdge
        const staticTranslation = growScaledRightEdge + originalGap - groupX

        const currentTransform = node.getAttribute('transform') || ''
        const translateTransform = `translate(${staticTranslation}, 0)`
        const newTransform = currentTransform ?
          `${currentTransform} ${translateTransform}` :
          translateTransform
        node.setAttribute('transform', newTransform)
        console.log(`  → RIGHT static group translated by ${staticTranslation.toFixed(1)}`)
      } else {
        console.log(`  → LEFT static group - no transform`)
      }
      return // Don't process children
    }

    // Recurse into child elements
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) { // Element node
        processGroup(child as Element)
      }
    }
  }

  // Start processing from SVG root
  for (let i = 0; i < svgElement.childNodes.length; i++) {
    const child = svgElement.childNodes[i]
    if (child.nodeType === 1) { // Element node
      processGroup(child as Element)
    }
  }
}

/**
 * Processes parametric SVG with intelligent component scaling (SERVER-SIDE)
 */
export function processParametricSVG(
  svgString: string,
  targetDimensions: ScalingDimensions,
  mode: ViewMode = 'elevation'
): { scaledSVG: string; transforms: ElementTransform[]; scaling: ComponentScaling } {
  // Parse SVG string using xmldom
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = svgDoc.documentElement

  if (!svgElement || svgElement.tagName !== 'svg') {
    throw new Error('Invalid SVG: No SVG element found')
  }

  // Extract original dimensions (in pixels from Illustrator)
  const originalDimensions = extractOriginalDimensions(svgElement)

  // For plan views: SVG template is at a standard width (36"), scale uniformly to target width
  // For elevation views: SVG is standard 36" x 96", scale independently
  let actualTargetHeight = targetDimensions.height
  let svgRepresentsWidth = 36  // Standard elevation
  let svgRepresentsHeight = 96
  let scaleX: number
  let scaleY: number

  if (mode === 'plan') {
    // Plan view: WIDTH scales with panel width, DEPTH (height) stays constant
    // SVG viewBox width represents door width (36"), height represents depth (~6")
    svgRepresentsWidth = 36  // Standard template width

    // If target height is provided, use it (in inches), otherwise calculate from SVG
    if (targetDimensions.height > 0) {
      // Height provided in inches
      svgRepresentsHeight = targetDimensions.height
      actualTargetHeight = targetDimensions.height
    } else {
      // Fallback: use original SVG dimensions in pixels
      svgRepresentsHeight = originalDimensions.height
      actualTargetHeight = originalDimensions.height
    }

    // Scale width to match panel
    scaleX = targetDimensions.width / svgRepresentsWidth

    // Depth doesn't scale - all doors have the same frame depth regardless of width
    scaleY = 1

    console.log(`Plan view: width ${svgRepresentsWidth}" → ${targetDimensions.width}" (scale ${scaleX.toFixed(4)}), depth ${actualTargetHeight.toFixed(2)}"`)
  } else {
    // Elevation view: Independent scaling
    scaleX = targetDimensions.width / svgRepresentsWidth
    scaleY = targetDimensions.height / svgRepresentsHeight
    actualTargetHeight = targetDimensions.height
  }

  const scaling: ComponentScaling = {
    original: { width: svgRepresentsWidth, height: svgRepresentsHeight },
    target: { width: targetDimensions.width, height: actualTargetHeight },
    scaleX,
    scaleY
  }

  console.log(`Original SVG dimensions (pixels): ${originalDimensions.width} x ${originalDimensions.height}`)
  console.log(`SVG represents (inches): ${svgRepresentsWidth}" x ${svgRepresentsHeight}"`)
  console.log(`Target dimensions (inches): ${targetDimensions.width}" x ${actualTargetHeight}"`)
  console.log(`Scale factors: X=${scaling.scaleX}, Y=${scaling.scaleY}`)

  // Calculate the target pixel dimensions for rendering
  // This is only used for the final width/height attributes, NOT for viewBox
  const targetPixelWidth = originalDimensions.width * scaling.scaleX
  const targetPixelHeight = originalDimensions.height * scaling.scaleY

  console.log(`Target pixel dimensions: ${targetPixelWidth} x ${targetPixelHeight}`)

  // CRITICAL: Keep viewBox at ORIGINAL dimensions - all element positioning
  // will be done in this coordinate system. The width/height attributes
  // control the final rendered size, and SVG handles the scaling automatically.
  svgElement.setAttribute('viewBox', `0 0 ${originalDimensions.width} ${originalDimensions.height}`)
  svgElement.setAttribute('width', originalDimensions.width.toString())
  svgElement.setAttribute('height', originalDimensions.height.toString())

  // Get all elements with IDs or classes
  const elements: Element[] = []
  const collectElements = (node: Element) => {
    if (node.getAttribute('id') || node.getAttribute('class')) {
      elements.push(node)
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) { // Element node
        collectElements(child as Element)
      }
    }
  }
  collectElements(svgElement)

  // PASS 1: Detect ORIGINAL stile widths
  let leftStileOriginalWidth = 0
  let rightStileOriginalWidth = 0

  elements.forEach(element => {
    if (element.tagName === 'rect') {
      const componentType = detectComponentType(element, mode)
      if (componentType === 'vertical') {
        const x = parseFloat(element.getAttribute('x') || '0')
        const width = parseFloat(element.getAttribute('width') || '0')

        if (x > originalDimensions.width * 0.5) {
          rightStileOriginalWidth = width
        } else {
          leftStileOriginalWidth = width
        }
      }
    }
  })

  // PASS 2: Calculate PRE-SCALED stile widths
  const leftStileWidth = leftStileOriginalWidth * scaling.scaleY
  const rightStileWidth = rightStileOriginalWidth * scaling.scaleY

  console.log(`Original stile widths: left=${leftStileOriginalWidth}, right=${rightStileOriginalWidth}`)
  console.log(`Scaled stile widths: left=${leftStileWidth}, right=${rightStileWidth}`)

  // PASS 3: Process all elements
  const transforms: ElementTransform[] = []

  elements.forEach(element => {
    const componentType = detectComponentType(element, mode)
    const elementTransform = scaleElement(
      element,
      componentType,
      scaling,
      originalDimensions,
      mode,
      leftStileWidth,
      rightStileWidth
    )
    transforms.push(elementTransform)
  })

  // Handle plan view specific adjustments
  if (mode === 'plan') {
    console.log('→ Applying plan view adjustments')
    adjustPlanViewElements(svgElement, scaling, originalDimensions)

    // For plan views with group transforms:
    // The transforms (scale, translate) expand the content beyond original viewBox
    // We need to expand the viewBox to match the new content bounds
    // viewBox expands to targetPixelWidth to show all transformed content
    const finalViewBoxWidth = targetPixelWidth
    const finalViewBoxHeight = originalDimensions.height

    console.log(`Plan view final viewBox: 0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
    console.log(`Plan view final width/height: ${targetPixelWidth} x ${originalDimensions.height}`)

    svgElement.setAttribute('viewBox', `0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
    svgElement.setAttribute('width', targetPixelWidth.toString())
    svgElement.setAttribute('height', originalDimensions.height.toString())
    svgElement.setAttribute('preserveAspectRatio', 'none')
  } else {
    // FINAL STEP: Set viewBox to match the scaled coordinate system
    // Elements are now positioned in scaled pixel space, so viewBox must match
    const finalViewBoxWidth = targetPixelWidth
    const finalViewBoxHeight = targetPixelHeight

    console.log(`Final viewBox: 0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
    console.log(`Final width/height attributes: ${targetPixelWidth} x ${targetPixelHeight}`)

    svgElement.setAttribute('viewBox', `0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
    svgElement.setAttribute('width', targetPixelWidth.toString())
    svgElement.setAttribute('height', targetPixelHeight.toString())
  }

  // Convert back to string
  const serializer = new XMLSerializer()
  const scaledSVG = serializer.serializeToString(svgDoc)

  return {
    scaledSVG,
    transforms,
    scaling
  }
}

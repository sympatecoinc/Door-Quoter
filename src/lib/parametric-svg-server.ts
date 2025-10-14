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
    const id = (current.getAttribute('id') || '').toLowerCase()
    const className = (current.getAttribute('class') || '').toLowerCase()

    if (id.includes('static') || className.includes('static')) {
      return true
    }

    // Move up to parent
    current = current.parentNode as Element | null

    // Stop at SVG root
    if (current && current.tagName === 'svg') {
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
  if (combined.includes('glassstop')) return 'glassstop'
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
          const origViewBoxHeight = originalDimensions.height
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          if (x > origViewBoxWidth * 0.5) {
            // Right stile - position at right edge of SCALED width
            element.setAttribute('x', (targetPixelWidth - rightStileWidth).toString())
            element.setAttribute('y', '0')
            element.setAttribute('width', rightStileWidth.toString())
            element.setAttribute('height', origViewBoxHeight.toString())
            console.log(`  → Vertical (RIGHT): x → ${targetPixelWidth - rightStileWidth} (scaled width ${targetPixelWidth}), width → ${rightStileWidth}`)
          } else {
            // Left stile - stays at x=0
            element.setAttribute('x', '0')
            element.setAttribute('y', '0')
            element.setAttribute('width', leftStileWidth.toString())
            element.setAttribute('height', origViewBoxHeight.toString())
            console.log(`  → Vertical (LEFT): x=0, width → ${leftStileWidth}`)
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
        // Keep original height - rails don't change thickness when door width changes
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const origViewBoxHeight = originalDimensions.height
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          // Keep original rail height - thickness doesn't change with width
          const railHeight = height

          // Keep Y position in ORIGINAL coordinates - don't reposition rails vertically
          // Rails must span between left and right stiles in SCALED coordinate space
          const newX = leftStileWidth
          const newWidth = targetPixelWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', newX.toString())
          element.setAttribute('y', y.toString())  // Keep original Y
          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', railHeight.toString())
          console.log(`  → Horizontal: x → ${newX}, y → ${y} (original), width → ${newWidth}, height → ${railHeight} (original)`)
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

          element.setAttribute('x', newX.toString())
          element.setAttribute('width', newWidth.toString())
          console.log(`  → Grow: x → ${newX}, width → ${newWidth} (glass area scaled)`)
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
            const origViewBoxHeight = originalDimensions.height
            const targetPixelWidth = origViewBoxWidth * scaling.scaleX

            // Vertical glassstops are thin strips at the inner edge of stiles
            // Keep their original width (typically 3-4 pixels)
            const glassStopWidth = width

            // Keep original Y and height - they're in the viewBox coordinate system
            // which stays at original height (610px) even when width scales
            const glassStopY = y
            const glassStopHeight = height

            if (x > origViewBoxWidth * 0.5) {
              // Right-side glassstop - position at inner edge of right stile (left side of stile)
              const newX = targetPixelWidth - rightStileWidth

              element.setAttribute('x', newX.toString())
              element.setAttribute('y', glassStopY.toString())
              element.setAttribute('width', glassStopWidth.toString())
              element.setAttribute('height', glassStopHeight.toString())
              console.log(`  → Glassstop-V (RIGHT): x → ${newX}, y → ${glassStopY}, width → ${glassStopWidth}, height → ${glassStopHeight}`)
            } else {
              // Left-side glassstop - position at inner edge of left stile (right side of stile)
              const newX = leftStileWidth - glassStopWidth

              element.setAttribute('x', newX.toString())
              element.setAttribute('y', glassStopY.toString())
              element.setAttribute('width', glassStopWidth.toString())
              element.setAttribute('height', glassStopHeight.toString())
              console.log(`  → Glassstop-V (LEFT): x → ${newX}, y → ${glassStopY}, width → ${glassStopWidth}, height → ${glassStopHeight}`)
            }
          } else if (isHorizontalGS) {
            const origViewBoxWidth = originalDimensions.width
            const targetPixelWidth = origViewBoxWidth * scaling.scaleX
            const glassStopHeight = height  // Keep original height
            const newWidthGS = targetPixelWidth - leftStileWidth - rightStileWidth

            element.setAttribute('x', leftStileWidth.toString())
            element.setAttribute('y', y.toString())
            element.setAttribute('width', newWidthGS.toString())
            element.setAttribute('height', glassStopHeight.toString())
            console.log(`  → Glassstop-H: x → ${leftStileWidth}, y → ${y}, width → ${newWidthGS}, height → ${glassStopHeight} (original)`)
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

      case 'fixed':
        console.log(`  → Fixed: no changes`)
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
 * Adjusts positioning of right-side elements in plan view
 */
function adjustPlanViewElements(svgElement: Element, scaling: ComponentScaling, originalDimensions: ScalingDimensions) {
  // Move right-side elements to maintain proper positioning
  // Look for elements with id containing "1" or class containing "right"
  const elements: Element[] = []
  const collectElements = (node: Element) => {
    const id = node.getAttribute('id') || ''
    const className = node.getAttribute('class') || ''
    if (id.includes('1') || className.includes('right')) {
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

  elements.forEach(element => {
    if (element.tagName === 'rect') {
      const currentX = parseFloat(element.getAttribute('x') || '0')
      const newX = currentX * scaling.scaleX
      const translateX = newX - currentX

      if (Math.abs(translateX) > 0.1) {
        // Apply position adjustment via transform
        const currentTransform = element.getAttribute('transform') || ''
        const positionTransform = `translate(${translateX}, 0)`
        const newTransform = currentTransform ?
          `${currentTransform} ${positionTransform}` :
          positionTransform
        element.setAttribute('transform', newTransform)
        console.log(`  → Adjusted plan view element ${element.getAttribute('id')}: translateX = ${translateX}`)
      }
    }
  })
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
  }

  // FINAL STEP: Set viewBox to match the scaled coordinate system
  // Elements are now positioned in scaled pixel space, so viewBox must match
  const finalViewBoxWidth = targetPixelWidth
  const finalViewBoxHeight = targetPixelHeight

  console.log(`Final viewBox: 0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
  console.log(`Final width/height attributes: ${targetPixelWidth} x ${targetPixelHeight}`)

  svgElement.setAttribute('viewBox', `0 0 ${finalViewBoxWidth} ${finalViewBoxHeight}`)
  svgElement.setAttribute('width', targetPixelWidth.toString())
  svgElement.setAttribute('height', targetPixelHeight.toString())

  // Convert back to string
  const serializer = new XMLSerializer()
  const scaledSVG = serializer.serializeToString(svgDoc)

  return {
    scaledSVG,
    transforms,
    scaling
  }
}

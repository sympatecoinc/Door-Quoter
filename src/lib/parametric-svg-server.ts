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
 * Detects component type based on element ID/class naming conventions
 */
export function detectComponentType(element: Element): ComponentType {
  const id = (element.getAttribute('id') || '').toLowerCase()
  const className = (element.getAttribute('class') || '').toLowerCase()
  const combined = `${id} ${className}`.toLowerCase()

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
        } else {
          console.log(`  → Grow: keeping original`)
        }
        break

      case 'glassstop':
        // Glass stops logic - position in SCALED coordinate system
        const isHorizontalGS = element.getAttribute('id')?.includes('horizontal') || width > height
        const isVerticalGS = element.getAttribute('id')?.includes('vertical') || height > width

        if (isVerticalGS) {
          const origViewBoxWidth = originalDimensions.width
          const origViewBoxHeight = originalDimensions.height
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          // Vertical glassstops are thin strips INSIDE the stiles
          // Keep their original width (typically 3-4 pixels)
          const glassStopWidth = width

          if (x > origViewBoxWidth * 0.5) {
            // Right-side glassstop - position inside right stile in SCALED coords
            const newHeightGS = (origViewBoxHeight - 2 * y)
            const newX = targetPixelWidth - rightStileWidth + (rightStileWidth - glassStopWidth) / 2

            element.setAttribute('x', newX.toString())
            element.setAttribute('y', y.toString())
            element.setAttribute('width', glassStopWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
            console.log(`  → Glassstop-V (RIGHT): x → ${newX}, width → ${glassStopWidth}, height → ${newHeightGS}`)
          } else {
            // Left-side glassstop - position inside left stile
            const newHeightGS = (origViewBoxHeight - 2 * y)
            const newX = (leftStileWidth - glassStopWidth) / 2

            element.setAttribute('x', newX.toString())
            element.setAttribute('y', y.toString())
            element.setAttribute('width', glassStopWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
            console.log(`  → Glassstop-V (LEFT): x → ${newX}, width → ${glassStopWidth}, height → ${newHeightGS}`)
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

  // CRITICAL: The SVG is in pixels representing a standard door size
  // We need to determine what real-world dimensions the SVG represents
  // Assume the SVG was created for a standard 36" x 96" door
  const svgRepresentsWidth = 36  // inches
  const svgRepresentsHeight = 96 // inches

  // Now calculate scale factors based on real-world dimensions
  const scaleX = targetDimensions.width / svgRepresentsWidth
  const scaleY = targetDimensions.height / svgRepresentsHeight

  const scaling: ComponentScaling = {
    original: { width: svgRepresentsWidth, height: svgRepresentsHeight },
    target: targetDimensions,
    scaleX,
    scaleY
  }

  console.log(`Original SVG dimensions (pixels): ${originalDimensions.width} x ${originalDimensions.height}`)
  console.log(`SVG represents (inches): ${svgRepresentsWidth}" x ${svgRepresentsHeight}"`)
  console.log(`Target dimensions (inches): ${targetDimensions.width}" x ${targetDimensions.height}"`)
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
      const componentType = detectComponentType(element)
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
    const componentType = detectComponentType(element)
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

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
        // Stiles: Keep constant WIDTH, but position at edges of SCALED door
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
        // Rails: Extend across the SCALED width
        if (mode === 'elevation') {
          const origViewBoxWidth = originalDimensions.width
          const origViewBoxHeight = originalDimensions.height
          const yRatio = y / origViewBoxHeight

          // Scale rail height by WIDTH factor (SHOPGEN approach)
          const scaledHeight = height * scaling.scaleX

          // Calculate Y position
          let newY: number
          if (yRatio < 0.1) {
            newY = 0
          } else if (yRatio > 0.8) {
            newY = origViewBoxHeight - scaledHeight
          } else {
            newY = yRatio * origViewBoxHeight
          }

          // CRITICAL: Rails must span the SCALED width in pixel coordinates
          // The target pixel width is originalWidth * scaleX
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX
          const newX = leftStileWidth
          const newWidth = targetPixelWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', newX.toString())
          element.setAttribute('y', newY.toString())
          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', scaledHeight.toString())
          console.log(`  → Horizontal: x → ${newX}, y → ${newY}, width → ${newWidth} (scaled from ${origViewBoxWidth}), height → ${scaledHeight}`)
        }
        break

      case 'grow':
        // Glass area: Scale to fill space between stiles and rails
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
        // Glass stops logic
        const isHorizontalGS = element.getAttribute('id')?.includes('horizontal') || width > height
        const isVerticalGS = element.getAttribute('id')?.includes('vertical') || height > width

        if (isVerticalGS) {
          const origViewBoxWidth = originalDimensions.width
          const origViewBoxHeight = originalDimensions.height
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX

          if (x > origViewBoxWidth * 0.5) {
            // Right-side glassstop
            const newHeightGS = (origViewBoxHeight - 2 * y)
            element.setAttribute('x', (targetPixelWidth - rightStileWidth).toString())
            element.setAttribute('y', y.toString())
            element.setAttribute('width', rightStileWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
          } else {
            // Left-side glassstop
            const newHeightGS = (origViewBoxHeight - 2 * y)
            element.setAttribute('x', '0')
            element.setAttribute('y', y.toString())
            element.setAttribute('width', leftStileWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
          }
        } else if (isHorizontalGS) {
          const origViewBoxWidth = originalDimensions.width
          const targetPixelWidth = origViewBoxWidth * scaling.scaleX
          const scaledHeightGS = height * scaling.scaleX
          const newWidthGS = targetPixelWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', leftStileWidth.toString())
          element.setAttribute('y', y.toString())
          element.setAttribute('width', newWidthGS.toString())
          element.setAttribute('height', scaledHeightGS.toString())
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

  // Calculate the target pixel dimensions based on the scale factors
  // The SVG represents a 36"x96" door in pixels, we need to scale to target door size
  const targetPixelWidth = originalDimensions.width * scaling.scaleX
  const targetPixelHeight = originalDimensions.height * scaling.scaleY

  console.log(`Target pixel dimensions: ${targetPixelWidth} x ${targetPixelHeight}`)

  // Initially set viewBox to ORIGINAL dimensions
  // We'll update it after processing all elements
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

  // FINAL STEP: Update viewBox to scaled dimensions
  // All elements have been positioned in the scaled coordinate system
  // Use the targetPixelWidth/Height calculated earlier
  console.log(`Final viewBox: 0 0 ${targetPixelWidth} ${targetPixelHeight}`)

  svgElement.setAttribute('viewBox', `0 0 ${targetPixelWidth} ${targetPixelHeight}`)
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

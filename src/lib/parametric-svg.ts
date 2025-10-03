// Parametric SVG Processing Engine - TypeScript port of SHOPGEN technology
// Provides intelligent, component-aware SVG scaling for architectural drawings

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
  originalBounds: DOMRect
  scaledBounds: DOMRect
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
 * Follows SHOPGEN pattern recognition system
 */
export function detectComponentType(element: Element): ComponentType {
  const id = element.id.toLowerCase()
  const className = element.className.toString().toLowerCase()
  const combined = `${id} ${className}`.toLowerCase()

  // Glass stop elements (rails and stiles that frame glass)
  if (combined.includes('glassstop')) return 'glassstop'

  // Vertical elements (stiles) - scale height only
  if (combined.includes('vertical') || combined.includes('stile')) return 'vertical'

  // Horizontal elements (rails) - scale width only
  if (combined.includes('horizontal') || combined.includes('rail')) return 'horizontal'

  // Growing elements (glass areas) - scale both dimensions
  if (combined.includes('grow') || combined.includes('glass-area')) return 'grow'

  // Fixed elements (hardware, text) - no scaling
  if (combined.includes('fixed') || combined.includes('hardware') || combined.includes('text')) return 'fixed'

  // Default to grow if no specific type detected
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
export function extractOriginalDimensions(svgElement: SVGSVGElement): ScalingDimensions {
  // Try viewBox first
  const viewBox = svgElement.viewBox.baseVal
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return {
      width: viewBox.width,
      height: viewBox.height
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
  targetDimensions: ScalingDimensions,
  mode: ViewMode = 'elevation',
  leftStileWidth: number = 0,
  rightStileWidth: number = 0
): ElementTransform {
  const svgEl = element as SVGGraphicsElement
  const bounds = svgEl.getBBox()
  let transform = ''
  const scaledBounds = { ...bounds } as DOMRect

  // For rect elements, directly modify attributes instead of using transforms
  if (element.tagName === 'rect') {
    const x = parseFloat(element.getAttribute('x') || '0')
    const y = parseFloat(element.getAttribute('y') || '0')
    const width = parseFloat(element.getAttribute('width') || '0')
    const height = parseFloat(element.getAttribute('height') || '0')

    console.log(`Scaling ${element.id} (${componentType}): x=${x}, y=${y}, w=${width}, h=${height}`)

    // Remove any existing transforms - we're using direct attribute modification
    if (element.getAttribute('transform')) {
      element.removeAttribute('transform')
    }

    switch (componentType) {
      case 'vertical':
        // Stiles: Keep in ORIGINAL coordinate system, use PRE-SCALED widths
        if (mode === 'elevation') {
          const origViewBoxWidth = scaling.original.width
          const origViewBoxHeight = scaling.original.height

          if (x > origViewBoxWidth * 0.5) {
            // Right stile - position at right edge in ORIGINAL coordinate system
            element.setAttribute('x', (origViewBoxWidth - rightStileWidth).toString())
            element.setAttribute('y', '0')
            element.setAttribute('width', rightStileWidth.toString())
            element.setAttribute('height', origViewBoxHeight.toString())
            console.log(`  → Vertical (RIGHT): x → ${origViewBoxWidth - rightStileWidth}, width → ${rightStileWidth} (PRE-SCALED), height → ${origViewBoxHeight}`)
            scaledBounds.width = rightStileWidth
          } else {
            // Left stile
            element.setAttribute('x', '0')
            element.setAttribute('y', '0')
            element.setAttribute('width', leftStileWidth.toString())
            element.setAttribute('height', origViewBoxHeight.toString())
            console.log(`  → Vertical (LEFT): x=0, width → ${leftStileWidth} (PRE-SCALED), height → ${origViewBoxHeight}`)
            scaledBounds.width = leftStileWidth
          }

          scaledBounds.height = origViewBoxHeight
        }
        break

      case 'horizontal':
        // Rails: Work in ORIGINAL coordinate system
        if (mode === 'elevation') {
          const origViewBoxWidth = scaling.original.width
          const origViewBoxHeight = scaling.original.height
          const yRatio = y / origViewBoxHeight

          // Scale rail height by WIDTH factor (SHOPGEN approach)
          const scaledHeight = height * scaling.scaleX

          // Calculate Y position in ORIGINAL coordinates
          let newY: number
          if (yRatio < 0.1) {
            newY = 0
          } else if (yRatio > 0.8) {
            newY = origViewBoxHeight - scaledHeight
          } else {
            newY = yRatio * origViewBoxHeight
          }

          // Use PRE-SCALED stile widths, span between them in ORIGINAL coordinate system
          const newX = leftStileWidth
          const newWidth = origViewBoxWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', newX.toString())
          element.setAttribute('y', newY.toString())
          element.setAttribute('width', newWidth.toString())
          element.setAttribute('height', scaledHeight.toString())
          console.log(`  → Horizontal: x → ${newX}, y → ${newY}, width → ${newWidth}, height=${height} → ${scaledHeight}`)

          scaledBounds.width = newWidth
          scaledBounds.height = scaledHeight
        }
        break

      case 'grow':
        // Glass areas: Keep in ORIGINAL coordinate system - no changes
        console.log(`  → Grow: keeping original (x=${x}, y=${y}, w=${width}, h=${height})`)
        break

      case 'glassstop':
        // Glass stops: Work in ORIGINAL coordinate system
        const isHorizontalGS = element.id.includes('horizontal') || width > height
        const isVerticalGS = element.id.includes('vertical') || height > width

        if (isVerticalGS) {
          // Vertical glassstop - use PRE-SCALED stile widths in ORIGINAL coordinates
          const origViewBoxWidth = scaling.original.width
          const origViewBoxHeight = scaling.original.height

          if (x > origViewBoxWidth * 0.5) {
            // Right-side
            const newHeightGS = (origViewBoxHeight - 2 * y)

            element.setAttribute('x', (origViewBoxWidth - rightStileWidth).toString())
            element.setAttribute('y', y.toString())
            element.setAttribute('width', rightStileWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
            console.log(`  → Glassstop-V (RIGHT): x → ${origViewBoxWidth - rightStileWidth}, y → ${y}, width → ${rightStileWidth}, height → ${newHeightGS}`)
          } else {
            // Left-side
            const newHeightGS = (origViewBoxHeight - 2 * y)

            element.setAttribute('x', '0')
            element.setAttribute('y', y.toString())
            element.setAttribute('width', leftStileWidth.toString())
            element.setAttribute('height', newHeightGS.toString())
            console.log(`  → Glassstop-V (LEFT): x=0, y → ${y}, width → ${leftStileWidth}, height → ${newHeightGS}`)
          }
        } else if (isHorizontalGS) {
          // Horizontal glassstop - use PRE-SCALED stile widths in ORIGINAL coordinates
          const origViewBoxWidth = scaling.original.width
          const scaledHeightGS = height * scaling.scaleX
          const newWidthGS = origViewBoxWidth - leftStileWidth - rightStileWidth

          element.setAttribute('x', leftStileWidth.toString())
          element.setAttribute('y', y.toString())
          element.setAttribute('width', newWidthGS.toString())
          element.setAttribute('height', scaledHeightGS.toString())
          console.log(`  → Glassstop-H: x → ${leftStileWidth}, y → ${y}, width → ${newWidthGS}, height=${height} → ${scaledHeightGS}`)
        } else {
          // Unknown - scale both
          const newXGS = x * scaling.scaleX
          const newYGS = y * scaling.scaleY
          const newWGS = width * scaling.scaleX
          const newHGS = height * scaling.scaleY

          element.setAttribute('x', newXGS.toString())
          element.setAttribute('y', newYGS.toString())
          element.setAttribute('width', newWGS.toString())
          element.setAttribute('height', newHGS.toString())
          console.log(`  → Glassstop (unknown): x → ${newXGS}, y → ${newYGS}, w → ${newWGS}, h → ${newHGS}`)
        }
        break

      case 'fixed':
        // Hardware/text: no scaling
        console.log(`  → Fixed: no changes`)
        break

      default:
        // Default: scale dimensions only
        const newWidthDef = width * scaling.scaleX
        const newHeightDef = height * scaling.scaleY
        element.setAttribute('width', newWidthDef.toString())
        element.setAttribute('height', newHeightDef.toString())
        scaledBounds.width *= scaling.scaleX
        scaledBounds.height *= scaling.scaleY
        console.log(`  → Default: w ${width} → ${newWidthDef}, h ${height} → ${newHeightDef}`)
    }
  } else {
    // For non-rect elements, use transform approach (fallback)
    switch (componentType) {
      case 'vertical':
        if (mode === 'elevation') {
          transform = `scale(1, ${scaling.scaleY})`
          scaledBounds.height *= scaling.scaleY
        }
        break

      case 'horizontal':
        if (mode === 'elevation') {
          transform = `scale(${scaling.scaleX}, 1)`
          scaledBounds.width *= scaling.scaleX
        }
        break

      case 'grow':
        transform = `scale(${scaling.scaleX}, ${scaling.scaleY})`
        scaledBounds.width *= scaling.scaleX
        scaledBounds.height *= scaling.scaleY
        break

      case 'glassstop':
        const glassStopScaleX = Math.max(0.5, scaling.scaleX * 0.9)
        const glassStopScaleY = Math.max(0.5, scaling.scaleY * 0.9)
        transform = `scale(${glassStopScaleX}, ${glassStopScaleY})`
        scaledBounds.width *= glassStopScaleX
        scaledBounds.height *= glassStopScaleY
        break

      case 'fixed':
        transform = 'scale(1, 1)'
        break

      default:
        transform = `scale(${scaling.scaleX}, ${scaling.scaleY})`
        scaledBounds.width *= scaling.scaleX
        scaledBounds.height *= scaling.scaleY
    }
  }

  return {
    elementId: element.id,
    elementType: componentType,
    originalBounds: bounds,
    scaledBounds,
    transform
  }
}

/**
 * Processes parametric SVG with intelligent component scaling
 * Main function that orchestrates the entire scaling process
 */
export function processParametricSVG(
  svgString: string,
  targetDimensions: ScalingDimensions,
  mode: ViewMode = 'elevation'
): { scaledSVG: string; transforms: ElementTransform[]; scaling: ComponentScaling } {
  // Parse SVG string
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = svgDoc.querySelector('svg') as SVGSVGElement

  if (!svgElement) {
    throw new Error('Invalid SVG: No SVG element found')
  }

  // Extract original dimensions
  const originalDimensions = extractOriginalDimensions(svgElement)
  const scaling = calculateScaleFactors(originalDimensions, targetDimensions)

  // Keep viewBox at ORIGINAL dimensions during element processing
  // We'll update it to target dimensions at the end
  svgElement.setAttribute('viewBox', `0 0 ${originalDimensions.width} ${originalDimensions.height}`)
  svgElement.setAttribute('width', originalDimensions.width.toString())
  svgElement.setAttribute('height', originalDimensions.height.toString())

  const elements = svgElement.querySelectorAll('[id], [class]')

  // PASS 1: Detect ORIGINAL stile widths from SVG
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

  // PASS 2: Calculate PRE-SCALED stile widths (SHOPGEN approach)
  // Scale by HEIGHT factor to maintain real-world dimensions
  const leftStileWidth = leftStileOriginalWidth * scaling.scaleY
  const rightStileWidth = rightStileOriginalWidth * scaling.scaleY

  console.log(`Original stile widths: left=${leftStileOriginalWidth}, right=${rightStileOriginalWidth}`)
  console.log(`Scaled stile widths: left=${leftStileWidth}, right=${rightStileWidth} (scaled by HEIGHT factor ${scaling.scaleY})`)

  // PASS 3: Process all elements using PRE-SCALED stile widths
  const transforms: ElementTransform[] = []

  elements.forEach(element => {
    const componentType = detectComponentType(element)
    const elementTransform = scaleElement(element, componentType, scaling, targetDimensions, mode, leftStileWidth, rightStileWidth)

    // Apply transform to element
    if (elementTransform.transform && elementTransform.transform !== 'scale(1, 1)') {
      const currentTransform = element.getAttribute('transform') || ''
      const newTransform = currentTransform ?
        `${currentTransform} ${elementTransform.transform}` :
        elementTransform.transform
      element.setAttribute('transform', newTransform)
    }

    transforms.push(elementTransform)
  })

  // Handle plan view specific adjustments
  if (mode === 'plan') {
    adjustPlanViewElements(svgElement, scaling)
  }

  // FINAL STEP: Update viewBox to target dimensions
  // Now that all elements are scaled, update the SVG container to target size
  // This ensures resvg renders at the correct dimensions without additional scaling
  svgElement.setAttribute('viewBox', `0 0 ${originalDimensions.width} ${originalDimensions.height}`)
  svgElement.setAttribute('width', targetDimensions.width.toString())
  svgElement.setAttribute('height', targetDimensions.height.toString())

  // Convert back to string
  const serializer = new XMLSerializer()
  const scaledSVG = serializer.serializeToString(svgDoc)

  return {
    scaledSVG,
    transforms,
    scaling
  }
}

/**
 * Plan view specific adjustments (SHOPGEN pattern)
 */
function adjustPlanViewElements(svgElement: SVGSVGElement, scaling: ComponentScaling) {
  // Move right-side elements to maintain proper positioning
  const rightElements = svgElement.querySelectorAll('[id*="1"], [class*="right"]')

  rightElements.forEach(element => {
    const bounds = (element as SVGGraphicsElement).getBBox()
    const currentX = bounds.x
    const newX = currentX * scaling.scaleX

    // Apply position adjustment
    const currentTransform = element.getAttribute('transform') || ''
    const translateX = newX - currentX

    if (Math.abs(translateX) > 0.1) {
      const positionTransform = `translate(${translateX}, 0)`
      const newTransform = currentTransform ?
        `${currentTransform} ${positionTransform}` :
        positionTransform
      element.setAttribute('transform', newTransform)
    }
  })
}

/**
 * Validates SVG content for parametric compatibility
 */
export function validateParametricSVG(svgString: string): {
  isValid: boolean
  errors: string[]
  detectedComponents: { id: string; type: ComponentType }[]
} {
  const errors: string[] = []
  const detectedComponents: { id: string; type: ComponentType }[] = []

  try {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgElement = svgDoc.querySelector('svg')

    if (!svgElement) {
      errors.push('Invalid SVG: No SVG element found')
      return { isValid: false, errors, detectedComponents }
    }

    // Check for elements with IDs or classes
    const elements = svgElement.querySelectorAll('[id], [class]')

    if (elements.length === 0) {
      errors.push('No identifiable elements found. Add IDs or classes for parametric scaling.')
    }

    elements.forEach(element => {
      const componentType = detectComponentType(element)
      detectedComponents.push({
        id: element.id || element.className.toString(),
        type: componentType
      })
    })

    // Check for required architectural elements
    const hasVertical = detectedComponents.some(c => c.type === 'vertical')
    const hasHorizontal = detectedComponents.some(c => c.type === 'horizontal')
    const hasGrow = detectedComponents.some(c => c.type === 'grow')

    if (!hasVertical) {
      errors.push('Warning: No vertical elements (stiles) detected')
    }
    if (!hasHorizontal) {
      errors.push('Warning: No horizontal elements (rails) detected')
    }
    if (!hasGrow) {
      errors.push('Warning: No growing elements (glass areas) detected')
    }

  } catch (error) {
    errors.push(`SVG parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
    detectedComponents
  }
}

/**
 * Converts SVG to Data URL for preview display
 */
export function svgToDataUrl(svgString: string): string {
  const encoded = encodeURIComponent(svgString)
  return `data:image/svg+xml,${encoded}`
}

/**
 * Converts SVG to PNG blob for export (requires canvas)
 */
export function svgToPngBlob(svgString: string, width?: number, height?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    img.onload = () => {
      canvas.width = width || img.width
      canvas.height = height || img.height

      // White background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw SVG
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create PNG blob'))
        }
      }, 'image/png')
    }

    img.onerror = () => reject(new Error('Failed to load SVG image'))
    img.src = svgToDataUrl(svgString)
  })
}
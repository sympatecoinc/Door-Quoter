// Server-Side SVG to PNG Rendering Utility
// Uses resvg-js to convert SVG to PNG, matching SHOPGEN's cairosvg approach

import { Resvg } from '@resvg/resvg-js'
import { processParametricSVG } from './parametric-svg-server'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

export interface RenderOptions {
  width: number
  height: number
  background?: string
  mode?: 'elevation' | 'plan'
}

/**
 * Renders an SVG string to PNG using parametric scaling and resvg
 * This matches SHOPGEN's server-side rendering approach (cairosvg.svg2png)
 *
 * @param svgString - The SVG content as a string
 * @param options - Rendering options including target dimensions
 * @returns Base64-encoded PNG data
 */
export async function renderSvgToPng(
  svgString: string,
  options: RenderOptions
): Promise<string> {
  try {
    console.log('=== SVG Renderer: Starting render ===')
    console.log('Target dimensions:', options.width, 'x', options.height)
    console.log('Mode:', options.mode || 'elevation')
    console.log('SVG length:', svgString.length)

    // Extract original dimensions from SVG viewBox (before processing)
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
    if (!viewBoxMatch) {
      throw new Error('SVG missing viewBox attribute')
    }
    const viewBox = viewBoxMatch[1].split(/\s+/).map(parseFloat)
    const originalDimensions = {
      width: viewBox[2],
      height: viewBox[3]
    }
    const originalAspectRatio = originalDimensions.height / originalDimensions.width
    console.log('→ Original SVG dimensions from viewBox:', originalDimensions.width, 'x', originalDimensions.height)
    console.log('→ Original aspect ratio:', originalAspectRatio.toFixed(4))

    // For plan views, render the (already processed) SVG at high resolution
    if (options.mode === 'plan') {
      console.log('→ Plan view: rendering processed SVG at high resolution')

      // Calculate render width based on target width in inches
      // Use pixels per inch similar to elevation views for crisp output
      const pixelsPerInch = 32  // Reduced from 48 for smaller file size
      const renderWidth = Math.max(1600, options.width * pixelsPerInch)

      console.log('→ Plan view render width:', renderWidth, 'pixels')

      const resvg = new Resvg(svgString, {
        background: options.background || '#ffffff',
        fitTo: {
          mode: 'width',
          value: Math.round(renderWidth)
        },
        font: {
          loadSystemFonts: true
        }
      })

      const pngData = resvg.render()
      const pngBuffer = pngData.asPng()

      console.log('→ PNG render successful, size:', pngBuffer.length, 'bytes')
      console.log('→ PNG dimensions:', pngData.width, 'x', pngData.height)

      const base64 = pngBuffer.toString('base64')

      console.log('→ Converted to base64, length:', base64.length)
      console.log('=== SVG Renderer: Complete ===')

      return base64
    }

    // For elevation views, apply parametric scaling
    const { scaledSVG, scaling, transforms } = processParametricSVG(
      svgString,
      { width: options.width, height: options.height },
      options.mode || 'elevation'
    )

    console.log('→ Parametric scaling applied')
    console.log('  Scale factors: X =', scaling.scaleX, ', Y =', scaling.scaleY)
    console.log('  Elements processed:', transforms.length)

    // Step 2: Render scaled SVG to PNG using resvg
    const pixelsPerInch = 24  // High resolution for crisp shop drawings
    const pngWidth = Math.round(options.width * pixelsPerInch)
    const pngHeight = Math.round(options.height * pixelsPerInch)

    console.log('→ Rendering to PNG:', pngWidth, 'x', pngHeight)

    const resvg = new Resvg(scaledSVG, {
      background: options.background || '#ffffff',
      fitTo: {
        mode: 'width',
        value: pngWidth
      },
      font: {
        loadSystemFonts: true
      }
    })

    const pngData = resvg.render()
    const pngBuffer = pngData.asPng()

    console.log('→ PNG render successful, size:', pngBuffer.length, 'bytes')

    // Step 3: Convert to base64 for transmission
    const base64 = pngBuffer.toString('base64')

    console.log('→ Converted to base64, length:', base64.length)
    console.log('=== SVG Renderer: Complete ===')

    return base64
  } catch (error) {
    console.error('!!! SVG Renderer: Error rendering SVG to PNG:', error)
    console.error('Stack:', (error as Error).stack)
    throw new Error(`Failed to render SVG to PNG: ${(error as Error).message}`)
  }
}

/**
 * Checks if a file is an SVG based on filename
 */
export function isSvgFile(fileName?: string): boolean {
  if (!fileName) return false
  return fileName.toLowerCase().endsWith('.svg')
}

/**
 * Decodes SVG data from various encoding formats
 * Handles base64, double-base64, and data URIs
 *
 * @param imageData - The encoded image data
 * @returns Decoded SVG string
 */
export function decodeSvgData(imageData: string): string {
  try {
    // Remove data URI prefix if present
    let data = imageData
    if (data.startsWith('data:image/svg+xml')) {
      const parts = data.split(',')
      data = parts[1]

      // Check if it's base64 encoded (indicated in the data URI)
      if (parts[0].includes('base64')) {
        data = Buffer.from(data, 'base64').toString('utf-8')
      } else {
        data = decodeURIComponent(data)
      }
      return data
    }

    // Try base64 decoding
    const decoded = Buffer.from(data, 'base64').toString('utf-8')

    // Check if it's still base64 encoded (double encoding)
    if (!decoded.includes('<') && /^[A-Za-z0-9+/=]+$/.test(decoded.substring(0, 100))) {
      console.log('→ Detected double base64 encoding, decoding again')
      return Buffer.from(decoded, 'base64').toString('utf-8')
    }

    return decoded
  } catch (error) {
    console.error('Error decoding SVG data:', error)
    throw new Error('Failed to decode SVG data')
  }
}

/**
 * Hardware image placement configuration
 */
export interface HardwareImagePlacement {
  originId: string      // The ID to look for in the SVG (e.g., "origin-abc123")
  imageData: string     // Base64-encoded PNG data OR raw SVG string
  width: number         // Image width in SVG coordinate units
  height: number        // Image height in SVG coordinate units
  isSvg?: boolean       // True if imageData is SVG content (not base64 PNG)
}

/**
 * Injects hardware images into an SVG at specified origin points.
 * Origin points are elements with IDs that match the placement's originId.
 * The hardware image is centered on the origin point's coordinates.
 *
 * @param svgString - The SVG content as a string
 * @param hardwareImages - Array of hardware images to inject
 * @returns Modified SVG string with hardware images injected
 */
export function injectHardwareImages(
  svgString: string,
  hardwareImages: HardwareImagePlacement[]
): string {
  if (!hardwareImages || hardwareImages.length === 0) {
    return svgString
  }

  try {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgElement = svgDoc.documentElement

    if (!svgElement || svgElement.tagName !== 'svg') {
      console.warn('injectHardwareImages: Invalid SVG, returning original')
      return svgString
    }

    console.log(`=== Injecting ${hardwareImages.length} hardware image(s) ===`)

    for (const placement of hardwareImages) {
      // Find the origin element by ID
      const originElement = svgDoc.getElementById(placement.originId)

      if (!originElement) {
        console.log(`  → Origin point "${placement.originId}" not found in SVG, skipping`)
        continue
      }

      // Get origin coordinates based on element type
      let originX: number
      let originY: number

      const tagName = originElement.tagName.toLowerCase()

      if (tagName === 'circle') {
        // For circles, use cx/cy
        originX = parseFloat(originElement.getAttribute('cx') || '0')
        originY = parseFloat(originElement.getAttribute('cy') || '0')
      } else if (tagName === 'rect') {
        // For rects, use x/y (optionally adjusted by width/height if > 0)
        const x = parseFloat(originElement.getAttribute('x') || '0')
        const y = parseFloat(originElement.getAttribute('y') || '0')
        const w = parseFloat(originElement.getAttribute('width') || '0')
        const h = parseFloat(originElement.getAttribute('height') || '0')

        // If rect has dimensions, use center; otherwise use x/y directly
        originX = w > 0 ? x + w / 2 : x
        originY = h > 0 ? y + h / 2 : y
      } else {
        // For other elements, try x/y attributes
        originX = parseFloat(originElement.getAttribute('x') || originElement.getAttribute('cx') || '0')
        originY = parseFloat(originElement.getAttribute('y') || originElement.getAttribute('cy') || '0')
      }

      console.log(`  → Found origin "${placement.originId}" at (${originX}, ${originY})`)
      console.log(`    Image size: ${placement.width} x ${placement.height}`)

      // Calculate position to center the image on the origin point
      const imageX = originX - placement.width / 2
      const imageY = originY - placement.height / 2

      console.log(`    Placing image at (${imageX}, ${imageY})`)

      if (placement.isSvg) {
        // For SVG hardware: embed as a nested <svg> element
        // Parse the hardware SVG
        const hardwareSvgDoc = parser.parseFromString(placement.imageData, 'image/svg+xml')
        const hardwareSvgElement = hardwareSvgDoc.documentElement

        if (hardwareSvgElement && hardwareSvgElement.tagName === 'svg') {
          // Create a nested SVG element positioned at the origin
          const nestedSvg = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'svg')
          nestedSvg.setAttribute('x', imageX.toString())
          nestedSvg.setAttribute('y', imageY.toString())
          nestedSvg.setAttribute('width', placement.width.toString())
          nestedSvg.setAttribute('height', placement.height.toString())

          // Copy the viewBox from the hardware SVG to maintain proportions
          const viewBox = hardwareSvgElement.getAttribute('viewBox')
          if (viewBox) {
            nestedSvg.setAttribute('viewBox', viewBox)
          }
          nestedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

          // Copy all child elements from the hardware SVG
          const childNodes = hardwareSvgElement.childNodes
          for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i]
            if (child.nodeType === 1) { // Element node
              nestedSvg.appendChild(child.cloneNode(true))
            }
          }

          // Insert the nested SVG at the end of the main SVG (on top of other elements)
          svgElement.appendChild(nestedSvg)

          console.log(`  → Injected SVG hardware for "${placement.originId}"`)
        } else {
          console.log(`  → Failed to parse hardware SVG for "${placement.originId}"`)
        }
      } else {
        // For PNG hardware: create an <image> element with data URI
        const imageElement = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image')
        imageElement.setAttribute('x', imageX.toString())
        imageElement.setAttribute('y', imageY.toString())
        imageElement.setAttribute('width', placement.width.toString())
        imageElement.setAttribute('height', placement.height.toString())

        // Set the image data as a data URI
        const dataUri = placement.imageData.startsWith('data:')
          ? placement.imageData
          : `data:image/png;base64,${placement.imageData}`
        imageElement.setAttribute('href', dataUri)
        imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUri)

        // Add preserveAspectRatio to maintain image proportions
        imageElement.setAttribute('preserveAspectRatio', 'xMidYMid meet')

        // Insert the image element at the end of the SVG (on top of other elements)
        svgElement.appendChild(imageElement)

        console.log(`  → Injected PNG image for "${placement.originId}"`)
      }
    }

    // Serialize and return
    const serializer = new XMLSerializer()
    const result = serializer.serializeToString(svgDoc)

    console.log('=== Hardware image injection complete ===')

    return result
  } catch (error) {
    console.error('Error injecting hardware images:', error)
    // Return original SVG on error
    return svgString
  }
}

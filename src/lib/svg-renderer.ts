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
      const pixelsPerInch = 48  // Higher resolution for plan views (they're small)
      const renderWidth = Math.max(2400, options.width * pixelsPerInch)

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

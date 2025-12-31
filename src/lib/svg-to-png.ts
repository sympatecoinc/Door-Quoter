// SVG to PNG conversion utility for PDF generation
// Uses node-canvas to render SVG data URLs to PNG

import { createCanvas, loadImage } from 'canvas'

/**
 * Converts an SVG data URL to a PNG data URL
 * @param svgDataUrl - SVG image as data URL (data:image/svg+xml;base64,...)
 * @param width - Target width in pixels (default: 200)
 * @param height - Target height in pixels (default: 200)
 * @returns PNG data URL
 */
export async function svgToPng(
  svgDataUrl: string,
  width: number = 200,
  height: number = 200
): Promise<string> {
  try {
    // Parse the SVG to add width/height if missing
    let processedSvgDataUrl = svgDataUrl

    // Check if it's an SVG data URL
    if (isSvgDataUrl(svgDataUrl)) {
      // Decode the data URL to get the SVG content
      const base64Data = svgDataUrl.split(',')[1]
      if (!base64Data) {
        throw new Error('Invalid SVG data URL format')
      }

      const svgContent = Buffer.from(base64Data, 'base64').toString('utf-8')

      // Check if width/height attributes are missing on the svg element
      const svgTagMatch = svgContent.match(/<svg[^>]*>/i)
      if (!svgTagMatch) {
        throw new Error('No SVG element found in content')
      }

      const svgTag = svgTagMatch[0]
      const hasWidth = /\swidth\s*=/.test(svgTag)
      const hasHeight = /\sheight\s*=/.test(svgTag)

      if (!hasWidth || !hasHeight) {
        console.log('SVG missing width/height, attempting to add from viewBox...')

        // Extract viewBox dimensions
        const viewBoxMatch = svgTag.match(/viewBox\s*=\s*["']([^"']+)["']/i)
        if (viewBoxMatch) {
          const viewBox = viewBoxMatch[1].trim().split(/[\s,]+/)
          if (viewBox.length >= 4) {
            const vbWidth = parseFloat(viewBox[2])
            const vbHeight = parseFloat(viewBox[3])

            console.log(`Adding width="${vbWidth}" height="${vbHeight}" from viewBox`)

            // Add width and height attributes to the SVG element
            const modifiedSvg = svgContent.replace(
              /<svg([^>]*)>/i,
              `<svg$1 width="${vbWidth}" height="${vbHeight}">`
            )

            // Re-encode as data URL
            const newBase64 = Buffer.from(modifiedSvg, 'utf-8').toString('base64')
            processedSvgDataUrl = `data:image/svg+xml;base64,${newBase64}`
          } else {
            console.error('Invalid viewBox format:', viewBoxMatch[1])
          }
        } else {
          console.error('No viewBox found in SVG, cannot determine dimensions')
          console.error('SVG tag:', svgTag.substring(0, 200))
        }
      }
    }

    // Load the SVG first to get its natural dimensions
    const image = await loadImage(processedSvgDataUrl)

    // Calculate canvas dimensions that match the source aspect ratio
    // This prevents white padding/gaps between adjacent images
    const sourceAspectRatio = image.height / image.width
    let canvasWidth = width
    let canvasHeight = Math.floor(width * sourceAspectRatio)

    // If the calculated height exceeds the requested height, scale down
    if (canvasHeight > height) {
      canvasHeight = height
      canvasWidth = Math.floor(height / sourceAspectRatio)
    }

    // Create a canvas matching the source aspect ratio
    const canvas = createCanvas(canvasWidth, canvasHeight)
    const ctx = canvas.getContext('2d')

    // Fill with white background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw the image to fill the entire canvas (no centering, no gaps)
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight)

    // Convert to PNG data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error converting SVG to PNG:', error)
    throw error
  }
}

/**
 * Detects if a data URL is an SVG image
 */
export function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.includes('data:image/svg+xml') || dataUrl.includes('data:image/svg')
}

/**
 * Converts an image data URL to PNG if it's SVG, otherwise returns as-is
 */
export async function ensurePngDataUrl(
  dataUrl: string,
  width?: number,
  height?: number
): Promise<string> {
  if (isSvgDataUrl(dataUrl)) {
    return svgToPng(dataUrl, width, height)
  }
  return dataUrl
}

import { createCanvas, loadImage } from 'canvas'

/**
 * Rotates a base64 image by the specified degrees
 * @param imageData Base64 image data (with or without data: prefix)
 * @param degrees Rotation angle (90, -90, 180, etc.)
 * @returns Base64 rotated image data with data:image/png;base64, prefix
 */
export async function rotateImage(imageData: string, degrees: number): Promise<string> {
  if (degrees === 0) {
    // No rotation needed
    return imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
  }

  try {
    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const dataUrl = `data:image/png;base64,${base64Data}`

    // Load the image
    const img = await loadImage(dataUrl)
    const originalWidth = img.width
    const originalHeight = img.height

    // Calculate new dimensions after rotation
    let newWidth: number
    let newHeight: number

    if (degrees === 90 || degrees === -90 || degrees === 270 || degrees === -270) {
      // 90 degree rotations swap width and height
      newWidth = originalHeight
      newHeight = originalWidth
    } else {
      // Other rotations keep dimensions
      newWidth = originalWidth
      newHeight = originalHeight
    }

    // Create canvas with new dimensions
    const canvas = createCanvas(newWidth, newHeight)
    const ctx = canvas.getContext('2d')

    // Clear canvas
    ctx.fillStyle = 'transparent'
    ctx.fillRect(0, 0, newWidth, newHeight)

    // Move to center, rotate, move back
    ctx.translate(newWidth / 2, newHeight / 2)
    ctx.rotate((degrees * Math.PI) / 180)
    ctx.drawImage(img, -originalWidth / 2, -originalHeight / 2)

    // Convert to base64
    const rotatedDataUrl = canvas.toDataURL('image/png')
    return rotatedDataUrl
  } catch (error) {
    console.error('Error rotating image:', error)
    // Return original on error
    return imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
  }
}

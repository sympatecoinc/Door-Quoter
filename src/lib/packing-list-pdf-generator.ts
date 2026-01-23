// Packing List PDF Generation Utility
// Generates a packing list PDF with items in sticker order
// Each line item shows its corresponding sticker number for easy correlation

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { downloadFile } from './gcs-storage'

export interface PackingListLineItem {
  openingName: string
  itemType: 'component' | 'hardware' | 'jambkit'
  itemName: string
  partNumber?: string | null
  dimensions?: string  // For components
  quantity: number
  unit?: string | null
  itemCount?: number  // For jamb kits
  stickerNumber: number  // 1-based sticker index
  totalStickers: number  // Total stickers in project
}

export interface JambKitEntry {
  openingName: string
  itemCount: number
}

export interface PackingListData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  lineItems: PackingListLineItem[]
  jambKits?: JambKitEntry[]
  generatedDate: string
}

// Legacy interfaces for backwards compatibility
export interface PackingListItem {
  openingName: string
  productName: string
  partNumber: string | null
  partName: string
  quantity: number
  unit: string | null
}

export interface ProductInstance {
  openingName: string
  productName: string
  panelType?: string
  width?: number
  height?: number
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Helper function to truncate text to fit within a width
 */
function truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
  if (!text) return ''

  const textWidth = pdf.getTextWidth(text)
  if (textWidth <= maxWidth) return text

  let left = 0
  let right = text.length

  while (left < right) {
    const mid = Math.ceil((left + right) / 2)
    const truncated = text.substring(0, mid) + '...'
    if (pdf.getTextWidth(truncated) <= maxWidth) {
      left = mid
    } else {
      right = mid - 1
    }
  }

  return text.substring(0, left) + '...'
}

/**
 * Draws a checkbox
 */
function drawCheckbox(pdf: jsPDF, x: number, y: number, size: number = 4): void {
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.3)
  pdf.rect(x, y - size + 1, size, size)
}

/**
 * Creates a Packing List PDF with items in sticker order
 */
export async function createPackingListPDF(data: PackingListData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  let yPos = MARGIN

  // Logo constants
  const logoMaxWidth = 40
  const logoMaxHeight = 15

  // Add company logo in top right if available
  if (data.companyLogo) {
    try {
      let logoBuffer: Buffer | null = null
      let logoMimeType = 'image/png'

      // Try to parse as JSON (new GCS format)
      try {
        const logoInfo = JSON.parse(data.companyLogo)
        if (logoInfo.gcsPath) {
          logoBuffer = await downloadFile(logoInfo.gcsPath)
          logoMimeType = logoInfo.mimeType || 'image/png'
        }
      } catch {
        // Legacy format - try filesystem
        const logoPath = path.join(process.cwd(), 'uploads', 'branding', data.companyLogo)
        if (fs.existsSync(logoPath)) {
          logoBuffer = fs.readFileSync(logoPath)
          const logoExt = path.extname(data.companyLogo).toLowerCase()
          logoMimeType = logoExt === '.svg' ? 'image/svg+xml' :
                        logoExt === '.jpg' || logoExt === '.jpeg' ? 'image/jpeg' : 'image/png'
        }
      }

      if (logoBuffer) {
        const logoExt = logoMimeType.split('/')[1]
        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg+xml' || logoExt === 'svg') {
          processedLogoBuffer = logoBuffer
        } else {
          const metadata = await sharp(logoBuffer).metadata()
          const hasAlpha = metadata.channels === 4

          if (hasAlpha) {
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .png({ compressionLevel: 9 })
              .toBuffer()
          } else {
            processedLogoBuffer = await sharp(logoBuffer)
              .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toBuffer()
            imageFormat = 'JPEG'
          }
        }

        // Get actual dimensions after processing to calculate aspect ratio
        const processedMetadata = await sharp(processedLogoBuffer).metadata()
        const imgWidth = processedMetadata.width || 600
        const imgHeight = processedMetadata.height || 200

        // Calculate scaled dimensions preserving aspect ratio
        const aspectRatio = imgWidth / imgHeight
        let finalWidth = logoMaxWidth
        let finalHeight = logoMaxWidth / aspectRatio

        // If height exceeds max, scale down based on height instead
        if (finalHeight > logoMaxHeight) {
          finalHeight = logoMaxHeight
          finalWidth = logoMaxHeight * aspectRatio
        }

        const logoBase64 = processedLogoBuffer.toString('base64')
        const mimeType = imageFormat === 'JPEG' ? 'image/jpeg' :
                         (logoExt === 'svg' || logoExt === 'svg+xml' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${mimeType};base64,${logoBase64}`

        const logoX = PAGE_WIDTH - MARGIN - finalWidth
        pdf.addImage(logoData, imageFormat, logoX, yPos, finalWidth, finalHeight, undefined, 'SLOW')
      }
    } catch (error) {
      console.error('Error adding company logo to Packing List PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Packing List', MARGIN, yPos + 5)
  yPos += 16

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Generated date and total stickers info
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  const totalStickers = data.lineItems.length > 0 ? data.lineItems[0].totalStickers : 0
  pdf.text(`Generated: ${data.generatedDate}  |  Total Stickers: ${totalStickers}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.lineItems.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths - adjusted to include sticker number column
  const COL_STICKER = 16  // Sticker # column
  const COL_ITEM = 125    // Opening/Item info
  const COL_STAGED = 14
  const COL_QA = 12
  const COL_LOADED = 14
  // Total: 16 + 125 + 14 + 12 + 14 = 181mm (fits in ~186mm content width)

  const rowHeight = 8
  const headerHeight = 8

  // Helper to draw table header
  const drawTableHeader = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('#', xPos, yPos + 5.5)
    xPos += COL_STICKER
    pdf.text('Opening / Item', xPos, yPos + 5.5)
    xPos += COL_ITEM
    pdf.text('Staged', xPos + COL_STAGED / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_STAGED
    pdf.text('QA', xPos + COL_QA / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_QA
    pdf.text('Loaded', xPos + COL_LOADED / 2, yPos + 5.5, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    yPos += headerHeight
  }

  // Helper to check for new page
  const checkNewPage = (neededSpace: number): boolean => {
    if (yPos + neededSpace > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
      return true
    }
    return false
  }

  // Group items by opening for visual organization
  const openingGroups: Record<string, PackingListLineItem[]> = {}
  for (const item of data.lineItems) {
    if (!openingGroups[item.openingName]) {
      openingGroups[item.openingName] = []
    }
    openingGroups[item.openingName].push(item)
  }

  const sortedOpenings = Object.keys(openingGroups).sort()

  // Render items grouped by opening
  for (const openingName of sortedOpenings) {
    const items = openingGroups[openingName]

    // Calculate minimum space needed for this group
    const minSpace = 10 + headerHeight + Math.min(items.length, 2) * rowHeight + 10
    checkNewPage(minSpace)

    // Opening header
    pdf.setFillColor(59, 130, 246) // Blue
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(openingName, MARGIN + 3, yPos + 5.5)
    pdf.setTextColor(0, 0, 0)
    yPos += 10

    drawTableHeader()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (checkNewPage(rowHeight + 10)) {
        // Re-draw opening header
        pdf.setFillColor(59, 130, 246)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text(`${openingName} (continued)`, MARGIN + 3, yPos + 5.5)
        pdf.setTextColor(0, 0, 0)
        yPos += 10

        drawTableHeader()
      }

      // Row background based on item type
      if (item.itemType === 'component') {
        pdf.setFillColor(239, 246, 255) // Light blue for components
      } else if (item.itemType === 'jambkit') {
        pdf.setFillColor(254, 243, 199) // Light amber for jamb kits
      } else {
        pdf.setFillColor(240, 253, 244) // Light green for hardware
      }
      pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')

      let xPos = MARGIN + 2

      // Sticker number (bold, highlighted)
      pdf.setFont('helvetica', 'bold')
      pdf.setFillColor(100, 100, 100)
      const stickerNumText = `${item.stickerNumber}`
      pdf.text(stickerNumText, xPos, yPos + 5.5)
      pdf.setFont('helvetica', 'normal')
      xPos += COL_STICKER

      // Item type badge + item info
      let itemText = ''
      if (item.itemType === 'component') {
        itemText = `[COMP] ${item.itemName}`
        if (item.dimensions) {
          itemText += ` - ${item.dimensions}`
        }
      } else if (item.itemType === 'jambkit') {
        itemText = `[JAMB KIT] ${item.itemCount} items`
      } else {
        // Hardware
        if (item.partNumber) {
          itemText = `${item.partNumber} - ${item.itemName}`
        } else {
          itemText = item.itemName
        }
      }
      itemText = truncateText(pdf, itemText, COL_ITEM - 4)
      pdf.text(itemText, xPos, yPos + 5.5)
      xPos += COL_ITEM

      // Checkboxes (centered in each column)
      drawCheckbox(pdf, xPos + (COL_STAGED - 5) / 2, yPos + 5.5, 5)
      xPos += COL_STAGED
      drawCheckbox(pdf, xPos + (COL_QA - 5) / 2, yPos + 5.5, 5)
      xPos += COL_QA
      drawCheckbox(pdf, xPos + (COL_LOADED - 5) / 2, yPos + 5.5, 5)

      yPos += rowHeight
    }

    // Space between opening groups
    yPos += 4
  }

  // Summary section
  checkNewPage(35)

  yPos += 8
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 8

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Summary', MARGIN, yPos)
  yPos += 6

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  const totalItems = data.lineItems.length
  const componentCount = data.lineItems.filter(i => i.itemType === 'component').length
  const hardwareCount = data.lineItems.filter(i => i.itemType === 'hardware').length
  const jambKitCount = data.lineItems.filter(i => i.itemType === 'jambkit').length
  const uniqueOpenings = sortedOpenings.length

  pdf.text(`Total Stickers: ${totalItems}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Openings: ${uniqueOpenings}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Components: ${componentCount}  |  Hardware: ${hardwareCount}  |  Jamb Kits: ${jambKitCount}`, MARGIN, yPos)

  // Legend
  yPos += 10
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Legend:', MARGIN, yPos)
  yPos += 5
  pdf.setFont('helvetica', 'normal')

  // Component color box
  pdf.setFillColor(239, 246, 255)
  pdf.rect(MARGIN, yPos - 3, 8, 4, 'F')
  pdf.text('[COMP] = Component/Panel', MARGIN + 10, yPos)

  // Hardware color box
  pdf.setFillColor(240, 253, 244)
  pdf.rect(MARGIN + 60, yPos - 3, 8, 4, 'F')
  pdf.text('Hardware Item', MARGIN + 72, yPos)

  // Jamb kit color box
  pdf.setFillColor(254, 243, 199)
  pdf.rect(MARGIN + 110, yPos - 3, 8, 4, 'F')
  pdf.text('[JAMB KIT] = Jamb Kit', MARGIN + 120, yPos)

  // Footer
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text('Sticker # column corresponds to sticker "X of Y" - use to match stickers to checklist', PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' })

  return Buffer.from(pdf.output('arraybuffer'))
}

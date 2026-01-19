// Box List PDF Generation Utility
// Generates a simple box cut list PDF showing packaging items aggregated by part number

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export interface BoxListItem {
  partNumber: string
  partName: string
  totalQuantity: number
}

export interface BoxListData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  items: BoxListItem[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Creates a Box Cut List PDF
 */
export async function createBoxListPDF(data: BoxListData): Promise<Buffer> {
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
      const logoPath = path.join(process.cwd(), 'uploads', 'branding', data.companyLogo)
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoExt = path.extname(data.companyLogo).toLowerCase().replace('.', '')

        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg') {
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
                         (logoExt === 'svg' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${mimeType};base64,${logoBase64}`

        const logoX = PAGE_WIDTH - MARGIN - finalWidth
        pdf.addImage(logoData, imageFormat, logoX, yPos, finalWidth, finalHeight, undefined, 'SLOW')
      }
    } catch (error) {
      console.error('Error adding company logo to Box List PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Box Cut List', MARGIN, yPos + 5)
  yPos += 16

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Customer name if available
  if (data.customerName) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(80, 80, 80)
    pdf.text(data.customerName, MARGIN, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 6
  }

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 12

  if (data.items.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No packaging items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths - simple two-column layout
  const colWidths = {
    partNumber: 120,
    qty: 45
  }

  const rowHeight = 12
  const headerHeight = 10

  // Table header
  pdf.setFillColor(79, 70, 229) // Indigo color
  pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  let xPos = MARGIN + 4
  pdf.text('Part Number / Description', xPos, yPos + 7)
  xPos += colWidths.partNumber
  pdf.text('Quantity', xPos, yPos + 7)

  pdf.setTextColor(0, 0, 0)
  yPos += headerHeight

  // Table rows
  pdf.setFont('helvetica', 'normal')

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]

    // Check if we need a new page
    if (yPos + rowHeight > PAGE_HEIGHT - MARGIN - 30) {
      pdf.addPage()
      yPos = MARGIN

      // Re-draw table header on new page
      pdf.setFillColor(79, 70, 229)
      pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)

      xPos = MARGIN + 4
      pdf.text('Part Number / Description', xPos, yPos + 7)
      xPos += colWidths.partNumber
      pdf.text('Quantity', xPos, yPos + 7)

      pdf.setTextColor(0, 0, 0)
      yPos += headerHeight
      pdf.setFont('helvetica', 'normal')
    }

    // Alternating row background
    if (i % 2 === 0) {
      pdf.setFillColor(248, 248, 252)
      pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
    }

    // Draw row border
    pdf.setDrawColor(230, 230, 230)
    pdf.line(MARGIN, yPos + rowHeight, MARGIN + CONTENT_WIDTH, yPos + rowHeight)

    pdf.setFontSize(9)
    xPos = MARGIN + 4

    // Part Number (monospace style)
    pdf.setFont('courier', 'bold')
    const partNumber = truncateText(pdf, item.partNumber, colWidths.partNumber - 8)
    pdf.text(partNumber, xPos, yPos + 5)

    // Part Name below part number (smaller, gray)
    if (item.partName && item.partName !== item.partNumber) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(100, 100, 100)
      const partName = truncateText(pdf, item.partName, colWidths.partNumber - 8)
      pdf.text(partName, xPos, yPos + 10)
      pdf.setTextColor(0, 0, 0)
    }

    xPos += colWidths.partNumber

    // Quantity (bold, centered)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text(item.totalQuantity.toString(), xPos + colWidths.qty / 2, yPos + 7, { align: 'center' })

    yPos += rowHeight
  }

  // Summary section
  yPos += 10
  pdf.setDrawColor(200, 200, 200)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 8

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Summary', MARGIN, yPos)
  yPos += 7

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  const totalBoxes = data.items.reduce((sum, item) => sum + item.totalQuantity, 0)
  const uniqueTypes = data.items.length

  pdf.text(`Total Boxes: ${totalBoxes}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Unique Box Types: ${uniqueTypes}`, MARGIN, yPos)

  return Buffer.from(pdf.output('arraybuffer'))
}

/**
 * Helper function to truncate text to fit within a width
 */
function truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
  if (!text) return ''

  const textWidth = pdf.getTextWidth(text)
  if (textWidth <= maxWidth) return text

  // Binary search for the right length
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

// Jamb Kit List PDF Generation Utility
// Generates a professional jamb kit list PDF showing items grouped by opening

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export interface JambKitItem {
  partNumber: string
  partName: string
  unit: string
  totalQuantity: number
}

export interface JambKitOpening {
  openingName: string
  items: JambKitItem[]
}

export interface JambKitData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  openings: JambKitOpening[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Creates a Jamb Kit List PDF
 */
export async function createJambKitPDF(data: JambKitData): Promise<Buffer> {
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
      console.error('Error adding company logo to Jamb Kit PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Jamb Kit List', MARGIN, yPos + 5)
  yPos += 16

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.openings.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No jamb kit items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths - must fit within CONTENT_WIDTH (~186mm)
  const colWidths = {
    partNumber: 55,
    partName: 90,
    qty: 20,
    unit: 20
  }
  // Total: 55 + 90 + 20 + 20 = 185mm

  const rowHeight = 7
  const headerHeight = 8

  // Render each opening group
  for (const opening of data.openings) {
    // Check if we need a new page (header + at least 3 rows should fit)
    if (yPos + headerHeight + rowHeight * 3 + 15 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    // Opening group header
    pdf.setFillColor(16, 185, 129) // Green color for jamb kit
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(opening.openingName, MARGIN + 3, yPos + 5.5)
    pdf.setTextColor(0, 0, 0)
    yPos += 10

    // Table header
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('Part Number', xPos, yPos + 5.5)
    xPos += colWidths.partNumber
    pdf.text('Part Name', xPos, yPos + 5.5)
    xPos += colWidths.partName
    pdf.text('Qty', xPos, yPos + 5.5)
    xPos += colWidths.qty
    pdf.text('Unit', xPos, yPos + 5.5)

    yPos += headerHeight

    // Table rows
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)

    for (let i = 0; i < opening.items.length; i++) {
      const item = opening.items[i]

      // Check if we need a new page
      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN

        // Re-draw opening header on new page
        pdf.setFillColor(16, 185, 129)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text(`${opening.openingName} (continued)`, MARGIN + 3, yPos + 5.5)
        pdf.setTextColor(0, 0, 0)
        yPos += 10

        // Re-draw table header
        pdf.setFillColor(240, 240, 240)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(50, 50, 50)

        xPos = MARGIN + 2
        pdf.text('Part Number', xPos, yPos + 5.5)
        xPos += colWidths.partNumber
        pdf.text('Part Name', xPos, yPos + 5.5)
        xPos += colWidths.partName
        pdf.text('Qty', xPos, yPos + 5.5)
        xPos += colWidths.qty
        pdf.text('Unit', xPos, yPos + 5.5)

        yPos += headerHeight
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(0, 0, 0)
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(8)
      xPos = MARGIN + 2

      // Part Number (monospace style)
      pdf.setFont('courier', 'normal')
      const partNumber = truncateText(pdf, item.partNumber, colWidths.partNumber - 4)
      pdf.text(partNumber, xPos, yPos + 5)
      xPos += colWidths.partNumber

      // Part Name
      pdf.setFont('helvetica', 'normal')
      const partName = truncateText(pdf, item.partName, colWidths.partName - 4)
      pdf.text(partName, xPos, yPos + 5)
      xPos += colWidths.partName

      // Quantity (bold, right-aligned)
      pdf.setFont('helvetica', 'bold')
      pdf.text(item.totalQuantity.toString(), xPos + colWidths.qty - 8, yPos + 5, { align: 'right' })
      xPos += colWidths.qty

      // Unit
      pdf.setFont('helvetica', 'normal')
      pdf.text(item.unit || 'EA', xPos, yPos + 5)

      yPos += rowHeight
    }

    // Add space between opening groups
    yPos += 5
  }

  // Summary section
  if (yPos + 30 > PAGE_HEIGHT - MARGIN) {
    pdf.addPage()
    yPos = MARGIN
  }

  yPos += 5
  pdf.setDrawColor(200, 200, 200)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 8

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Summary', MARGIN, yPos)
  yPos += 6

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  const totalItems = data.openings.reduce((sum, opening) =>
    sum + opening.items.reduce((itemSum, item) => itemSum + item.totalQuantity, 0), 0)
  const openingCount = data.openings.length

  pdf.text(`Total Openings: ${openingCount}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Total Jamb Kit Items: ${totalItems}`, MARGIN, yPos)

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

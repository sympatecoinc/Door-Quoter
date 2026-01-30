// BOM PDF Generation Utility
// Generates professional Bill of Materials PDFs with sections per component,
// part tables, and summary sections

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { downloadFile } from './gcs-storage'

export interface BomPdfItem {
  partNumber: string
  partName: string
  partType: string
  quantity: number
  cutLength: string | number | null
  percentOfStock?: string | null
  isMilled?: boolean
  unit: string
  color?: string
}

export interface BomPdfComponent {
  productName: string
  width: number
  height: number
  finishColor: string
  glassType: string | null
  quantity: number
  hardware?: string[]
  items: BomPdfItem[]
}

export interface BomPdfData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  components: BomPdfComponent[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

// Colors
const HEADER_COLOR: [number, number, number] = [79, 70, 229] // Indigo

/**
 * Creates a BOM PDF with component sections and part tables
 */
export async function createBomPDF(data: BomPdfData): Promise<Buffer> {
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
      console.error('Error adding company logo to BOM PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Bill of Materials', MARGIN, yPos + 5)
  yPos += 12

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Customer name if available
  if (data.customerName) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(data.customerName, MARGIN, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 5
  }

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.components.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No components found in this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths for table
  const partNumberWidth = 50
  const partNameWidth = 50
  const partTypeWidth = 22
  const cutLengthWidth = 22
  const qtyWidth = 12
  const unitWidth = 15
  const milledWidth = 14

  const rowHeight = 7
  const headerHeight = 7

  // Helper function to render component header
  const renderComponentHeader = (component: BomPdfComponent, continued = false) => {
    // Component section header with indigo background
    pdf.setFillColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 9, 'F')

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)

    const headerText = continued
      ? `${component.productName} (continued)`
      : `${component.productName} - ${component.width}" × ${component.height}"`
    pdf.text(headerText, MARGIN + 3, yPos + 6)

    // Right side: finish, glass, quantity
    const rightInfo = continued
      ? ''
      : `${component.finishColor} | ${component.glassType || 'No Glass'} | Qty: ${component.quantity}`
    if (rightInfo) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(rightInfo, PAGE_WIDTH - MARGIN - 3, yPos + 6, { align: 'right' })
    }

    pdf.setTextColor(0, 0, 0)
    yPos += 11

    // Table header
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('Part Number', xPos, yPos + 5)
    xPos += partNumberWidth
    pdf.text('Part Name', xPos, yPos + 5)
    xPos += partNameWidth
    pdf.text('Type', xPos, yPos + 5)
    xPos += partTypeWidth
    pdf.text('Cut Length', xPos, yPos + 5)
    xPos += cutLengthWidth
    pdf.text('Qty', xPos, yPos + 5)
    xPos += qtyWidth
    pdf.text('Unit', xPos, yPos + 5)
    xPos += unitWidth
    pdf.text('Milled', xPos, yPos + 5)

    yPos += headerHeight
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)
  }

  // Summary tracking
  const partTypeSummary: Record<string, number> = {}
  let totalParts = 0

  // Render each component section
  for (const component of data.components) {
    // Check if we need a new page (header + at least 3 rows should fit)
    if (yPos + headerHeight + rowHeight * 3 + 18 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    renderComponentHeader(component)

    // Table rows
    for (let i = 0; i < component.items.length; i++) {
      const item = component.items[i]

      // Check if we need a new page
      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN
        renderComponentHeader(component, true)
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(7)
      let xPos = MARGIN + 2

      // Part Number (monospace style)
      pdf.setFont('courier', 'normal')
      const partNumber = truncateText(pdf, item.partNumber, partNumberWidth - 4)
      pdf.text(partNumber, xPos, yPos + 5)
      xPos += partNumberWidth

      // Part Name
      pdf.setFont('helvetica', 'normal')
      const partName = truncateText(pdf, item.partName, partNameWidth - 4)
      pdf.text(partName, xPos, yPos + 5)
      xPos += partNameWidth

      // Part Type
      pdf.text(truncateText(pdf, item.partType, partTypeWidth - 4), xPos, yPos + 5)
      xPos += partTypeWidth

      // Cut Length
      let cutLengthStr = ''
      if (item.cutLength !== null && item.cutLength !== undefined) {
        if (typeof item.cutLength === 'number') {
          cutLengthStr = item.cutLength.toFixed(3)
        } else {
          cutLengthStr = item.cutLength
        }
      }
      pdf.text(cutLengthStr, xPos, yPos + 5)
      xPos += cutLengthWidth

      // Quantity
      pdf.setFont('helvetica', 'bold')
      pdf.text(item.quantity.toString(), xPos + 5, yPos + 5, { align: 'center' })
      xPos += qtyWidth

      // Unit
      pdf.setFont('helvetica', 'normal')
      pdf.text(item.unit || 'EA', xPos, yPos + 5)
      xPos += unitWidth

      // Milled (only for extrusions)
      if (item.partType === 'Extrusion' || item.partType === 'CutStock') {
        const milledText = item.isMilled !== false ? 'Yes' : 'No'
        pdf.text(milledText, xPos, yPos + 5)
      }

      yPos += rowHeight

      // Track summary
      const typeName = item.partType || 'Other'
      partTypeSummary[typeName] = (partTypeSummary[typeName] || 0) + (item.quantity * component.quantity)
      totalParts += item.quantity * component.quantity
    }

    // Add hardware info if available
    if (component.hardware && component.hardware.length > 0) {
      yPos += 2
      pdf.setFontSize(7)
      pdf.setTextColor(59, 130, 246) // Blue
      pdf.text(`Hardware: ${component.hardware.join(', ')}`, MARGIN + 2, yPos + 3)
      pdf.setTextColor(0, 0, 0)
      yPos += 5
    }

    // Space between component sections
    yPos += 6
  }

  // Summary section
  if (yPos + 40 > PAGE_HEIGHT - MARGIN) {
    pdf.addPage()
    yPos = MARGIN
  }

  yPos += 5
  pdf.setDrawColor(200, 200, 200)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 8

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Summary', MARGIN, yPos)
  yPos += 7

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  // Total components
  const totalComponents = data.components.reduce((sum, c) => sum + c.quantity, 0)
  pdf.text(`Total Components: ${totalComponents}`, MARGIN, yPos)
  yPos += 5

  // Parts by type
  const typeOrder = ['Extrusion', 'CutStock', 'Hardware', 'Glass', 'Option']
  const sortedTypes = Object.entries(partTypeSummary).sort((a, b) => {
    const aOrder = typeOrder.indexOf(a[0])
    const bOrder = typeOrder.indexOf(b[0])
    return (aOrder === -1 ? 99 : aOrder) - (bOrder === -1 ? 99 : bOrder)
  })

  for (const [typeName, count] of sortedTypes) {
    pdf.text(`${typeName}: ${Math.round(count)}`, MARGIN + 10, yPos)
    yPos += 5
  }

  // Total parts
  pdf.setFont('helvetica', 'bold')
  pdf.text(`Total Parts: ${Math.round(totalParts)}`, MARGIN, yPos)

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

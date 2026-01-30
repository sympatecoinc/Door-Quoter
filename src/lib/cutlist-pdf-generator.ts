// Cut List PDF Generation Utility
// Generates production-ready Cut List PDFs with check-off boxes,
// sections grouped by Product + Size, and batch handling

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { downloadFile } from './gcs-storage'

export interface CutListPdfItem {
  partNumber: string
  partName: string
  cutLength: number | null
  qtyPerUnit: number
  totalQty: number
  isMilled?: boolean
  binLocation?: string | null
  stockLength?: number | null
  color?: string
}

export interface CutListPdfGroup {
  productName: string
  sizeKey: string
  unitCount: number
  items: CutListPdfItem[]
}

export interface CutListPdfData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  groups: CutListPdfGroup[]
  generatedDate: string
  batchSize?: number
  totalUnits?: number
  remainder?: number
  remainderItems?: CutListPdfItem[]
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

// Colors
const HEADER_COLOR: [number, number, number] = [249, 115, 22] // Orange

/**
 * Creates a Cut List PDF with check-off boxes and batch columns
 */
export async function createCutListPDF(data: CutListPdfData): Promise<Buffer> {
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
      console.error('Error adding company logo to Cut List PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Cut List', MARGIN, yPos + 5)
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

  // Batch info if applicable
  const totalUnits = data.totalUnits || data.groups[0]?.unitCount || 1
  const batchSize = data.batchSize || totalUnits
  const hasBatches = batchSize < totalUnits

  if (hasBatches) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(249, 115, 22) // Orange
    const numBatches = Math.ceil(totalUnits / batchSize)
    const remainder = totalUnits % batchSize
    let batchText = `Batch Size: ${batchSize} unit${batchSize !== 1 ? 's' : ''} (${numBatches} batch${numBatches !== 1 ? 'es' : ''})`
    if (remainder > 0) {
      batchText += ` - Remainder: ${remainder} unit${remainder !== 1 ? 's' : ''}`
    }
    pdf.text(batchText, MARGIN, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 6
  }

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.groups.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No cut list items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths for table
  const checkWidth = 8
  const partNumberWidth = 45
  const partNameWidth = 40
  const cutLengthWidth = 22
  const qtyPerUnitWidth = 18
  const totalQtyWidth = 18
  const milledWidth = 16
  const binWidth = 18

  const rowHeight = 7
  const headerHeight = 7
  const checkboxSize = 4

  // Helper function to draw a checkbox
  const drawCheckbox = (x: number, y: number, size: number) => {
    pdf.setDrawColor(100, 100, 100)
    pdf.setLineWidth(0.3)
    pdf.rect(x, y, size, size, 'S')
  }

  // Helper function to render group header and table header
  const renderGroupHeader = (group: CutListPdfGroup, continued = false) => {
    // Group section header with orange background
    pdf.setFillColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 9, 'F')

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)

    const sizeDisplay = group.sizeKey.replace('x', '" × ') + '"'
    const headerText = continued
      ? `${group.productName} - ${sizeDisplay} (continued)`
      : `${group.productName} - ${sizeDisplay}`
    pdf.text(headerText, MARGIN + 3, yPos + 6)

    // Right side: unit count
    if (!continued) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(`${group.unitCount} unit${group.unitCount !== 1 ? 's' : ''}`, PAGE_WIDTH - MARGIN - 3, yPos + 6, { align: 'right' })
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
    pdf.text('', xPos, yPos + 5) // Check column (no header text)
    xPos += checkWidth
    pdf.text('Part Number', xPos, yPos + 5)
    xPos += partNumberWidth
    pdf.text('Part Name', xPos, yPos + 5)
    xPos += partNameWidth
    pdf.text('Cut (in)', xPos, yPos + 5)
    xPos += cutLengthWidth
    pdf.text('Qty/Unit', xPos, yPos + 5)
    xPos += qtyPerUnitWidth
    pdf.text('Total Qty', xPos, yPos + 5)
    xPos += totalQtyWidth
    pdf.text('Machined', xPos, yPos + 5)
    xPos += milledWidth
    pdf.text('Bin', xPos, yPos + 5)

    yPos += headerHeight
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)
  }

  // Summary tracking
  let totalParts = 0
  let totalUniqueCuts = 0

  // Render each group section
  for (const group of data.groups) {
    // Check if we need a new page (header + at least 3 rows should fit)
    if (yPos + headerHeight + rowHeight * 3 + 18 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    renderGroupHeader(group)
    totalUniqueCuts += group.items.length

    // Table rows
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i]

      // Check if we need a new page
      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN
        renderGroupHeader(group, true)
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 250)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(7)
      let xPos = MARGIN + 2

      // Checkbox
      drawCheckbox(xPos + 1, yPos + 1.5, checkboxSize)
      xPos += checkWidth

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

      // Cut Length
      let cutLengthStr = ''
      if (item.cutLength !== null && item.cutLength !== undefined) {
        cutLengthStr = item.cutLength.toFixed(3)
      }
      pdf.text(cutLengthStr, xPos, yPos + 5)
      xPos += cutLengthWidth

      // Qty Per Unit
      pdf.setFont('helvetica', 'bold')
      pdf.text(item.qtyPerUnit.toString(), xPos + 8, yPos + 5, { align: 'center' })
      xPos += qtyPerUnitWidth

      // Total Qty
      pdf.text(item.totalQty.toString(), xPos + 8, yPos + 5, { align: 'center' })
      xPos += totalQtyWidth

      // Machined/Milled
      pdf.setFont('helvetica', 'normal')
      const milledText = item.isMilled !== false ? 'Yes' : 'No'
      pdf.text(milledText, xPos, yPos + 5)
      xPos += milledWidth

      // Bin Location
      const binText = item.binLocation || '-'
      pdf.text(truncateText(pdf, binText, binWidth - 4), xPos, yPos + 5)

      yPos += rowHeight
      totalParts += item.totalQty
    }

    // Space between group sections
    yPos += 6
  }

  // Remainder section if applicable
  if (data.remainder && data.remainder > 0 && data.remainderItems && data.remainderItems.length > 0) {
    if (yPos + headerHeight + rowHeight * 3 + 18 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    // Remainder header
    pdf.setFillColor(234, 179, 8) // Yellow/amber
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 9, 'F')

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(`Remainder Batch - ${data.remainder} unit${data.remainder !== 1 ? 's' : ''}`, MARGIN + 3, yPos + 6)
    pdf.setTextColor(0, 0, 0)
    yPos += 11

    // Table header for remainder
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('', xPos, yPos + 5)
    xPos += checkWidth
    pdf.text('Part Number', xPos, yPos + 5)
    xPos += partNumberWidth
    pdf.text('Part Name', xPos, yPos + 5)
    xPos += partNameWidth
    pdf.text('Cut (in)', xPos, yPos + 5)
    xPos += cutLengthWidth
    pdf.text('Qty/Unit', xPos, yPos + 5)
    xPos += qtyPerUnitWidth
    pdf.text('Total Qty', xPos, yPos + 5)
    xPos += totalQtyWidth
    pdf.text('Machined', xPos, yPos + 5)
    xPos += milledWidth
    pdf.text('Bin', xPos, yPos + 5)

    yPos += headerHeight
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)

    // Remainder rows
    for (let i = 0; i < data.remainderItems.length; i++) {
      const item = data.remainderItems[i]

      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN
      }

      if (i % 2 === 0) {
        pdf.setFillColor(255, 251, 235) // Light yellow background for remainder
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(7)
      let xPos = MARGIN + 2

      drawCheckbox(xPos + 1, yPos + 1.5, checkboxSize)
      xPos += checkWidth

      pdf.setFont('courier', 'normal')
      pdf.text(truncateText(pdf, item.partNumber, partNumberWidth - 4), xPos, yPos + 5)
      xPos += partNumberWidth

      pdf.setFont('helvetica', 'normal')
      pdf.text(truncateText(pdf, item.partName, partNameWidth - 4), xPos, yPos + 5)
      xPos += partNameWidth

      let cutLengthStr = ''
      if (item.cutLength !== null && item.cutLength !== undefined) {
        cutLengthStr = item.cutLength.toFixed(3)
      }
      pdf.text(cutLengthStr, xPos, yPos + 5)
      xPos += cutLengthWidth

      pdf.setFont('helvetica', 'bold')
      pdf.text(item.qtyPerUnit.toString(), xPos + 8, yPos + 5, { align: 'center' })
      xPos += qtyPerUnitWidth

      pdf.text(item.totalQty.toString(), xPos + 8, yPos + 5, { align: 'center' })
      xPos += totalQtyWidth

      pdf.setFont('helvetica', 'normal')
      pdf.text(item.isMilled !== false ? 'Yes' : 'No', xPos, yPos + 5)
      xPos += milledWidth

      pdf.text(truncateText(pdf, item.binLocation || '-', binWidth - 4), xPos, yPos + 5)

      yPos += rowHeight
    }

    yPos += 6
  }

  // Summary section
  if (yPos + 35 > PAGE_HEIGHT - MARGIN) {
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

  pdf.text(`Total Parts: ${totalParts}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Unique Cuts: ${totalUniqueCuts}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Product Groups: ${data.groups.length}`, MARGIN, yPos)

  if (hasBatches) {
    yPos += 5
    const numBatches = Math.ceil(totalUnits / batchSize)
    const remainder = totalUnits % batchSize
    pdf.text(`Batches: ${numBatches} (${batchSize} units each${remainder > 0 ? `, last batch: ${remainder} units` : ''})`, MARGIN, yPos)
  }

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

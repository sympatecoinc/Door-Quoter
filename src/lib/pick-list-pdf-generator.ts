// Pick List PDF Generation Utility
// Generates a professional pick list PDF showing hardware items grouped by station
// with batch columns and checkboxes for tracking picked items

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { downloadFile } from './gcs-storage'

export interface PickListItem {
  station: string  // "Jamb Station" or "Assembly"
  partNumber: string
  partName: string
  unit: string
  totalQuantity: number
  openings: string[]
}

export interface PickListData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  items: PickListItem[]
  generatedDate: string
  batchSize?: number | null
  totalUnits?: number  // Total number of units in the project
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Creates a Pick List PDF with batch columns and checkboxes
 */
export async function createPickListPDF(data: PickListData): Promise<Buffer> {
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
      console.error('Error adding company logo to Pick List PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Pick List', MARGIN, yPos + 5)
  yPos += 16

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Calculate batch info
  const totalUnits = data.totalUnits || 1
  const batchSize = data.batchSize && data.batchSize > 0 ? data.batchSize : totalUnits
  const numBatches = Math.ceil(totalUnits / batchSize)
  const hasBatches = batchSize < totalUnits && numBatches > 1

  // Batch size info
  if (hasBatches) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(79, 70, 229) // Indigo color
    pdf.text(`Batch Size: ${batchSize} unit${batchSize !== 1 ? 's' : ''} (${numBatches} batches)`, MARGIN, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 6
  }

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.items.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No pick list items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Group items by station (Jamb Station, Assembly)
  const groupedByStation: Record<string, PickListItem[]> = {}
  for (const item of data.items) {
    if (!groupedByStation[item.station]) {
      groupedByStation[item.station] = []
    }
    groupedByStation[item.station].push(item)
  }

  // Sort stations: Jamb Station first, then Assembly
  const stationOrder: Record<string, number> = { 'Jamb Station': 1, 'Assembly': 2 }
  const sortedStations = Object.keys(groupedByStation).sort((a, b) => {
    return (stationOrder[a] || 99) - (stationOrder[b] || 99)
  })

  // Dynamic column widths based on number of batches
  // Base columns: Part Number, Part Name, Unit
  // Then batch columns with checkboxes
  const maxBatchColumns = 8 // Maximum batch columns per row
  const batchColWidth = 18 // Width for each batch column (checkbox + qty)
  const partNumberWidth = 45
  const partNameWidth = hasBatches
    ? Math.max(40, CONTENT_WIDTH - partNumberWidth - 15 - (Math.min(numBatches, maxBatchColumns) * batchColWidth))
    : 90
  const unitWidth = 15

  const rowHeight = 8
  const headerHeight = 8
  const checkboxSize = 4

  // Station colors: Jamb Station = purple, Assembly = blue
  const stationColors: Record<string, [number, number, number]> = {
    'Jamb Station': [147, 51, 234],  // Purple
    'Assembly': [59, 130, 246]       // Blue
  }

  // Helper function to draw a checkbox
  const drawCheckbox = (x: number, y: number, size: number) => {
    pdf.setDrawColor(100, 100, 100)
    pdf.setLineWidth(0.3)
    pdf.rect(x, y, size, size, 'S')
  }

  // Helper function to render table header
  const renderTableHeader = (stationColor: [number, number, number], stationName: string, continued = false) => {
    // Station group header
    pdf.setFillColor(stationColor[0], stationColor[1], stationColor[2])
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(continued ? `${stationName} (continued)` : stationName, MARGIN + 3, yPos + 5.5)
    pdf.setTextColor(0, 0, 0)
    yPos += 10

    // Table header
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('Part Number', xPos, yPos + 5.5)
    xPos += partNumberWidth
    pdf.text('Part Name', xPos, yPos + 5.5)
    xPos += partNameWidth

    if (hasBatches) {
      // Batch column headers
      const batchesToShow = Math.min(numBatches, maxBatchColumns)
      for (let b = 0; b < batchesToShow; b++) {
        pdf.text(`B${b + 1}`, xPos + batchColWidth / 2, yPos + 5.5, { align: 'center' })
        xPos += batchColWidth
      }
    } else {
      pdf.text('Qty', xPos, yPos + 5.5)
      xPos += 20
    }

    pdf.text('Unit', xPos, yPos + 5.5)

    yPos += headerHeight
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)
  }

  // Render each station group (in order: Jamb Station, Assembly)
  for (const stationName of sortedStations) {
    const items = groupedByStation[stationName]
    const stationColor = stationColors[stationName] || [79, 70, 229]

    // Check if we need a new page (header + at least 3 rows should fit)
    if (yPos + headerHeight + rowHeight * 3 + 15 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    renderTableHeader(stationColor, stationName)

    // Table rows
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Check if we need a new page
      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN
        renderTableHeader(stationColor, stationName, true)
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
      pdf.text(partNumber, xPos, yPos + 5.5)
      xPos += partNumberWidth

      // Part Name
      pdf.setFont('helvetica', 'normal')
      const partName = truncateText(pdf, item.partName, partNameWidth - 4)
      pdf.text(partName, xPos, yPos + 5.5)
      xPos += partNameWidth

      if (hasBatches) {
        // Calculate quantity per batch
        const qtyPerUnit = item.totalQuantity / totalUnits
        const qtyPerBatch = Math.round(qtyPerUnit * batchSize * 100) / 100

        // Handle remainder for last batch
        const lastBatchUnits = totalUnits % batchSize || batchSize
        const lastBatchQty = Math.round(qtyPerUnit * lastBatchUnits * 100) / 100

        const batchesToShow = Math.min(numBatches, maxBatchColumns)
        for (let b = 0; b < batchesToShow; b++) {
          const isLastBatch = b === numBatches - 1
          const batchQty = isLastBatch && (totalUnits % batchSize !== 0) ? lastBatchQty : qtyPerBatch

          // Draw checkbox
          drawCheckbox(xPos + 2, yPos + 2, checkboxSize)

          // Draw quantity next to checkbox
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(7)
          const qtyStr = Number.isInteger(batchQty) ? batchQty.toString() : batchQty.toFixed(1)
          pdf.text(qtyStr, xPos + checkboxSize + 4, yPos + 5.5)

          xPos += batchColWidth
        }

        // If more batches than can fit, add indicator
        if (numBatches > maxBatchColumns) {
          pdf.setFontSize(6)
          pdf.setTextColor(100, 100, 100)
          pdf.text(`+${numBatches - maxBatchColumns}`, xPos - 5, yPos + 5.5)
          pdf.setTextColor(0, 0, 0)
        }
      } else {
        // Single quantity column (no batches)
        pdf.setFont('helvetica', 'bold')
        pdf.text(item.totalQuantity.toString(), xPos + 15, yPos + 5.5, { align: 'right' })
        xPos += 20
      }

      // Unit
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.text(item.unit || 'EA', xPos, yPos + 5.5)

      yPos += rowHeight
    }

    // Add space between station groups
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

  const totalItems = data.items.reduce((sum, item) => sum + item.totalQuantity, 0)
  const stationCount = sortedStations.length

  pdf.text(`Total Items: ${totalItems}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Stations: ${stationCount}`, MARGIN, yPos)
  if (hasBatches) {
    yPos += 5
    pdf.text(`Batches: ${numBatches} (${batchSize} units each${totalUnits % batchSize !== 0 ? `, last batch: ${totalUnits % batchSize} units` : ''})`, MARGIN, yPos)
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

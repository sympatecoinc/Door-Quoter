// Jamb Kit List PDF Generation Utility
// Generates a professional jamb kit list PDF showing items grouped by opening

import { jsPDF } from 'jspdf'

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

  // Title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Jamb Kit List', PAGE_WIDTH / 2, yPos, { align: 'center' })
  yPos += 8

  // Customer name (if available)
  if (data.customerName) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(data.customerName, PAGE_WIDTH / 2, yPos, { align: 'center' })
    yPos += 6
  }

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.projectName, PAGE_WIDTH / 2, yPos, { align: 'center' })
  yPos += 6

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}`, PAGE_WIDTH / 2, yPos, { align: 'center' })
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

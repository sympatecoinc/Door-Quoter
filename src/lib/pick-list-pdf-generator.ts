// Pick List PDF Generation Utility
// Generates a professional pick list PDF showing hardware items grouped by product

import { jsPDF } from 'jspdf'

export interface PickListItem {
  productName: string
  partNumber: string
  partName: string
  unit: string
  includeInJambKit: boolean
  totalQuantity: number
  openings: string[]
}

export interface PickListData {
  projectName: string
  customerName?: string
  items: PickListItem[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Creates a Pick List PDF
 */
export async function createPickListPDF(data: PickListData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  let yPos = MARGIN

  // Title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Pick List', PAGE_WIDTH / 2, yPos, { align: 'center' })
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

  if (data.items.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No pick list items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Group items by product
  const groupedByProduct: Record<string, PickListItem[]> = {}
  for (const item of data.items) {
    if (!groupedByProduct[item.productName]) {
      groupedByProduct[item.productName] = []
    }
    groupedByProduct[item.productName].push(item)
  }

  // Column widths (no openings column)
  const colWidths = {
    partNumber: 55,
    partName: 75,
    qty: 25,
    unit: 25,
    jambKit: 25
  }

  const rowHeight = 7
  const headerHeight = 8

  // Render each product group
  for (const [productName, items] of Object.entries(groupedByProduct)) {
    // Check if we need a new page (header + at least 3 rows should fit)
    if (yPos + headerHeight + rowHeight * 3 + 15 > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
    }

    // Product group header
    pdf.setFillColor(79, 70, 229) // Indigo color
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(productName, MARGIN + 3, yPos + 5.5)
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
    xPos += colWidths.unit
    pdf.text('Jamb Kit', xPos, yPos + 5.5)

    yPos += headerHeight

    // Table rows
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(0, 0, 0)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      // Check if we need a new page
      if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
        pdf.addPage()
        yPos = MARGIN

        // Re-draw product header on new page
        pdf.setFillColor(79, 70, 229)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text(`${productName} (continued)`, MARGIN + 3, yPos + 5.5)
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
        xPos += colWidths.unit
        pdf.text('Jamb Kit', xPos, yPos + 5.5)

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
      xPos += colWidths.unit

      // Jamb Kit badge
      if (item.includeInJambKit) {
        pdf.setFillColor(16, 185, 129) // Green
        pdf.roundedRect(xPos, yPos + 1.5, 14, 4, 1, 1, 'F')
        pdf.setFontSize(6)
        pdf.setTextColor(255, 255, 255)
        pdf.text('Yes', xPos + 7, yPos + 4.5, { align: 'center' })
        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(8)
      } else {
        pdf.setFontSize(7)
        pdf.setTextColor(150, 150, 150)
        pdf.text('No', xPos + 2, yPos + 5)
        pdf.setTextColor(0, 0, 0)
        pdf.setFontSize(8)
      }

      yPos += rowHeight
    }

    // Add space between product groups
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
  const jambKitItems = data.items.filter(item => item.includeInJambKit).reduce((sum, item) => sum + item.totalQuantity, 0)
  const productCount = Object.keys(groupedByProduct).length

  pdf.text(`Total Items: ${totalItems}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Jamb Kit Items: ${jambKitItems}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Product Types: ${productCount}`, MARGIN, yPos)

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

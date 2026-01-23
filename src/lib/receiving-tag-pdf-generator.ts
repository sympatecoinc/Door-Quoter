// Receiving Box Tag PDF Generation Utility
// Generates 8.5x11 tags to put in received boxes
// Shows PO number, vendor, items with quantities, and box number (X of Y)

import { jsPDF } from 'jspdf'

export interface ReceivingTagItem {
  name: string
  sku?: string | null
  quantity: number
}

export interface ReceivingTagData {
  poNumber: string
  vendorName: string
  items: ReceivingTagItem[]
  boxNumber: number
  totalBoxes: number
  receivedDate: string
}

const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 20

/**
 * Creates a single-page receiving tag PDF
 */
export async function createReceivingTagPDF(data: ReceivingTagData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const contentWidth = PAGE_WIDTH - 2 * MARGIN
  let y = MARGIN

  // Header with box number
  pdf.setFontSize(42)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text(`Box ${data.boxNumber} of ${data.totalBoxes}`, PAGE_WIDTH / 2, y + 12, { align: 'center' })

  y += 25

  // PO Number
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PO Number:', MARGIN, y)
  pdf.setFontSize(24)
  pdf.text(data.poNumber, MARGIN, y + 10)

  y += 20

  // Vendor
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Vendor:', MARGIN, y)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.vendorName, MARGIN, y + 8)

  y += 18

  // Received Date
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Received:', MARGIN, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.receivedDate, MARGIN + 25, y)

  y += 12

  // Divider line
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  y += 8

  // Items Header
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Items:', MARGIN, y)

  y += 8

  // Items table header
  pdf.setFillColor(245, 245, 245)
  pdf.rect(MARGIN, y, contentWidth, 8, 'F')
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Item', MARGIN + 3, y + 5.5)
  pdf.text('SKU', MARGIN + 95, y + 5.5)
  pdf.text('Qty', PAGE_WIDTH - MARGIN - 15, y + 5.5, { align: 'right' })

  y += 10

  // Items list
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)

  const maxItemsPerPage = 20
  const itemsToShow = data.items.slice(0, maxItemsPerPage)

  for (const item of itemsToShow) {
    if (y > PAGE_HEIGHT - 40) break // Leave room for footer

    // Item name (may wrap)
    const nameLines = pdf.splitTextToSize(item.name, 85)
    pdf.text(nameLines[0], MARGIN + 3, y + 4)

    // SKU
    if (item.sku) {
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(item.sku, MARGIN + 95, y + 4)
      pdf.setFontSize(11)
      pdf.setTextColor(0, 0, 0)
    }

    // Quantity
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.quantity.toString(), PAGE_WIDTH - MARGIN - 15, y + 4, { align: 'right' })
    pdf.setFont('helvetica', 'normal')

    // Row separator
    y += 8
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 2
  }

  if (data.items.length > maxItemsPerPage) {
    y += 5
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`... and ${data.items.length - maxItemsPerPage} more items`, MARGIN + 3, y)
  }

  // Footer
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text(
    `Generated ${new Date().toLocaleString()}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 10,
    { align: 'center' }
  )

  return Buffer.from(pdf.output('arraybuffer'))
}

/**
 * Creates a multi-page PDF with one tag per page for each box
 */
export async function createReceivingTagsPDF(
  poNumber: string,
  vendorName: string,
  items: ReceivingTagItem[],
  totalBoxes: number
): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const receivedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  for (let boxNum = 1; boxNum <= totalBoxes; boxNum++) {
    if (boxNum > 1) {
      pdf.addPage()
    }

    const data: ReceivingTagData = {
      poNumber,
      vendorName,
      items,
      boxNumber: boxNum,
      totalBoxes,
      receivedDate
    }

    drawReceivingTag(pdf, data)
  }

  return Buffer.from(pdf.output('arraybuffer'))
}

/**
 * Draws a single receiving tag on the current page
 */
function drawReceivingTag(pdf: jsPDF, data: ReceivingTagData): void {
  const contentWidth = PAGE_WIDTH - 2 * MARGIN
  let y = MARGIN

  // Header with box number
  pdf.setFontSize(42)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text(`Box ${data.boxNumber} of ${data.totalBoxes}`, PAGE_WIDTH / 2, y + 12, { align: 'center' })

  y += 25

  // PO Number
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PO Number:', MARGIN, y)
  pdf.setFontSize(24)
  pdf.text(data.poNumber, MARGIN, y + 10)

  y += 20

  // Vendor
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Vendor:', MARGIN, y)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.vendorName, MARGIN, y + 8)

  y += 18

  // Received Date
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Received:', MARGIN, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.receivedDate, MARGIN + 25, y)

  y += 12

  // Divider line
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)

  y += 8

  // Items Header
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Items:', MARGIN, y)

  y += 8

  // Items table header
  pdf.setFillColor(245, 245, 245)
  pdf.rect(MARGIN, y, contentWidth, 8, 'F')
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Item', MARGIN + 3, y + 5.5)
  pdf.text('SKU', MARGIN + 95, y + 5.5)
  pdf.text('Qty', PAGE_WIDTH - MARGIN - 15, y + 5.5, { align: 'right' })

  y += 10

  // Items list
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)

  const maxItemsPerPage = 20
  const itemsToShow = data.items.slice(0, maxItemsPerPage)

  for (const item of itemsToShow) {
    if (y > PAGE_HEIGHT - 40) break // Leave room for footer

    // Item name (may wrap)
    const nameLines = pdf.splitTextToSize(item.name, 85)
    pdf.text(nameLines[0], MARGIN + 3, y + 4)

    // SKU
    if (item.sku) {
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(item.sku, MARGIN + 95, y + 4)
      pdf.setFontSize(11)
      pdf.setTextColor(0, 0, 0)
    }

    // Quantity
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.quantity.toString(), PAGE_WIDTH - MARGIN - 15, y + 4, { align: 'right' })
    pdf.setFont('helvetica', 'normal')

    // Row separator
    y += 8
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 2
  }

  if (data.items.length > maxItemsPerPage) {
    y += 5
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`... and ${data.items.length - maxItemsPerPage} more items`, MARGIN + 3, y)
  }

  // Footer
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text(
    `Generated ${new Date().toLocaleString()}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 10,
    { align: 'center' }
  )
}

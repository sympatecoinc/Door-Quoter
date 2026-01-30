/**
 * Extrusion Tag PDF Generator
 * Generates tags for extrusion bundles with color stripes, part info, and QR codes
 */

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export interface ExtrusionTagData {
  workOrderId: string
  projectName: string
  projectColor: string // Hex color for visual identification
  partNumber: string
  partName: string
  cutLength: number | null
  stockLength: number | null
  quantity: number
  openings: string[] // List of opening names using this cut
  batchNumber: number
  totalBatches?: number
  binLocation?: string | null
}

// Page layout constants (4 tags per page - 2x2)
const TAGS_PER_PAGE = 4
const COLS = 2
const ROWS = 2
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const TAG_WIDTH = 101.6 // 4" in mm
const TAG_HEIGHT = 127 // 5" in mm
const MARGIN_X = (PAGE_WIDTH - COLS * TAG_WIDTH) / 2
const MARGIN_Y = (PAGE_HEIGHT - ROWS * TAG_HEIGHT) / 2

/**
 * Generates a QR code as a data URL
 */
async function generateQRCodeDataUrl(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
  } catch (error) {
    console.error('Error generating QR code:', error)
    return ''
  }
}

/**
 * Format length in inches (always show in inches, not feet)
 */
function formatLength(inches: number | null): string {
  if (!inches) return '-'
  // Always show in inches
  return `${inches.toFixed(3)}"`
}

/**
 * Draws a single tag at the specified grid position
 */
async function drawTag(
  pdf: jsPDF,
  tag: ExtrusionTagData,
  qrDataUrl: string,
  col: number,
  row: number
): Promise<void> {
  const x = MARGIN_X + col * TAG_WIDTH
  const y = MARGIN_Y + row * TAG_HEIGHT
  const padding = 5

  // Draw tag border (dotted line for cutting)
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.3)
  pdf.setLineDashPattern([2, 2], 0)
  pdf.rect(x, y, TAG_WIDTH, TAG_HEIGHT)
  pdf.setLineDashPattern([], 0)

  // Color stripe at top (full width, 15mm tall)
  const stripeHeight = 15
  const hexColor = tag.projectColor || '#3B82F6'
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  pdf.setFillColor(r, g, b)
  pdf.rect(x, y, TAG_WIDTH, stripeHeight, 'F')

  // Project name in color stripe
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  // Calculate contrast color for text
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance > 0.5) {
    pdf.setTextColor(0, 0, 0)
  } else {
    pdf.setTextColor(255, 255, 255)
  }
  pdf.text(tag.projectName, x + TAG_WIDTH / 2, y + stripeHeight / 2 + 2, { align: 'center' })

  // Content area
  const contentX = x + padding
  let contentY = y + stripeHeight + padding

  // Part number (large, prominent)
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Part:', contentX, contentY + 5)
  pdf.setFontSize(12)
  pdf.setFont('courier', 'bold')
  const partNumLines = pdf.splitTextToSize(tag.partNumber, TAG_WIDTH - 2 * padding - 15)
  pdf.text(partNumLines[0] || '', contentX + 15, contentY + 5)
  if (partNumLines[1]) {
    pdf.text(partNumLines[1], contentX + 15, contentY + 10)
    contentY += 5
  }
  contentY += 12

  // Part name
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(80, 80, 80)
  const partNameLines = pdf.splitTextToSize(tag.partName, TAG_WIDTH - 2 * padding)
  pdf.text(partNameLines.slice(0, 2), contentX, contentY)
  contentY += partNameLines.length > 1 ? 10 : 6

  // Divider line
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.3)
  pdf.line(contentX, contentY, x + TAG_WIDTH - padding, contentY)
  contentY += 5

  // Cut length (large, important)
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Cut Length:', contentX, contentY + 4)
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(37, 99, 235) // Blue for emphasis
  pdf.text(formatLength(tag.cutLength), contentX + 28, contentY + 4)
  contentY += 10

  // Stock length
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Stock:', contentX, contentY + 4)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(tag.stockLength ? `${tag.stockLength}"` : '-', contentX + 18, contentY + 4)
  contentY += 9

  // Quantity
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Qty:', contentX, contentY + 4)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${tag.quantity} pcs`, contentX + 12, contentY + 4)
  contentY += 10

  // Bin location (if available)
  if (tag.binLocation) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(`Bin: ${tag.binLocation}`, contentX, contentY + 3)
    contentY += 6
  }

  // Divider line
  pdf.setDrawColor(200, 200, 200)
  pdf.line(contentX, contentY, x + TAG_WIDTH - padding, contentY)
  contentY += 4

  // Openings list
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Openings:', contentX, contentY + 3)
  contentY += 5

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(60, 60, 60)
  const openingsText = tag.openings.slice(0, 6).join(', ')
  const openingsLines = pdf.splitTextToSize(openingsText, TAG_WIDTH - 2 * padding - 30)
  pdf.text(openingsLines.slice(0, 2), contentX, contentY)
  if (tag.openings.length > 6) {
    pdf.text(`... +${tag.openings.length - 6} more`, contentX, contentY + (openingsLines.length > 1 ? 8 : 4))
  }

  // QR code (bottom right)
  const qrSize = 28
  const qrX = x + TAG_WIDTH - padding - qrSize
  const qrY = y + TAG_HEIGHT - padding - qrSize - 10

  if (qrDataUrl) {
    try {
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch (error) {
      console.error('Error adding QR code to PDF:', error)
    }
  }

  // Batch info (bottom left)
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  const batchText = tag.totalBatches
    ? `Batch ${tag.batchNumber} of ${tag.totalBatches}`
    : `Batch ${tag.batchNumber}`
  pdf.text(batchText, contentX, y + TAG_HEIGHT - padding - 4)

  // Work order ID (tiny, bottom)
  pdf.setFontSize(6)
  pdf.setTextColor(150, 150, 150)
  pdf.text(`WO: ${tag.workOrderId}`, contentX, y + TAG_HEIGHT - padding)
}

/**
 * Group work order items into tag bundles by part number and stock length
 */
export interface WorkOrderItemForTag {
  partNumber: string
  partName: string
  partType: string | null
  quantity: number
  cutLength: number | null
  stockLength: number | null
  binLocation: string | null
  openingName: string | null
}

export function groupItemsForTags(
  items: WorkOrderItemForTag[]
): Map<string, WorkOrderItemForTag[]> {
  // Group by partNumber + stockLength combination
  const groups = new Map<string, WorkOrderItemForTag[]>()

  for (const item of items) {
    // Only include extrusion items
    if (item.partType !== 'Extrusion') continue

    const key = `${item.partNumber}|${item.stockLength || 'unknown'}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  return groups
}

/**
 * Creates an extrusion tags PDF
 * @param workOrderId - Work order ID
 * @param projectName - Project name
 * @param projectColor - Hex color for project identification
 * @param items - Work order items (will be filtered to extrusions and grouped)
 * @param batchNumber - Current batch number
 * @param totalBatches - Optional total number of batches
 * @returns Buffer containing the PDF
 */
export async function createExtrusionTagsPDF(
  workOrderId: string,
  projectName: string,
  projectColor: string,
  items: WorkOrderItemForTag[],
  batchNumber: number,
  totalBatches?: number
): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  // Group items by part number and stock length
  const groups = groupItemsForTags(items)

  if (groups.size === 0) {
    // No extrusion items
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text('No extrusion items in work order', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Create tags from groups
  const tags: ExtrusionTagData[] = []

  for (const [key, groupItems] of groups) {
    const firstItem = groupItems[0]
    const totalQty = groupItems.reduce((sum, item) => sum + item.quantity, 0)
    const openings = [...new Set(groupItems.map(i => i.openingName).filter(Boolean) as string[])]

    tags.push({
      workOrderId,
      projectName,
      projectColor,
      partNumber: firstItem.partNumber,
      partName: firstItem.partName,
      cutLength: firstItem.cutLength,
      stockLength: firstItem.stockLength,
      quantity: totalQty,
      openings,
      batchNumber,
      totalBatches,
      binLocation: firstItem.binLocation
    })
  }

  // Sort tags by part number for consistency
  tags.sort((a, b) => a.partNumber.localeCompare(b.partNumber))

  // Generate QR codes for all tags
  // Format: WO:{workOrderId}|P:{partNumber}|B:{batchNumber}
  const qrCodes: string[] = []
  for (const tag of tags) {
    const qrData = `WO:${tag.workOrderId}|P:${tag.partNumber}|B:${tag.batchNumber}`
    const qrDataUrl = await generateQRCodeDataUrl(qrData)
    qrCodes.push(qrDataUrl)
  }

  // Process tags (4 per page)
  const totalPages = Math.ceil(tags.length / TAGS_PER_PAGE)

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage()
    }

    // Draw tags for this page
    const startIndex = page * TAGS_PER_PAGE
    const endIndex = Math.min(startIndex + TAGS_PER_PAGE, tags.length)

    for (let i = startIndex; i < endIndex; i++) {
      const positionOnPage = i - startIndex
      const col = positionOnPage % COLS
      const row = Math.floor(positionOnPage / COLS)

      await drawTag(pdf, tags[i], qrCodes[i], col, row)
    }

    // Page footer
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(150, 150, 150)
    pdf.text(
      `${projectName} - Extrusion Tags - Page ${page + 1} of ${totalPages}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 3,
      { align: 'center' }
    )
    pdf.setTextColor(0, 0, 0)
  }

  return Buffer.from(pdf.output('arraybuffer'))
}

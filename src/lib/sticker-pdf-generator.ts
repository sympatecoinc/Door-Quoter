// Sticker PDF Generation Utility
// Generates 6-up sticker PDFs for packing list items
// Each sticker includes opening name, item name, dimensions/part number, and QR code

import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export interface StickerData {
  openingName: string
  itemType: 'component' | 'hardware'
  itemName: string
  partNumber?: string | null
  quantity?: number
  dimensions?: string // For components: "36" x 84""
  unit?: string | null
}

// Page layout constants (6-up: 3 rows x 2 cols)
const STICKERS_PER_PAGE = 6
const COLS = 2
const ROWS = 3
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const STICKER_WIDTH = 88.9 // ~3.5" in mm (wider stickers)
const STICKER_HEIGHT = 76.2 // ~3" in mm (shorter stickers)
const MARGIN_X = (PAGE_WIDTH - COLS * STICKER_WIDTH) / 2
const MARGIN_Y = (PAGE_HEIGHT - ROWS * STICKER_HEIGHT) / 2

/**
 * Generates a QR code as a data URL
 */
async function generateQRCodeDataUrl(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 100,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
  } catch (error) {
    console.error('Error generating QR code:', error)
    // Return a simple placeholder if QR generation fails
    return ''
  }
}

/**
 * Draws a single sticker at the specified grid position
 */
function drawSticker(
  pdf: jsPDF,
  sticker: StickerData,
  qrDataUrl: string,
  col: number,
  row: number
): void {
  const x = MARGIN_X + col * STICKER_WIDTH
  const y = MARGIN_Y + row * STICKER_HEIGHT
  const padding = 4

  // Draw sticker border (dotted line for cutting)
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(0.3)
  pdf.setLineDashPattern([2, 2], 0)
  pdf.rect(x, y, STICKER_WIDTH, STICKER_HEIGHT)
  pdf.setLineDashPattern([], 0) // Reset to solid line

  // Inner content area
  const contentX = x + padding
  const contentY = y + padding
  const contentWidth = STICKER_WIDTH - 2 * padding
  const contentHeight = STICKER_HEIGHT - 2 * padding

  // Opening name header (prominent, at top)
  pdf.setFillColor(40, 40, 40)
  pdf.rect(contentX, contentY, contentWidth, 10, 'F')
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  const openingText = pdf.splitTextToSize(sticker.openingName, contentWidth - 4)
  pdf.text(openingText[0] || sticker.openingName, contentX + contentWidth / 2, contentY + 7, {
    align: 'center'
  })
  pdf.setTextColor(0, 0, 0)

  // Item type badge
  const badgeY = contentY + 14
  if (sticker.itemType === 'component') {
    pdf.setFillColor(59, 130, 246) // Blue for components
  } else {
    pdf.setFillColor(34, 197, 94) // Green for hardware
  }
  const badgeText = sticker.itemType === 'component' ? 'COMPONENT' : 'HARDWARE'
  const badgeWidth = pdf.getTextWidth(badgeText) + 6
  pdf.roundedRect(contentX, badgeY, badgeWidth, 5, 1, 1, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text(badgeText, contentX + 3, badgeY + 3.5)
  pdf.setTextColor(0, 0, 0)

  // Item name (main text)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  const itemNameY = badgeY + 10
  const itemNameLines = pdf.splitTextToSize(sticker.itemName, contentWidth - 30) // Leave space for QR
  pdf.text(itemNameLines.slice(0, 2), contentX, itemNameY) // Max 2 lines

  // Dimensions or Part Number
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  const detailY = itemNameY + (itemNameLines.length > 1 ? 10 : 5)

  if (sticker.itemType === 'component' && sticker.dimensions) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Size: ', contentX, detailY)
    pdf.setFont('helvetica', 'normal')
    const sizeWidth = pdf.getTextWidth('Size: ')
    pdf.text(sticker.dimensions, contentX + sizeWidth, detailY)
  }

  if (sticker.partNumber) {
    const pnY = sticker.itemType === 'component' && sticker.dimensions ? detailY + 5 : detailY
    pdf.setFont('helvetica', 'bold')
    pdf.text('PN: ', contentX, pnY)
    pdf.setFont('helvetica', 'normal')
    const pnWidth = pdf.getTextWidth('PN: ')
    pdf.text(sticker.partNumber, contentX + pnWidth, pnY)
  }

  // Quantity (for hardware)
  if (sticker.itemType === 'hardware' && sticker.quantity) {
    const qtyY = contentY + contentHeight - 8
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`QTY: ${sticker.quantity}${sticker.unit ? ' ' + sticker.unit : ''}`, contentX, qtyY)
  }

  // QR Code (bottom right)
  if (qrDataUrl) {
    const qrSize = 22
    const qrX = contentX + contentWidth - qrSize
    const qrY = contentY + contentHeight - qrSize - 2
    try {
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch (error) {
      console.error('Error adding QR code to PDF:', error)
    }
  }
}

/**
 * Draws dotted cut lines across the entire page
 */
function drawCutLines(pdf: jsPDF): void {
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.2)
  pdf.setLineDashPattern([3, 3], 0)

  // Vertical cut line (center)
  const centerX = PAGE_WIDTH / 2
  pdf.line(centerX, 5, centerX, PAGE_HEIGHT - 5)

  // Horizontal cut lines
  for (let row = 1; row < ROWS; row++) {
    const lineY = MARGIN_Y + row * STICKER_HEIGHT
    pdf.line(5, lineY, PAGE_WIDTH - 5, lineY)
  }

  // Top and bottom trim lines
  pdf.line(5, MARGIN_Y, PAGE_WIDTH - 5, MARGIN_Y)
  pdf.line(5, MARGIN_Y + ROWS * STICKER_HEIGHT, PAGE_WIDTH - 5, MARGIN_Y + ROWS * STICKER_HEIGHT)

  pdf.setLineDashPattern([], 0) // Reset to solid line
}

/**
 * Creates a stickers PDF with 6-up layout
 * @param projectName - Name of the project (for filename)
 * @param stickers - Array of sticker data
 * @returns Buffer containing the PDF
 */
export async function createStickersPDF(
  projectName: string,
  stickers: StickerData[]
): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  if (stickers.length === 0) {
    // Empty page with message
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'normal')
    pdf.text('No items in packing list', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Generate QR codes for all stickers first
  const qrCodes: string[] = []
  for (const sticker of stickers) {
    const qrData = [sticker.partNumber || '', sticker.openingName, sticker.itemName]
      .filter(Boolean)
      .join('|')
    const qrDataUrl = await generateQRCodeDataUrl(qrData)
    qrCodes.push(qrDataUrl)
  }

  // Process stickers in batches of 6 per page
  const totalPages = Math.ceil(stickers.length / STICKERS_PER_PAGE)

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) {
      pdf.addPage()
    }

    // Draw cut lines for this page
    drawCutLines(pdf)

    // Draw stickers for this page
    const startIndex = page * STICKERS_PER_PAGE
    const endIndex = Math.min(startIndex + STICKERS_PER_PAGE, stickers.length)

    for (let i = startIndex; i < endIndex; i++) {
      const positionOnPage = i - startIndex
      const col = positionOnPage % COLS
      const row = Math.floor(positionOnPage / COLS)

      drawSticker(pdf, stickers[i], qrCodes[i], col, row)
    }

    // Page footer
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(150, 150, 150)
    pdf.text(
      `${projectName} - Page ${page + 1} of ${totalPages}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 3,
      { align: 'center' }
    )
    pdf.setTextColor(0, 0, 0)
  }

  return Buffer.from(pdf.output('arraybuffer'))
}

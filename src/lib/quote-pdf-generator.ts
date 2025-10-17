// Quote PDF Generation Utility
// Uses jsPDF to create professional quote PDFs with optional attachments

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import { ensurePngDataUrl, isSvgDataUrl } from './svg-to-png'

export interface QuoteItem {
  openingId: number
  name: string
  description: string
  dimensions: string
  color: string
  hardware: string
  hardwarePrice: number
  glassType: string
  costPrice: number
  price: number
  elevationImages: string[]
}

export interface QuoteData {
  project: {
    id: number
    name: string
    status: string
    createdAt: string
    updatedAt: string
    pricingMode?: {
      name: string
      markup: number
      discount: number
    } | null
  }
  quoteItems: QuoteItem[]
  subtotal: number
  markupAmount: number
  discountAmount: number
  adjustedSubtotal: number
  taxRate: number
  taxAmount: number
  totalPrice: number
}

export interface QuoteAttachment {
  id: number
  filename: string
  originalName: string
  mimeType: string
  type: string
  displayOrder: number
  description?: string | null
}

/**
 * Creates a complete quote PDF with optional attachments
 */
export async function createQuotePDF(
  quoteData: QuoteData,
  attachments: QuoteAttachment[] = []
): Promise<jsPDF> {
  // Create PDF in landscape mode, letter size
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter'
  })

  // Page 1: Quote details with pricing
  await addQuotePage(pdf, quoteData)

  // Add attachment pages if any
  if (attachments.length > 0) {
    for (const attachment of attachments) {
      pdf.addPage()
      await addAttachmentPage(pdf, attachment, quoteData.project.id)
    }
  }

  return pdf
}

/**
 * Adds the main quote page with project info and line items
 */
async function addQuotePage(pdf: jsPDF, quoteData: QuoteData): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth() // 215.9mm for letter
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4mm for letter

  // Header section
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('JOB ESTIMATE', pageWidth / 2, 20, { align: 'center' })

  // Project information
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  const projectInfoY = 35

  // Left column
  pdf.setFont('helvetica', 'bold')
  pdf.text('Project:', 20, projectInfoY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quoteData.project.name, 45, projectInfoY)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Status:', 20, projectInfoY + 7)
  pdf.setFont('helvetica', 'normal')
  pdf.text(quoteData.project.status, 45, projectInfoY + 7)

  // Right column
  pdf.setFont('helvetica', 'bold')
  pdf.text('Date:', pageWidth - 70, projectInfoY)
  pdf.setFont('helvetica', 'normal')
  pdf.text(new Date().toLocaleDateString(), pageWidth - 45, projectInfoY)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Valid Until:', pageWidth - 70, projectInfoY + 7)
  pdf.setFont('helvetica', 'normal')
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  pdf.text(validUntil.toLocaleDateString(), pageWidth - 45, projectInfoY + 7)

  // Divider line
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(20, projectInfoY + 13, pageWidth - 20, projectInfoY + 13)

  // Quote items table
  const tableStartY = projectInfoY + 20
  await addQuoteItemsTable(pdf, quoteData, tableStartY)

  // Footer with totals
  addQuoteFooter(pdf, quoteData)
}

/**
 * Adds the quote items table with elevation images
 */
async function addQuoteItemsTable(
  pdf: jsPDF,
  quoteData: QuoteData,
  startY: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const marginX = 20
  const cellPadding = 3
  const rowHeight = 45 // Height for rows with images (increased for better door proportions)

  // Table header
  const headerY = startY
  pdf.setFillColor(0, 0, 0)
  pdf.rect(marginX, headerY, pageWidth - 2 * marginX, 8, 'F')

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  // Column widths - increased elevation column for better thumbnail visibility
  const colElevation = 60 // Doubled from 30mm to show proper door proportions
  const colOpening = 45 // Reduced from 50mm to accommodate elevation increase
  const colSpecs = 40 // Reduced from 45mm
  const colHardware = 35 // Reduced from 40mm
  const colPrice = pageWidth - 2 * marginX - colElevation - colOpening - colSpecs - colHardware

  let currentX = marginX
  pdf.text('Elevation', currentX + colElevation / 2, headerY + 5.5, { align: 'center' })
  currentX += colElevation
  pdf.text('Opening', currentX + colOpening / 2, headerY + 5.5, { align: 'center' })
  currentX += colOpening
  pdf.text('Specifications', currentX + colSpecs / 2, headerY + 5.5, { align: 'center' })
  currentX += colSpecs
  pdf.text('Hardware', currentX + colHardware / 2, headerY + 5.5, { align: 'center' })
  currentX += colHardware
  pdf.text('Price', currentX + colPrice / 2, headerY + 5.5, { align: 'center' })

  pdf.setTextColor(0, 0, 0)

  // Table rows
  let currentY = headerY + 8

  for (const item of quoteData.quoteItems) {
    // Check if we need a new page
    if (currentY + rowHeight > 250) {
      pdf.addPage()
      currentY = 20
    }

    // Draw row border
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.3)
    pdf.rect(marginX, currentY, pageWidth - 2 * marginX, rowHeight)

    currentX = marginX

    // Column 1: Elevation thumbnails with aspect-ratio-aware rendering
    if (item.elevationImages && item.elevationImages.length > 0) {
      const availableWidth = colElevation - 2 * cellPadding
      const availableHeight = rowHeight - 2 * cellPadding
      const numPanels = Math.min(item.elevationImages.length, 3)

      // Typical door aspect ratio is tall/narrow (e.g., 80" H x 36" W = 2.22:1)
      // We'll assume a 2.2:1 aspect ratio for doors if we can't detect it
      const assumedAspectRatio = 2.2 // height / width

      // Calculate width per panel based on aspect ratio
      // Each panel should maintain proper proportions
      const panelWidth = Math.min(
        availableWidth / numPanels, // Equal division
        availableHeight / assumedAspectRatio // Width based on available height and aspect ratio
      )
      const panelHeight = Math.min(availableHeight, panelWidth * assumedAspectRatio)

      // Center the group of panels horizontally in the column
      const totalPanelsWidth = panelWidth * numPanels
      const startX = currentX + cellPadding + (availableWidth - totalPanelsWidth) / 2

      for (let i = 0; i < numPanels; i++) {
        try {
          let imgData = item.elevationImages[i]

          // Check if the image data already has a data URI prefix
          if (!imgData.startsWith('data:')) {
            imgData = `data:image/png;base64,${imgData}`
          }

          const imgX = startX + (i * panelWidth)
          const imgY = currentY + cellPadding + (availableHeight - panelHeight) / 2 // Center vertically

          // Convert SVG to PNG at high resolution to preserve details
          // Render at high resolution to ensure SVG details (rails, stiles, glass) remain visible
          const highResWidth = 500 // High resolution for clear detail preservation
          const highResHeight = Math.floor(highResWidth * assumedAspectRatio)
          imgData = await ensurePngDataUrl(imgData, highResWidth, highResHeight)

          // Detect image format from data URI
          let format: 'PNG' | 'JPEG' = 'PNG'
          if (imgData.includes('data:image/jpeg') || imgData.includes('data:image/jpg')) {
            format = 'JPEG'
          }

          pdf.addImage(imgData, format, imgX, imgY, panelWidth - 0.5, panelHeight)
        } catch (error) {
          console.error('Error adding elevation image:', error)
          // Draw a placeholder box instead
          const imgX = startX + (i * panelWidth)
          const imgY = currentY + cellPadding + (availableHeight - panelHeight) / 2
          pdf.setDrawColor(200, 200, 200)
          pdf.rect(imgX, imgY, panelWidth - 0.5, panelHeight)
        }
      }
    }
    currentX += colElevation

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 2: Opening name and description
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    const openingNameLines = pdf.splitTextToSize(item.name, colOpening - 2 * cellPadding)
    pdf.text(openingNameLines, currentX + cellPadding, currentY + cellPadding + 4)

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    const descLines = pdf.splitTextToSize(item.description, colOpening - 2 * cellPadding)
    pdf.text(descLines, currentX + cellPadding, currentY + cellPadding + 10)
    currentX += colOpening

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 3: Specifications
    pdf.setFontSize(8)
    let specY = currentY + cellPadding + 4

    pdf.setFont('helvetica', 'bold')
    pdf.text('DIMENSIONS', currentX + cellPadding, specY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.dimensions, currentX + cellPadding, specY + 4)

    pdf.setFont('helvetica', 'bold')
    pdf.text('COLOR', currentX + cellPadding, specY + 10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.color.toUpperCase(), currentX + cellPadding, specY + 14)

    pdf.setFont('helvetica', 'bold')
    pdf.text('GLASS', currentX + cellPadding, specY + 20)
    pdf.setFont('helvetica', 'normal')
    pdf.text(item.glassType.toUpperCase(), currentX + cellPadding, specY + 24)
    currentX += colSpecs

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 4: Hardware
    pdf.setFontSize(8)
    const hardwareText = item.hardware && item.hardware !== 'Standard' ? item.hardware : 'Standard Hardware'
    const hardwareLines = pdf.splitTextToSize(hardwareText, colHardware - 2 * cellPadding)
    pdf.text(hardwareLines, currentX + cellPadding, currentY + cellPadding + 4)
    currentX += colHardware

    // Vertical separator
    pdf.line(currentX, currentY, currentX, currentY + rowHeight)

    // Column 5: Price
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`$${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      currentX + colPrice / 2, currentY + rowHeight / 2 + 2, { align: 'center' })

    currentY += rowHeight
  }
}

/**
 * Adds the footer with pricing totals
 */
function addQuoteFooter(pdf: jsPDF, quoteData: QuoteData): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 20
  const footerY = pageHeight - 60

  // Background for footer
  pdf.setFillColor(248, 248, 248)
  pdf.rect(marginX, footerY, pageWidth - 2 * marginX, 50, 'F')

  // Pricing breakdown on the right side
  const priceX = pageWidth - 80
  let priceY = footerY + 10

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // Subtotal
  pdf.text('Subtotal:', priceX, priceY)
  pdf.text(`$${quoteData.adjustedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - marginX - 5, priceY, { align: 'right' })
  priceY += 7

  // Tax (if applicable)
  if (quoteData.taxRate > 0) {
    pdf.text(`Tax (${(quoteData.taxRate * 100).toFixed(1)}%):`, priceX, priceY)
    pdf.text(`$${quoteData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
      pageWidth - marginX - 5, priceY, { align: 'right' })
    priceY += 7
  }

  // Total
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(100, 100, 100)
  pdf.line(priceX, priceY - 2, pageWidth - marginX - 5, priceY - 2)

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TOTAL:', priceX, priceY + 5)
  pdf.text(`$${quoteData.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - marginX - 5, priceY + 5, { align: 'right' })

  // Left side - project info
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'italic')
  pdf.setTextColor(100, 100, 100)
  pdf.text(`This quote includes ${quoteData.quoteItems.length} opening${quoteData.quoteItems.length !== 1 ? 's' : ''}`,
    marginX + 5, footerY + 15)

  pdf.setTextColor(0, 0, 0)
}

/**
 * Adds an attachment page (image or PDF)
 */
async function addAttachmentPage(
  pdf: jsPDF,
  attachment: QuoteAttachment,
  projectId: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 20
  const marginY = 20

  // Add attachment title/description at top
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  let currentY = marginY

  const displayName = attachment.description || attachment.originalName
  pdf.text(displayName, pageWidth / 2, currentY, { align: 'center' })
  currentY += 10

  // Load attachment file
  const attachmentPath = path.join(
    process.cwd(),
    'uploads',
    'quote-attachments',
    String(projectId),
    attachment.filename
  )

  if (!fs.existsSync(attachmentPath)) {
    console.error(`Attachment file not found: ${attachmentPath}`)
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Attachment file not found', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    return
  }

  // Handle different file types
  if (attachment.mimeType.startsWith('image/')) {
    await addImageAttachment(pdf, attachmentPath, attachment.mimeType, currentY, pageWidth, pageHeight, marginX, marginY)
  } else if (attachment.mimeType === 'application/pdf') {
    // For PDF attachments, we'll add a note and handle embedding in the future
    // For now, just indicate that a PDF spec sheet is included
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text('PDF Specification Sheet', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setFontSize(8)
    pdf.text('(PDF embedding coming soon)', pageWidth / 2, pageHeight / 2 + 7, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
  }
}

/**
 * Adds an image attachment to the PDF
 */
async function addImageAttachment(
  pdf: jsPDF,
  imagePath: string,
  mimeType: string,
  startY: number,
  pageWidth: number,
  pageHeight: number,
  marginX: number,
  marginY: number
): Promise<void> {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath)
    const imageBase64 = imageBuffer.toString('base64')
    const imageType = mimeType.split('/')[1].toUpperCase()

    // Determine image format for jsPDF
    let format: 'PNG' | 'JPEG' | 'JPG' = 'PNG'
    if (imageType === 'JPEG' || imageType === 'JPG') {
      format = 'JPEG'
    }

    const imageData = `data:${mimeType};base64,${imageBase64}`

    // Calculate image dimensions to fit page
    const availableWidth = pageWidth - 2 * marginX
    const availableHeight = pageHeight - startY - marginY

    // Get image properties (we'll use the available space for now)
    // In a real implementation, you'd want to get actual image dimensions
    const imgWidth = availableWidth
    const imgHeight = availableHeight

    // Center image on page
    const imgX = marginX
    const imgY = startY

    pdf.addImage(imageData, format, imgX, imgY, imgWidth, imgHeight)
  } catch (error) {
    console.error('Error adding image attachment:', error)
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('Error loading image', pageWidth / 2, pageHeight / 2, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
  }
}

/**
 * Helper function to add a standard page footer
 */
function addPageFooter(
  pdf: jsPDF,
  projectName: string,
  pageNum?: number
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const footerY = pageHeight - 12

  // Line separator
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(150, 150, 150)
  pdf.line(15, footerY - 5, pageWidth - 15, footerY - 5)

  // Footer text
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)

  // Left: Project name
  pdf.text(projectName, 15, footerY)

  // Right: Date and page number
  const dateText = new Date().toLocaleDateString()
  const currentPage = pageNum || pdf.getCurrentPageInfo().pageNumber
  pdf.text(`${dateText} | Page ${currentPage}`, pageWidth - 15, footerY, { align: 'right' })

  // Reset text color
  pdf.setTextColor(0, 0, 0)
}

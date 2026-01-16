// Quote PDF Generation Utility
// Uses jsPDF to create professional quote PDFs with optional attachments
// Uses pdf-lib to merge PDF attachments

import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

export interface QuoteItem {
  openingId: number
  name: string
  openingDirections?: string[] // Array of opening direction abbreviations (e.g., ['LH', 'RH'])
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
  customer?: {
    companyName: string
    contactName?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  } | null
  companyLogo?: string | null // Path to company logo from branding settings
  quoteItems: QuoteItem[]
  subtotal: number
  markupAmount: number
  discountAmount: number
  adjustedSubtotal: number
  installationCost: number
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
  position?: string
  description?: string | null
}

/**
 * Creates a complete quote PDF with optional attachments
 * Returns a Buffer containing the final PDF (either jsPDF only or merged with PDF attachments)
 *
 * Document order:
 * 1. Beginning attachments (position: 'beginning')
 * 2. Quote page with totals
 * 3. After-quote attachments (position: 'after_quote')
 * 4. Persistent documents - product docs / global pages (position: 'persistent')
 * 5. End attachments (position: 'end')
 */
export async function createQuotePDF(
  quoteData: QuoteData,
  attachments: QuoteAttachment[] = []
): Promise<Buffer> {
  // Separate attachments by position
  // Support legacy 'before'/'after' values for backwards compatibility
  const beginningAttachments = attachments.filter(a => a.position === 'beginning' || a.position === 'before')
  const afterQuoteAttachments = attachments.filter(a => a.position === 'after_quote' || a.position === 'after' || (!a.position && !(a as any).isPersistent))
  const persistentAttachments = attachments.filter(a => a.position === 'persistent' || (a as any).isPersistent)
  const endAttachments = attachments.filter(a => a.position === 'end')

  // Further separate by type
  const beginningImages = beginningAttachments.filter(a => a.mimeType.startsWith('image/'))
  const beginningPdfs = beginningAttachments.filter(a => a.mimeType === 'application/pdf')

  const afterQuoteImages = afterQuoteAttachments.filter(a => a.mimeType.startsWith('image/'))
  const afterQuotePdfs = afterQuoteAttachments.filter(a => a.mimeType === 'application/pdf')

  const persistentImages = persistentAttachments.filter(a => a.mimeType.startsWith('image/'))
  const persistentPdfs = persistentAttachments.filter(a => a.mimeType === 'application/pdf')

  const endImages = endAttachments.filter(a => a.mimeType.startsWith('image/'))
  const endPdfs = endAttachments.filter(a => a.mimeType === 'application/pdf')

  const hasPdfAttachments = beginningPdfs.length > 0 || afterQuotePdfs.length > 0 || persistentPdfs.length > 0 || endPdfs.length > 0

  // Helper function to add image attachments to a jsPDF instance
  async function addImageAttachments(pdf: jsPDF, images: QuoteAttachment[], addPageFirst: boolean = true) {
    for (let i = 0; i < images.length; i++) {
      if (addPageFirst || i > 0) {
        pdf.addPage()
      }
      await addAttachmentPage(pdf, images[i], quoteData.project.id)
    }
  }

  // If no PDF attachments, we can build everything with jsPDF alone
  if (!hasPdfAttachments) {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    // 1. Beginning image attachments
    if (beginningImages.length > 0) {
      await addAttachmentPage(pdf, beginningImages[0], quoteData.project.id)
      for (let i = 1; i < beginningImages.length; i++) {
        pdf.addPage()
        await addAttachmentPage(pdf, beginningImages[i], quoteData.project.id)
      }
      pdf.addPage()
    }

    // 2. Quote page
    await addQuotePage(pdf, quoteData)

    // 3. After-quote image attachments
    await addImageAttachments(pdf, afterQuoteImages, true)

    // 4. Persistent document image attachments (product docs, global pages)
    await addImageAttachments(pdf, persistentImages, true)

    // 5. End image attachments
    await addImageAttachments(pdf, endImages, true)

    return Buffer.from(pdf.output('arraybuffer'))
  }

  // We have PDF attachments, so we need to use pdf-lib to merge everything
  try {
    // Helper function to merge a single PDF attachment
    async function mergePdfAttachment(attachment: QuoteAttachment, targetPdf: PDFDocument) {
      const attachmentPath = resolveAttachmentPath(attachment, quoteData.project.id)

      if (!fs.existsSync(attachmentPath)) {
        console.error(`PDF attachment not found: ${attachmentPath}`)
        // Add a placeholder page for the missing PDF
        const placeholderPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter'
        })
        placeholderPdf.setFontSize(12)
        placeholderPdf.setFont('helvetica', 'bold')
        placeholderPdf.text(attachment.description || attachment.originalName,
          placeholderPdf.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
        placeholderPdf.setFontSize(10)
        placeholderPdf.setTextColor(150, 150, 150)
        placeholderPdf.text('PDF attachment not found',
          placeholderPdf.internal.pageSize.getWidth() / 2,
          placeholderPdf.internal.pageSize.getHeight() / 2,
          { align: 'center' })

        const placeholderBytes = placeholderPdf.output('arraybuffer')
        const placeholderPdfDoc = await PDFDocument.load(placeholderBytes)
        const pages = await targetPdf.copyPages(placeholderPdfDoc, placeholderPdfDoc.getPageIndices())
        return pages
      }

      try {
        const attachmentBytes = await fs.promises.readFile(attachmentPath)
        const attachmentPdf = await PDFDocument.load(attachmentBytes)
        const pages = await targetPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
        return pages
      } catch (error) {
        console.error(`Error loading PDF attachment ${attachmentPath}:`, error)
        // Add error placeholder page
        const errorPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter'
        })
        errorPdf.setFontSize(12)
        errorPdf.setFont('helvetica', 'bold')
        errorPdf.text(attachment.description || attachment.originalName,
          errorPdf.internal.pageSize.getWidth() / 2, 20, { align: 'center' })
        errorPdf.setFontSize(10)
        errorPdf.setTextColor(200, 50, 50)
        errorPdf.text('Error loading PDF attachment',
          errorPdf.internal.pageSize.getWidth() / 2,
          errorPdf.internal.pageSize.getHeight() / 2,
          { align: 'center' })

        const errorBytes = errorPdf.output('arraybuffer')
        const errorPdfDoc = await PDFDocument.load(errorBytes)
        const pages = await targetPdf.copyPages(errorPdfDoc, errorPdfDoc.getPageIndices())
        return pages
      }
    }

    // Helper to add image attachments to pdf-lib document
    async function addImagesToPdfLib(images: QuoteAttachment[], targetPdf: PDFDocument) {
      if (images.length === 0) return

      const imagesPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      })

      await addAttachmentPage(imagesPdf, images[0], quoteData.project.id)
      for (let i = 1; i < images.length; i++) {
        imagesPdf.addPage()
        await addAttachmentPage(imagesPdf, images[i], quoteData.project.id)
      }

      const imagesBytes = imagesPdf.output('arraybuffer')
      const imagesPdfDoc = await PDFDocument.load(imagesBytes)
      const pages = await targetPdf.copyPages(imagesPdfDoc, imagesPdfDoc.getPageIndices())
      pages.forEach(page => targetPdf.addPage(page))
    }

    // Create the final PDF document
    let finalPdf = await PDFDocument.create()

    // 1. Beginning attachments (images first, then PDFs)
    await addImagesToPdfLib(beginningImages, finalPdf)
    for (const attachment of beginningPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 2. Quote page
    const quotePdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })
    await addQuotePage(quotePdf, quoteData)
    const quoteBytes = quotePdf.output('arraybuffer')
    const quotePdfDoc = await PDFDocument.load(quoteBytes)
    const quotePages = await finalPdf.copyPages(quotePdfDoc, quotePdfDoc.getPageIndices())
    quotePages.forEach(page => finalPdf.addPage(page))

    // 3. After-quote attachments (images first, then PDFs)
    await addImagesToPdfLib(afterQuoteImages, finalPdf)
    for (const attachment of afterQuotePdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 4. Persistent documents - product docs / global pages (images first, then PDFs)
    await addImagesToPdfLib(persistentImages, finalPdf)
    for (const attachment of persistentPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // 5. End attachments (images first, then PDFs)
    await addImagesToPdfLib(endImages, finalPdf)
    for (const attachment of endPdfs) {
      const pages = await mergePdfAttachment(attachment, finalPdf)
      pages.forEach(page => finalPdf.addPage(page))
    }

    // Save and return the merged PDF
    const mergedBytes = await finalPdf.save()
    return Buffer.from(mergedBytes)
  } catch (error) {
    console.error('Error merging PDF attachments:', error)
    // Fall back to a simple PDF with just the quote
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })
    await addQuotePage(pdf, quoteData)
    return Buffer.from(pdf.output('arraybuffer'))
  }
}

/**
 * Helper function to resolve the filesystem path for an attachment
 */
function resolveAttachmentPath(
  attachment: QuoteAttachment & { isPersistent?: boolean },
  projectId: number
): string {
  if (attachment.isPersistent) {
    // Persistent quote documents are stored in /uploads/quote-documents/[docId]/[filename]
    return path.join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      String(attachment.id),
      attachment.filename
    )
  } else {
    // Project-specific attachments are stored in /uploads/quote-attachments/[projectId]/[filename]
    return path.join(
      process.cwd(),
      'uploads',
      'quote-attachments',
      String(projectId),
      attachment.filename
    )
  }
}

/**
 * Adds the main quote page with project info and line items
 */
async function addQuotePage(pdf: jsPDF, quoteData: QuoteData): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth() // 215.9mm for letter
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4mm for letter

  // Header section - Project name on left, logo and date on right
  let headerY = 15
  const logoMaxWidth = 40 // Maximum logo width in mm
  const logoMaxHeight = 15 // Maximum logo height in mm
  let logoActualHeight = 0

  // Right side: Company logo above the date
  if (quoteData.companyLogo) {
    try {
      const logoPath = path.join(process.cwd(), 'public', quoteData.companyLogo)
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoBase64 = logoBuffer.toString('base64')
        const logoExt = path.extname(quoteData.companyLogo).toLowerCase().replace('.', '')
        const mimeType = logoExt === 'svg' ? 'image/svg+xml' :
                         logoExt === 'jpg' ? 'image/jpeg' : `image/${logoExt}`
        const logoData = `data:${mimeType};base64,${logoBase64}`

        // Position logo in top right, above where date will be
        const logoX = pageWidth - 20 - logoMaxWidth
        pdf.addImage(logoData, logoExt.toUpperCase() === 'JPG' ? 'JPEG' : logoExt.toUpperCase(),
          logoX, headerY, logoMaxWidth, logoMaxHeight)
        logoActualHeight = logoMaxHeight
      }
    } catch (error) {
      console.error('Error adding company logo to PDF:', error)
    }
  }

  // Left: Project name (bold, larger) - 15mm margin to match cards
  const projectNameY = logoActualHeight > 0 ? headerY + 5 : headerY + 5
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text(quoteData.project.name, 15, projectNameY)

  // Customer info below project name
  let customerY = projectNameY + 6
  if (quoteData.customer) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(60, 60, 60)

    // Company name
    pdf.text(quoteData.customer.companyName, 15, customerY)
    customerY += 4.5

    // Contact name (if present)
    if (quoteData.customer.contactName) {
      pdf.text(quoteData.customer.contactName, 15, customerY)
      customerY += 4.5
    }

    // Address line (if present)
    if (quoteData.customer.address) {
      pdf.text(quoteData.customer.address, 15, customerY)
      customerY += 4.5
    }

    // City, State ZIP (if present)
    const cityStateZip = [
      quoteData.customer.city,
      quoteData.customer.state,
      quoteData.customer.zip
    ].filter(Boolean).join(', ')
    if (cityStateZip) {
      pdf.text(cityStateZip, 15, customerY)
      customerY += 4.5
    }

    // Phone (if present)
    if (quoteData.customer.phone) {
      pdf.text(quoteData.customer.phone, 15, customerY)
      customerY += 4.5
    }

    // Email (if present)
    if (quoteData.customer.email) {
      pdf.text(quoteData.customer.email, 15, customerY)
      customerY += 4.5
    }

    pdf.setTextColor(0, 0, 0)
  }

  // Calculate divider position - below left content and logo
  const rightContentBottom = logoActualHeight > 0 ? headerY + logoActualHeight + 4 : headerY
  const dividerY = Math.max(customerY, rightContentBottom) + 2

  // Divider line - matches card width (15mm margins)
  pdf.setLineWidth(0.33)
  pdf.setDrawColor(200, 200, 200)
  pdf.line(15, dividerY, pageWidth - 15, dividerY)

  // Quote items table - now returns the page number where it ended
  const tableStartY = dividerY + 10
  await addQuoteItemsTable(pdf, quoteData, tableStartY)

  // Footer with totals - will be added on the last page by addQuoteItemsTable
}

/**
 * Adds the quote items table with elevation images
 * Uses pagination: 3 items per page, with footer on the last page
 */
async function addQuoteItemsTable(
  pdf: jsPDF,
  quoteData: QuoteData,
  startY: number
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const marginX = 15 // Reduced from 20mm to maximize width for portrait layout
  const cellPadding = 5
  const cardHeight = 42 // Height for each opening card
  const cardSpacing = 6 // Space between cards
  const footerHeight = 60 // Space needed for footer with pricing
  const ITEMS_PER_PAGE = 5 // Maximum items per page (cards are more compact)
  const cardWidth = pageWidth - 2 * marginX
  const cornerRadius = 3 // Rounded corner radius

  const totalItems = quoteData.quoteItems.length
  let currentY = startY
  let itemsOnCurrentPage = 0
  let currentPageIsFirst = true

  // Smart pagination: calculate max items per page based on total items
  // - If 2 or fewer items: All items + footer on page 1
  // - If 3 items: Try to fit all + footer on page 1
  // - If 4 items: All 4 items + footer on page 1
  // - If 5+ items: Max 4 per intermediate page, max 2 on last page with footer
  const getMaxItemsForCurrentPage = (currentPageFirst: boolean, itemsLeft: number): number => {
    if (totalItems <= 4) {
      // 4 or fewer items: all on first page with footer
      return totalItems
    } else {
      // 5+ items
      if (itemsLeft <= 2) {
        // Last page: max 2 items + footer
        return 2
      } else {
        // Intermediate pages: max 4 items
        return 4
      }
    }
  }

  // No section header - cards start directly

  // Process each item
  for (let itemIndex = 0; itemIndex < totalItems; itemIndex++) {
    const item = quoteData.quoteItems[itemIndex]
    const isLastItem = itemIndex === totalItems - 1
    const itemsRemaining = totalItems - itemIndex
    const maxItemsThisPage = getMaxItemsForCurrentPage(currentPageIsFirst, itemsRemaining)

    // Check if we need a new page BEFORE drawing anything
    let needsNewPage = false

    const totalCardHeight = cardHeight + cardSpacing

    if (itemsOnCurrentPage >= maxItemsThisPage) {
      // Already at max items for this page
      needsNewPage = true
    } else if (!isLastItem && currentY + totalCardHeight > pageHeight - 10) {
      // Not last item and card won't fit
      needsNewPage = true
    } else if (isLastItem) {
      // For last item, check if it + footer will fit
      if (totalItems <= 5 && currentPageIsFirst) {
        if (currentY + totalCardHeight + footerHeight > pageHeight) {
          needsNewPage = true
        }
      } else {
        if (currentY + totalCardHeight + footerHeight > pageHeight - 10) {
          needsNewPage = true
        }
      }
    }

    if (needsNewPage) {
      // Add new page and reset
      pdf.addPage()
      currentY = 20
      itemsOnCurrentPage = 0
      currentPageIsFirst = false
    }

    // Draw card with rounded corners and grey background (no outline)
    pdf.setFillColor(243, 244, 246) // bg-gray-100
    pdf.roundedRect(marginX, currentY, cardWidth, cardHeight, cornerRadius, cornerRadius, 'F')

    // Price badge in top right - hanging off the card edge
    const priceText = `$${item.price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    const priceWidth = pdf.getTextWidth(priceText) + 6 // Reduced padding for narrower badge
    const badgeHeight = 8 // Slightly taller for better vertical centering
    const badgeX = marginX + cardWidth - priceWidth + 2 // Hang off right edge by 2mm
    const badgeY = currentY - 3 // Hang off top edge by 3mm

    // Draw price badge background - dark gray
    pdf.setFillColor(51, 51, 51) // #333
    pdf.roundedRect(badgeX, badgeY, priceWidth, badgeHeight, 2, 2, 'F')

    // Draw price text - centered vertically and horizontally
    pdf.setTextColor(255, 255, 255)
    pdf.text(priceText, badgeX + priceWidth / 2, badgeY + badgeHeight / 2 + 1.5, { align: 'center' })
    pdf.setTextColor(0, 0, 0)

    let contentY = currentY + cellPadding + 4

    // Opening name as header (bold, larger font)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    let openingNameText = item.name
    if (item.openingDirections && item.openingDirections.length > 0) {
      openingNameText += ` (${item.openingDirections.join(', ')})`
    }
    pdf.text(openingNameText, marginX + cellPadding, contentY)
    contentY += 5

    // Opening type (description - e.g., "1 Sliding Door") - smaller, normal weight
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(item.description, marginX + cellPadding, contentY)
    pdf.setTextColor(0, 0, 0)
    contentY += 5

    // Specifications in a compact single line
    pdf.setFontSize(8)
    const specLine = `${item.dimensions}  •  ${item.color}  •  ${item.glassType}`
    pdf.text(specLine, marginX + cellPadding, contentY)
    contentY += 5

    // Hardware section
    if (item.hardware && item.hardware !== 'Standard' && item.hardware.trim() !== '') {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(70, 70, 70)
      pdf.text('Options: ', marginX + cellPadding, contentY)
      const optionsWidth = pdf.getTextWidth('Options: ')

      // Format hardware items inline
      pdf.setFont('helvetica', 'normal')
      const hardwareItems = item.hardware.split(' • ')
      const formattedHardware = hardwareItems
        .map(h => h.replace(' | +', ' +').replace(' | STANDARD', ''))
        .join('  •  ')
      const hardwareLines = pdf.splitTextToSize(formattedHardware, cardWidth - 2 * cellPadding - optionsWidth - 10)
      pdf.text(hardwareLines, marginX + cellPadding + optionsWidth, contentY)
      pdf.setTextColor(0, 0, 0)
    } else {
      // No hardware options
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'italic')
      pdf.setTextColor(140, 140, 140)
      pdf.text('No additional options', marginX + cellPadding, contentY)
      pdf.setTextColor(0, 0, 0)
      pdf.setFont('helvetica', 'normal')
    }

    currentY += cardHeight + cardSpacing
    itemsOnCurrentPage++

    // If this is the last item, add the footer on the current page
    if (isLastItem) {
      addQuoteFooter(pdf, quoteData)
    }
  }
}

/**
 * Adds the footer with pricing totals, valid until, and terms
 */
function addQuoteFooter(pdf: jsPDF, quoteData: QuoteData): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentPadding = 20 // Padding for content inside the footer
  const footerHeight = 63 // Height of the footer area (~2.5 inches)
  const footerY = pageHeight - footerHeight // Footer starts here and goes to bottom

  // Background for footer - full width, touches bottom
  pdf.setFillColor(248, 248, 248)
  pdf.rect(0, footerY, pageWidth, footerHeight, 'F')

  // Pricing breakdown on the right side
  const priceX = pageWidth - 80
  let priceY = footerY + 14

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')

  // Subtotal
  pdf.text('Subtotal:', priceX, priceY)
  pdf.text(`$${quoteData.adjustedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`,
    pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Installation (always show, TBD if 0)
  pdf.text('Installation:', priceX, priceY)
  const installationText = quoteData.installationCost > 0
    ? `$${quoteData.installationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : 'TBD'
  pdf.text(installationText, pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Tax (always show, TBD if 0)
  pdf.text('Tax:', priceX, priceY)
  const taxText = quoteData.taxRate > 0
    ? `$${quoteData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    : 'TBD'
  pdf.text(taxText, pageWidth - contentPadding, priceY, { align: 'right' })
  priceY += 7

  // Separator line before total
  priceY += 2
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(180, 180, 180)
  pdf.line(priceX - 5, priceY, pageWidth - contentPadding, priceY)
  priceY += 6

  // Total as normal text
  const totalText = `$${quoteData.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Total:', priceX, priceY)
  pdf.text(totalText, pageWidth - contentPadding, priceY, { align: 'right' })

  // Left side - Valid Until and Terms
  let leftY = footerY + 14

  // Valid Until
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(60, 60, 60)
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  pdf.text(`Valid Until: ${validUntil.toLocaleDateString()}`, contentPadding, leftY)
  leftY += 8

  // Terms placeholder
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  const termsText = 'Terms & Conditions: This quote is subject to final measurements and site verification. ' +
    'Prices may vary based on actual conditions. Payment terms and delivery schedule to be confirmed upon order. ' +
    'Please contact us with any questions.'
  const termsLines = pdf.splitTextToSize(termsText, pageWidth - 2 * contentPadding - 90) // Leave room for pricing on right
  pdf.text(termsLines, contentPadding, leftY)

  // Date at the bottom left
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 100, 100)
  pdf.text(new Date().toLocaleDateString(), contentPadding, pageHeight - 5)

  pdf.setTextColor(0, 0, 0)
}

/**
 * Adds an attachment page (image or PDF)
 */
async function addAttachmentPage(
  pdf: jsPDF,
  attachment: QuoteAttachment & { isPersistent?: boolean },
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

  // Determine the correct path based on whether this is a persistent document or project-specific attachment
  let attachmentPath: string
  if (attachment.isPersistent) {
    // Persistent quote documents are stored in /uploads/quote-documents/[docId]/[filename]
    attachmentPath = path.join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      String(attachment.id),
      attachment.filename
    )
  } else {
    // Project-specific attachments are stored in /uploads/quote-attachments/[projectId]/[filename]
    attachmentPath = path.join(
      process.cwd(),
      'uploads',
      'quote-attachments',
      String(projectId),
      attachment.filename
    )
  }

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

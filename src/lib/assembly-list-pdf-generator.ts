// Assembly List PDF Generation Utility
// Generates a professional assembly list PDF showing product types, sizes, and quantities

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

export interface AssemblyListItem {
  productName: string
  panelWidth: number
  panelHeight: number
  quantity: number
  openingNames: string[]
  color: string
}

export interface AssemblyListData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  items: AssemblyListItem[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Aggregates BOM items into assembly list format
 * Groups by product name and size, counts quantities
 */
export function aggregateAssemblyList(bomItems: any[]): AssemblyListItem[] {
  const groupMap: Record<string, AssemblyListItem> = {}

  for (const item of bomItems) {
    // Skip non-product items (we want panels/components, not individual parts)
    if (!item.productName || !item.panelWidth || !item.panelHeight) continue

    // Create a unique key for each product type + size combination
    const key = `${item.productName}|${item.panelWidth}|${item.panelHeight}`

    if (!groupMap[key]) {
      groupMap[key] = {
        productName: item.productName,
        panelWidth: item.panelWidth,
        panelHeight: item.panelHeight,
        quantity: 0,
        openingNames: [],
        color: item.color || 'N/A'
      }
    }

    // Count unique panels (each panelId represents one unit)
    // We track by opening name since each opening can have multiple panels of same type
    if (item.openingName && !groupMap[key].openingNames.includes(item.openingName)) {
      groupMap[key].openingNames.push(item.openingName)
    }
  }

  // Convert map to array and calculate quantities from panel counts
  const items = Object.values(groupMap)

  // Sort by product name, then by size
  items.sort((a, b) => {
    if (a.productName !== b.productName) {
      return a.productName.localeCompare(b.productName)
    }
    if (a.panelWidth !== b.panelWidth) {
      return a.panelWidth - b.panelWidth
    }
    return a.panelHeight - b.panelHeight
  })

  return items
}

/**
 * Aggregates from raw project data (openings with panels)
 * This is more accurate than BOM items for counting actual panels
 */
export function aggregateFromProjectData(openings: any[]): AssemblyListItem[] {
  const groupMap: Record<string, AssemblyListItem> = {}

  for (const opening of openings) {
    for (const panel of opening.panels || []) {
      if (!panel.componentInstance?.product) continue

      const product = panel.componentInstance.product
      const width = panel.width || 0
      const height = panel.height || 0

      // Skip panels without dimensions
      if (width === 0 && height === 0) continue

      const key = `${product.name}|${width}|${height}`

      if (!groupMap[key]) {
        groupMap[key] = {
          productName: product.name,
          panelWidth: width,
          panelHeight: height,
          quantity: 0,
          openingNames: [],
          color: opening.finishColor || 'N/A'
        }
      }

      // Each panel counts as 1 unit
      groupMap[key].quantity += 1

      // Track which openings contain this product/size
      if (!groupMap[key].openingNames.includes(opening.name)) {
        groupMap[key].openingNames.push(opening.name)
      }
    }
  }

  const items = Object.values(groupMap)

  // Sort by product name, then by size (width, then height)
  items.sort((a, b) => {
    if (a.productName !== b.productName) {
      return a.productName.localeCompare(b.productName)
    }
    if (a.panelWidth !== b.panelWidth) {
      return a.panelWidth - b.panelWidth
    }
    return a.panelHeight - b.panelHeight
  })

  return items
}

/**
 * Creates an Assembly List PDF
 */
export async function createAssemblyListPDF(data: AssemblyListData): Promise<Buffer> {
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
      const logoPath = path.join(process.cwd(), 'public', data.companyLogo)
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        const logoExt = path.extname(data.companyLogo).toLowerCase().replace('.', '')

        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg') {
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

        const logoBase64 = processedLogoBuffer.toString('base64')
        const mimeType = imageFormat === 'JPEG' ? 'image/jpeg' :
                         (logoExt === 'svg' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${mimeType};base64,${logoBase64}`

        const logoX = PAGE_WIDTH - MARGIN - logoMaxWidth
        pdf.addImage(logoData, imageFormat, logoX, yPos, logoMaxWidth, logoMaxHeight, undefined, 'SLOW')
      }
    } catch (error) {
      console.error('Error adding company logo to Assembly List PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Assembly List', MARGIN, yPos + 5)
  yPos += 10

  // Customer name (if available)
  if (data.customerName) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(data.customerName, MARGIN, yPos)
    yPos += 6
  }

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

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
    pdf.text('No assembly items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Table header
  const colWidths = {
    product: 60,
    size: 35,
    qty: 20,
    color: 30,
    openings: CONTENT_WIDTH - 60 - 35 - 20 - 30
  }

  const headerHeight = 8
  pdf.setFillColor(50, 50, 50)
  pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  let xPos = MARGIN + 3
  pdf.text('Product Type', xPos, yPos + 5.5)
  xPos += colWidths.product
  pdf.text('Size (W x H)', xPos, yPos + 5.5)
  xPos += colWidths.size
  pdf.text('Qty', xPos, yPos + 5.5)
  xPos += colWidths.qty
  pdf.text('Color', xPos, yPos + 5.5)
  xPos += colWidths.color
  pdf.text('Openings', xPos, yPos + 5.5)

  pdf.setTextColor(0, 0, 0)
  yPos += headerHeight

  // Table rows
  const rowHeight = 10
  let totalQuantity = 0
  let currentProductName = ''

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]

    // Check if we need a new page
    if (yPos + rowHeight > PAGE_HEIGHT - MARGIN - 15) {
      pdf.addPage()
      yPos = MARGIN

      // Re-draw header on new page
      pdf.setFillColor(50, 50, 50)
      pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(255, 255, 255)

      xPos = MARGIN + 3
      pdf.text('Product Type', xPos, yPos + 5.5)
      xPos += colWidths.product
      pdf.text('Size (W x H)', xPos, yPos + 5.5)
      xPos += colWidths.size
      pdf.text('Qty', xPos, yPos + 5.5)
      xPos += colWidths.qty
      pdf.text('Color', xPos, yPos + 5.5)
      xPos += colWidths.color
      pdf.text('Openings', xPos, yPos + 5.5)

      pdf.setTextColor(0, 0, 0)
      yPos += headerHeight
    }

    // Alternate row background
    if (i % 2 === 0) {
      pdf.setFillColor(245, 245, 245)
      pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
    }

    // Product type grouping - show product name only on first row of each group
    const showProductName = item.productName !== currentProductName
    if (showProductName) {
      currentProductName = item.productName
    }

    pdf.setFontSize(9)
    pdf.setFont('helvetica', showProductName ? 'bold' : 'normal')

    xPos = MARGIN + 3
    if (showProductName) {
      // Truncate long product names
      const maxProductWidth = colWidths.product - 6
      let productText = item.productName
      while (pdf.getTextWidth(productText) > maxProductWidth && productText.length > 3) {
        productText = productText.slice(0, -4) + '...'
      }
      pdf.text(productText, xPos, yPos + 6.5)
    }

    xPos += colWidths.product
    pdf.setFont('helvetica', 'normal')
    pdf.text(`${item.panelWidth}" x ${item.panelHeight}"`, xPos, yPos + 6.5)

    xPos += colWidths.size
    pdf.setFont('helvetica', 'bold')
    pdf.text(item.quantity.toString(), xPos, yPos + 6.5)
    totalQuantity += item.quantity

    xPos += colWidths.qty
    pdf.setFont('helvetica', 'normal')
    // Truncate color if needed
    let colorText = item.color
    while (pdf.getTextWidth(colorText) > colWidths.color - 6 && colorText.length > 3) {
      colorText = colorText.slice(0, -4) + '...'
    }
    pdf.text(colorText, xPos, yPos + 6.5)

    xPos += colWidths.color
    // Truncate openings list if too long
    let openingsText = item.openingNames.join(', ')
    const maxOpeningsWidth = colWidths.openings - 6
    while (pdf.getTextWidth(openingsText) > maxOpeningsWidth && openingsText.length > 3) {
      openingsText = openingsText.slice(0, -4) + '...'
    }
    pdf.text(openingsText, xPos, yPos + 6.5)

    yPos += rowHeight
  }

  // Total row
  yPos += 2
  pdf.setFillColor(30, 30, 30)
  pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  xPos = MARGIN + 3
  pdf.text('TOTAL', xPos, yPos + 6.5)
  xPos += colWidths.product + colWidths.size
  pdf.text(totalQuantity.toString(), xPos, yPos + 6.5)

  pdf.setTextColor(0, 0, 0)

  // Footer
  const footerY = PAGE_HEIGHT - 8
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text(
    `${data.projectName} - Assembly List`,
    PAGE_WIDTH / 2,
    footerY,
    { align: 'center' }
  )

  return Buffer.from(pdf.output('arraybuffer'))
}

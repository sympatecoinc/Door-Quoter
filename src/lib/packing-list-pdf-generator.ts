// Packing List PDF Generation Utility
// Generates a packing list PDF grouped by product type
// Each product instance and each individual hardware item gets its own checkable line

import { jsPDF } from 'jspdf'

export interface PackingListItem {
  openingName: string
  productName: string  // The product type (e.g., "Swing Door", "Fixed Panel")
  partNumber: string | null
  partName: string
  quantity: number
  unit: string | null
}

export interface ProductInstance {
  openingName: string
  productName: string
  panelType?: string  // e.g., "Left", "Right", "Center"
  width?: number
  height?: number
}

export interface PackingListData {
  projectName: string
  customerName?: string
  items: PackingListItem[]  // Hardware items
  productInstances: ProductInstance[]
  generatedDate: string
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

/**
 * Helper function to truncate text to fit within a width
 */
function truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
  if (!text) return ''

  const textWidth = pdf.getTextWidth(text)
  if (textWidth <= maxWidth) return text

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

/**
 * Draws a checkbox
 */
function drawCheckbox(pdf: jsPDF, x: number, y: number, size: number = 4): void {
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.3)
  pdf.rect(x, y - size + 1, size, size)
}

/**
 * Groups product instances by product name
 */
function groupProductsByType(instances: ProductInstance[]): Record<string, ProductInstance[]> {
  const grouped: Record<string, ProductInstance[]> = {}

  for (const instance of instances) {
    const key = instance.productName || 'Other'
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(instance)
  }

  // Sort instances within each group by opening name
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.openingName.localeCompare(b.openingName))
  }

  return grouped
}

/**
 * Expands hardware items - one line per individual item (not aggregated)
 */
interface ExpandedHardwareItem {
  partNumber: string
  partName: string
  unit: string
  productName: string
}

function expandHardwareItems(items: PackingListItem[]): ExpandedHardwareItem[] {
  const expanded: ExpandedHardwareItem[] = []

  for (const item of items) {
    // Create one entry per quantity
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({
        partNumber: item.partNumber || '',
        partName: item.partName,
        unit: item.unit || 'EA',
        productName: item.productName
      })
    }
  }

  // Sort by part number, then part name
  expanded.sort((a, b) => {
    const partNumCompare = a.partNumber.localeCompare(b.partNumber)
    if (partNumCompare !== 0) return partNumCompare
    return a.partName.localeCompare(b.partName)
  })

  return expanded
}

/**
 * Creates a Packing List PDF grouped by product type
 */
export async function createPackingListPDF(data: PackingListData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  let yPos = MARGIN

  // Title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Packing List', PAGE_WIDTH / 2, yPos, { align: 'center' })
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

  // Group products by type
  const productsByType = groupProductsByType(data.productInstances)
  const sortedProductTypes = Object.keys(productsByType).sort()

  // Expand hardware items (one per quantity)
  const expandedHardware = expandHardwareItems(data.items)

  if (sortedProductTypes.length === 0 && expandedHardware.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No items found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Column widths
  const COL_ITEM = 145  // Opening/Part info
  const COL_STAGED = 16
  const COL_QA = 14
  const COL_LOADED = 16

  const rowHeight = 8
  const headerHeight = 8

  // Helper to draw table header for products
  const drawProductTableHeader = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('Opening / Size', xPos, yPos + 5.5)
    xPos += COL_ITEM
    pdf.text('Staged', xPos + COL_STAGED / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_STAGED
    pdf.text('QA', xPos + COL_QA / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_QA
    pdf.text('Loaded', xPos + COL_LOADED / 2, yPos + 5.5, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    yPos += headerHeight
  }

  // Helper to draw table header for hardware
  const drawHardwareTableHeader = () => {
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, headerHeight, 'F')

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(50, 50, 50)

    let xPos = MARGIN + 2
    pdf.text('Part Number / Name', xPos, yPos + 5.5)
    xPos += COL_ITEM
    pdf.text('Staged', xPos + COL_STAGED / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_STAGED
    pdf.text('QA', xPos + COL_QA / 2, yPos + 5.5, { align: 'center' })
    xPos += COL_QA
    pdf.text('Loaded', xPos + COL_LOADED / 2, yPos + 5.5, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    yPos += headerHeight
  }

  // Helper to check for new page
  const checkNewPage = (neededSpace: number): boolean => {
    if (yPos + neededSpace > PAGE_HEIGHT - MARGIN) {
      pdf.addPage()
      yPos = MARGIN
      return true
    }
    return false
  }

  // =====================================================
  // SECTION 1: Products grouped by type
  // =====================================================
  for (const productType of sortedProductTypes) {
    const products = productsByType[productType] || []

    if (products.length === 0) continue

    // Calculate minimum space needed for this group
    const minSpace = 10 + headerHeight + Math.min(products.length, 2) * rowHeight + 10
    checkNewPage(minSpace)

    // Product type header
    pdf.setFillColor(59, 130, 246) // Blue
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(productType, MARGIN + 3, yPos + 5.5)
    pdf.setTextColor(0, 0, 0)
    yPos += 10

    drawProductTableHeader()

    for (let i = 0; i < products.length; i++) {
      const product = products[i]

      if (checkNewPage(rowHeight + 10)) {
        // Re-draw product type header
        pdf.setFillColor(59, 130, 246)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text(`${productType} (continued)`, MARGIN + 3, yPos + 5.5)
        pdf.setTextColor(0, 0, 0)
        yPos += 10

        drawProductTableHeader()
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')

      let xPos = MARGIN + 2

      // Opening name and size
      let itemText = product.openingName
      if (product.panelType) {
        itemText += ` (${product.panelType})`
      }
      if (product.width && product.height) {
        itemText += ` - ${product.width}" x ${product.height}"`
      }
      itemText = truncateText(pdf, itemText, COL_ITEM - 8)
      pdf.text(itemText, xPos, yPos + 5.5)
      xPos += COL_ITEM

      // Checkboxes (centered in each column)
      drawCheckbox(pdf, xPos + (COL_STAGED - 5) / 2, yPos + 5.5, 5)
      xPos += COL_STAGED
      drawCheckbox(pdf, xPos + (COL_QA - 5) / 2, yPos + 5.5, 5)
      xPos += COL_QA
      drawCheckbox(pdf, xPos + (COL_LOADED - 5) / 2, yPos + 5.5, 5)

      yPos += rowHeight
    }

    // Space between product type groups
    yPos += 6
  }

  // =====================================================
  // SECTION 2: Hardware (at the end, one line per item)
  // =====================================================
  if (expandedHardware.length > 0) {
    // Add some space before hardware section
    yPos += 4

    checkNewPage(headerHeight + rowHeight * 3 + 20)

    // Hardware section header
    pdf.setFillColor(100, 116, 139) // Slate gray
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text('Hardware', MARGIN + 3, yPos + 5.5)
    pdf.setTextColor(0, 0, 0)
    yPos += 10

    drawHardwareTableHeader()

    for (let i = 0; i < expandedHardware.length; i++) {
      const part = expandedHardware[i]

      if (checkNewPage(rowHeight + 10)) {
        // Re-draw hardware header
        pdf.setFillColor(100, 116, 139)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 8, 'F')
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255)
        pdf.text('Hardware (continued)', MARGIN + 3, yPos + 5.5)
        pdf.setTextColor(0, 0, 0)
        yPos += 10

        drawHardwareTableHeader()
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(252, 252, 252)
        pdf.rect(MARGIN, yPos, CONTENT_WIDTH, rowHeight, 'F')
      }

      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')

      let xPos = MARGIN + 2

      // Part number and name
      let partText = ''
      if (part.partNumber) {
        partText = `${part.partNumber} - ${part.partName}`
      } else {
        partText = part.partName
      }
      partText = truncateText(pdf, partText, COL_ITEM - 4)
      pdf.text(partText, xPos, yPos + 5.5)
      xPos += COL_ITEM

      // Checkboxes (centered in each column)
      drawCheckbox(pdf, xPos + (COL_STAGED - 5) / 2, yPos + 5.5, 5)
      xPos += COL_STAGED
      drawCheckbox(pdf, xPos + (COL_QA - 5) / 2, yPos + 5.5, 5)
      xPos += COL_QA
      drawCheckbox(pdf, xPos + (COL_LOADED - 5) / 2, yPos + 5.5, 5)

      yPos += rowHeight
    }
  }

  // =====================================================
  // Summary
  // =====================================================
  checkNewPage(35)

  yPos += 8
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 8

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Summary', MARGIN, yPos)
  yPos += 6

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  const totalProducts = data.productInstances.length
  const uniqueOpenings = new Set(data.productInstances.map(p => p.openingName)).size
  const totalHardwareItems = expandedHardware.length

  pdf.text(`Total Openings: ${uniqueOpenings}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Total Products: ${totalProducts}`, MARGIN, yPos)
  yPos += 5
  pdf.text(`Total Hardware Items: ${totalHardwareItems}`, MARGIN, yPos)

  // Footer
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text('Generated by Door Quoter', PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' })

  return Buffer.from(pdf.output('arraybuffer'))
}

import { jsPDF } from 'jspdf'

export interface POPDFData {
  poNumber: string
  status: string
  txnDate: string
  expectedDate?: string | null
  dueDate?: string | null
  vendor: {
    displayName: string
    companyName?: string | null
    primaryEmail?: string | null
    primaryPhone?: string | null
    billAddressLine1?: string | null
    billAddressLine2?: string | null
    billAddressCity?: string | null
    billAddressState?: string | null
    billAddressZip?: string | null
  }
  shipTo?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
  }
  lines: Array<{
    lineNum: number
    itemName?: string | null
    itemSku?: string | null
    description?: string | null
    quantity: number
    unitPrice: number
    amount: number
  }>
  subtotal: number
  taxAmount?: number | null
  shippingAmount?: number | null
  totalAmount: number
  memo?: string | null
  companyInfo?: {
    name: string
    address?: string
    phone?: string
    email?: string
  }
}

export function createPurchaseOrderPDF(data: POPDFData): Buffer {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin

  let y = margin

  // Company header (if provided)
  if (data.companyInfo) {
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(data.companyInfo.name, margin, y)
    y += 6

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    if (data.companyInfo.address) {
      pdf.text(data.companyInfo.address, margin, y)
      y += 4
    }
    if (data.companyInfo.phone) {
      pdf.text(data.companyInfo.phone, margin, y)
      y += 4
    }
    if (data.companyInfo.email) {
      pdf.text(data.companyInfo.email, margin, y)
      y += 4
    }
    y += 4
  }

  // Title
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PURCHASE ORDER', pageWidth / 2, y, { align: 'center' })
  y += 10

  // PO Number and Date
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 6

  const leftColX = margin
  const rightColX = pageWidth / 2 + 10

  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('PO Number:', leftColX, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(data.poNumber, leftColX + 28, y)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Date:', rightColX, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(formatDate(data.txnDate), rightColX + 15, y)
  y += 6

  if (data.expectedDate) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Status:', leftColX, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(formatStatus(data.status), leftColX + 18, y)

    pdf.setFont('helvetica', 'bold')
    pdf.text('Expected:', rightColX, y)
    pdf.setFont('helvetica', 'normal')
    pdf.text(formatDate(data.expectedDate), rightColX + 25, y)
    y += 6
  }

  y += 4
  pdf.line(margin, y, pageWidth - margin, y)
  y += 8

  // Vendor and Ship To columns
  const colWidth = (contentWidth - 10) / 2

  // Vendor section
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('VENDOR:', leftColX, y)
  y += 5

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.text(data.vendor.displayName, leftColX, y)
  y += 4

  if (data.vendor.companyName && data.vendor.companyName !== data.vendor.displayName) {
    pdf.text(data.vendor.companyName, leftColX, y)
    y += 4
  }

  if (data.vendor.billAddressLine1) {
    pdf.text(data.vendor.billAddressLine1, leftColX, y)
    y += 4
  }
  if (data.vendor.billAddressLine2) {
    pdf.text(data.vendor.billAddressLine2, leftColX, y)
    y += 4
  }
  if (data.vendor.billAddressCity || data.vendor.billAddressState) {
    const cityState = [
      data.vendor.billAddressCity,
      data.vendor.billAddressState,
      data.vendor.billAddressZip
    ].filter(Boolean).join(', ')
    pdf.text(cityState, leftColX, y)
    y += 4
  }

  if (data.vendor.primaryPhone) {
    pdf.text(`Phone: ${data.vendor.primaryPhone}`, leftColX, y)
    y += 4
  }
  if (data.vendor.primaryEmail) {
    pdf.text(`Email: ${data.vendor.primaryEmail}`, leftColX, y)
    y += 4
  }

  // Ship To section (on right side)
  let shipY = y - (data.vendor.primaryEmail ? 20 : 16)
  if (data.shipTo && (data.shipTo.line1 || data.shipTo.city)) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('SHIP TO:', rightColX, shipY - 9)
    pdf.setFont('helvetica', 'normal')

    if (data.shipTo.line1) {
      pdf.text(data.shipTo.line1, rightColX, shipY - 5)
      shipY += 4
    }
    if (data.shipTo.line2) {
      pdf.text(data.shipTo.line2, rightColX, shipY - 5)
      shipY += 4
    }
    if (data.shipTo.city || data.shipTo.state) {
      const cityState = [
        data.shipTo.city,
        data.shipTo.state,
        data.shipTo.zip
      ].filter(Boolean).join(', ')
      pdf.text(cityState, rightColX, shipY - 5)
    }
  }

  y += 8

  // Line items table
  pdf.line(margin, y, pageWidth - margin, y)
  y += 1

  // Table header
  const colWidths = {
    item: 70,
    qty: 20,
    unitPrice: 30,
    amount: 30
  }

  pdf.setFillColor(240, 240, 240)
  pdf.rect(margin, y, contentWidth, 7, 'F')

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  y += 5
  pdf.text('Item / Description', margin + 2, y)
  pdf.text('Qty', margin + colWidths.item + 10, y, { align: 'right' })
  pdf.text('Unit Price', margin + colWidths.item + colWidths.qty + 25, y, { align: 'right' })
  pdf.text('Amount', pageWidth - margin - 2, y, { align: 'right' })
  y += 4

  pdf.setLineWidth(0.3)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 2

  // Line items
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)

  for (const line of data.lines) {
    // Check if we need a new page
    if (y > pageHeight - 50) {
      pdf.addPage()
      y = margin
    }

    y += 4
    const itemName = line.itemName || line.description || 'Item'
    pdf.text(itemName.substring(0, 45), margin + 2, y)

    if (line.itemSku) {
      y += 4
      pdf.setTextColor(100, 100, 100)
      pdf.setFontSize(8)
      pdf.text(`SKU: ${line.itemSku}`, margin + 2, y)
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(9)
    }

    pdf.text(line.quantity.toString(), margin + colWidths.item + 10, y - (line.itemSku ? 4 : 0), { align: 'right' })
    pdf.text(formatCurrency(line.unitPrice), margin + colWidths.item + colWidths.qty + 25, y - (line.itemSku ? 4 : 0), { align: 'right' })
    pdf.text(formatCurrency(line.amount), pageWidth - margin - 2, y - (line.itemSku ? 4 : 0), { align: 'right' })

    y += 3
    pdf.setDrawColor(230, 230, 230)
    pdf.line(margin, y, pageWidth - margin, y)
  }

  y += 8

  // Totals
  const totalsX = pageWidth - margin - 70
  pdf.setDrawColor(200, 200, 200)
  pdf.line(totalsX, y, pageWidth - margin, y)
  y += 5

  pdf.setFont('helvetica', 'normal')
  pdf.text('Subtotal:', totalsX, y)
  pdf.text(formatCurrency(data.subtotal), pageWidth - margin - 2, y, { align: 'right' })
  y += 5

  if (data.taxAmount && data.taxAmount > 0) {
    pdf.text('Tax:', totalsX, y)
    pdf.text(formatCurrency(data.taxAmount), pageWidth - margin - 2, y, { align: 'right' })
    y += 5
  }

  if (data.shippingAmount && data.shippingAmount > 0) {
    pdf.text('Shipping:', totalsX, y)
    pdf.text(formatCurrency(data.shippingAmount), pageWidth - margin - 2, y, { align: 'right' })
    y += 5
  }

  pdf.setLineWidth(0.5)
  pdf.line(totalsX, y, pageWidth - margin, y)
  y += 5

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('TOTAL:', totalsX, y)
  pdf.text(formatCurrency(data.totalAmount), pageWidth - margin - 2, y, { align: 'right' })

  // Memo
  if (data.memo) {
    y += 15
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Notes:', margin, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    const memoLines = pdf.splitTextToSize(data.memo, contentWidth - 10)
    pdf.text(memoLines, margin, y)
  }

  // Footer
  const footerY = pageHeight - 10
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(128, 128, 128)
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, footerY)
  pdf.text('Page 1', pageWidth - margin, footerY, { align: 'right' })

  // Return as Buffer
  const arrayBuffer = pdf.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString()
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    DRAFT: 'Draft',
    SENT: 'Sent',
    ACKNOWLEDGED: 'Acknowledged',
    PARTIAL: 'Partially Received',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled',
    ON_HOLD: 'On Hold'
  }
  return statusMap[status] || status
}

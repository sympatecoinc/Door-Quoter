// Field Verification PDF Generation Utility
// Generates a printable field verification document with opening dimensions
// and blank columns for field workers to write in actual measurements

import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import QRCode from 'qrcode'
import { downloadFile } from './gcs-storage'

export interface FieldVerificationOpening {
  name: string
  roughWidth: number | null
  roughHeight: number | null
  finishedWidth: number | null
  finishedHeight: number | null
  openingType: string | null // "THINWALL" or "FRAMED"
}

export interface FieldVerificationData {
  projectName: string
  customerName?: string
  companyLogo?: string | null
  openings: FieldVerificationOpening[]
  generatedDate: string
  verificationUrl?: string  // URL for mobile photo upload interface
}

// Page layout constants
const PAGE_WIDTH = 215.9 // 8.5" in mm
const PAGE_HEIGHT = 279.4 // 11" in mm
const MARGIN = 15
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

// Column widths for table
const COL_NAME = 38
const COL_ROUGH_SPEC = 28
const COL_ROUGH_ACTUAL = 28
const COL_FINISHED_SPEC = 28
const COL_FINISHED_ACTUAL = 28
const COL_NOTES = 36

const ROW_HEIGHT = 10 // Larger row height to allow space for handwriting
const HEADER_HEIGHT = 8

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

/**
 * Formats dimension as W×H string or dash if missing
 */
function formatDimension(width: number | null, height: number | null): string {
  if (width === null || height === null) return '-'
  return `${width}" × ${height}"`
}

/**
 * Natural sort comparison for opening names
 */
function naturalSortCompare(a: string, b: string): number {
  const aParts = a.split(/(\d+)/)
  const bParts = b.split(/(\d+)/)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''

    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

/**
 * Creates a Field Verification PDF with opening dimensions and blank columns for actual measurements
 */
export async function createFieldVerificationPDF(data: FieldVerificationData): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  let yPos = MARGIN
  let pageNumber = 1

  // Logo constants
  const logoMaxWidth = 40
  const logoMaxHeight = 15

  // Add company logo in top right if available
  if (data.companyLogo) {
    try {
      let logoBuffer: Buffer | null = null
      let logoMimeType = 'image/png'

      // Try to parse as JSON (new GCS format)
      try {
        const logoInfo = JSON.parse(data.companyLogo)
        if (logoInfo.gcsPath) {
          logoBuffer = await downloadFile(logoInfo.gcsPath)
          logoMimeType = logoInfo.mimeType || 'image/png'
        }
      } catch {
        // Legacy format - try filesystem
        const logoPath = path.join(process.cwd(), 'uploads', 'branding', data.companyLogo)
        if (fs.existsSync(logoPath)) {
          logoBuffer = fs.readFileSync(logoPath)
          const logoExt = path.extname(data.companyLogo).toLowerCase()
          logoMimeType = logoExt === '.svg' ? 'image/svg+xml' :
                        logoExt === '.jpg' || logoExt === '.jpeg' ? 'image/jpeg' : 'image/png'
        }
      }

      if (logoBuffer) {
        const logoExt = logoMimeType.split('/')[1]
        let processedLogoBuffer: Buffer
        let imageFormat: 'PNG' | 'JPEG' = 'PNG'

        if (logoExt === 'svg+xml' || logoExt === 'svg') {
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

        // Get actual dimensions after processing to calculate aspect ratio
        const processedMetadata = await sharp(processedLogoBuffer).metadata()
        const imgWidth = processedMetadata.width || 600
        const imgHeight = processedMetadata.height || 200

        // Calculate scaled dimensions preserving aspect ratio
        const aspectRatio = imgWidth / imgHeight
        let finalWidth = logoMaxWidth
        let finalHeight = logoMaxWidth / aspectRatio

        // If height exceeds max, scale down based on height instead
        if (finalHeight > logoMaxHeight) {
          finalHeight = logoMaxHeight
          finalWidth = logoMaxHeight * aspectRatio
        }

        const logoBase64 = processedLogoBuffer.toString('base64')
        const mimeType = imageFormat === 'JPEG' ? 'image/jpeg' :
                         (logoExt === 'svg' || logoExt === 'svg+xml' ? 'image/svg+xml' : 'image/png')
        const logoData = `data:${mimeType};base64,${logoBase64}`

        const logoX = PAGE_WIDTH - MARGIN - finalWidth
        pdf.addImage(logoData, imageFormat, logoX, yPos, finalWidth, finalHeight, undefined, 'SLOW')
      }
    } catch (error) {
      console.error('Error adding company logo to Field Verification PDF:', error)
    }
  }

  // Title (left-aligned)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Field Verification', MARGIN, yPos + 5)
  yPos += 12

  // Project name
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(data.projectName, MARGIN, yPos)
  yPos += 6

  // Customer name if available
  if (data.customerName) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 100, 100)
    pdf.text(data.customerName, MARGIN, yPos)
    pdf.setTextColor(0, 0, 0)
    yPos += 5
  }

  // Generated date
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  pdf.text(`Generated: ${data.generatedDate}  |  Total Openings: ${data.openings.length}`, MARGIN, yPos)
  pdf.setTextColor(0, 0, 0)
  yPos += 10

  if (data.openings.length === 0) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(100, 100, 100)
    pdf.text('No openings found for this project.', PAGE_WIDTH / 2, yPos + 20, { align: 'center' })
    return Buffer.from(pdf.output('arraybuffer'))
  }

  // Sort openings by name using natural sort
  const sortedOpenings = [...data.openings].sort((a, b) =>
    naturalSortCompare(a.name || '', b.name || '')
  )

  // Helper to draw table header
  const drawTableHeader = () => {
    // Main header row background
    pdf.setFillColor(79, 70, 229) // Indigo
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, HEADER_HEIGHT, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)

    let xPos = MARGIN + 2

    // Opening Name
    pdf.text('Opening', xPos, yPos + 5.5)
    xPos += COL_NAME

    // Rough Opening columns
    pdf.text('Rough W×H', xPos + (COL_ROUGH_SPEC + COL_ROUGH_ACTUAL) / 2, yPos + 5.5, { align: 'center' })

    // Finished Opening columns
    const finishedStart = xPos + COL_ROUGH_SPEC + COL_ROUGH_ACTUAL
    pdf.text('Finished W×H', finishedStart + (COL_FINISHED_SPEC + COL_FINISHED_ACTUAL) / 2, yPos + 5.5, { align: 'center' })

    // Notes
    const notesStart = finishedStart + COL_FINISHED_SPEC + COL_FINISHED_ACTUAL
    pdf.text('Notes', notesStart + COL_NOTES / 2, yPos + 5.5, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    yPos += HEADER_HEIGHT

    // Sub-header row with Spec/Actual labels
    pdf.setFillColor(240, 240, 240)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, 6, 'F')

    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(100, 100, 100)

    xPos = MARGIN + 2 + COL_NAME
    pdf.text('Spec', xPos + COL_ROUGH_SPEC / 2, yPos + 4, { align: 'center' })
    xPos += COL_ROUGH_SPEC
    pdf.text('Actual', xPos + COL_ROUGH_ACTUAL / 2, yPos + 4, { align: 'center' })
    xPos += COL_ROUGH_ACTUAL
    pdf.text('Spec', xPos + COL_FINISHED_SPEC / 2, yPos + 4, { align: 'center' })
    xPos += COL_FINISHED_SPEC
    pdf.text('Actual', xPos + COL_FINISHED_ACTUAL / 2, yPos + 4, { align: 'center' })

    pdf.setTextColor(0, 0, 0)
    yPos += 6
  }

  // Helper to draw dashed underline for handwriting space
  const drawDashedUnderline = (x: number, y: number, width: number) => {
    pdf.setDrawColor(180, 180, 180)
    pdf.setLineWidth(0.3)

    const dashLength = 2
    const gapLength = 1.5
    let currentX = x
    const endX = x + width - 4 // Leave margin

    while (currentX < endX) {
      const dashEnd = Math.min(currentX + dashLength, endX)
      pdf.line(currentX, y, dashEnd, y)
      currentX = dashEnd + gapLength
    }
  }

  // Helper to check for new page
  const checkNewPage = (neededSpace: number): boolean => {
    if (yPos + neededSpace > PAGE_HEIGHT - MARGIN - 10) {
      // Add page number to current page
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Page ${pageNumber}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
      pdf.setTextColor(0, 0, 0)

      // Add new page
      pdf.addPage()
      yPos = MARGIN
      pageNumber++
      return true
    }
    return false
  }

  // Draw initial table header
  drawTableHeader()

  // Render openings
  for (let i = 0; i < sortedOpenings.length; i++) {
    const opening = sortedOpenings[i]

    // Check if we need a new page
    if (checkNewPage(ROW_HEIGHT + HEADER_HEIGHT + 6)) {
      drawTableHeader()
    }

    // Alternating row background
    if (i % 2 === 0) {
      pdf.setFillColor(250, 250, 250)
    } else {
      pdf.setFillColor(255, 255, 255)
    }
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, ROW_HEIGHT, 'F')

    // Draw row border
    pdf.setDrawColor(230, 230, 230)
    pdf.setLineWidth(0.2)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, ROW_HEIGHT, 'S')

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')

    let xPos = MARGIN + 2

    // Opening Name
    pdf.setFont('helvetica', 'bold')
    const truncatedName = truncateText(pdf, opening.name, COL_NAME - 4)
    pdf.text(truncatedName, xPos, yPos + 6.5)
    pdf.setFont('helvetica', 'normal')
    xPos += COL_NAME

    // Rough Opening columns - only show for FRAMED (trimmed) openings
    if (opening.openingType !== 'THINWALL') {
      const roughSpec = formatDimension(opening.roughWidth, opening.roughHeight)
      pdf.text(roughSpec, xPos + COL_ROUGH_SPEC / 2, yPos + 6.5, { align: 'center' })
      xPos += COL_ROUGH_SPEC
      drawDashedUnderline(xPos, yPos + 7.5, COL_ROUGH_ACTUAL)
      xPos += COL_ROUGH_ACTUAL
    } else {
      // Grey out rough columns for thinwall openings
      pdf.setFillColor(235, 235, 235)
      pdf.rect(xPos, yPos, COL_ROUGH_SPEC + COL_ROUGH_ACTUAL, ROW_HEIGHT, 'F')
      xPos += COL_ROUGH_SPEC + COL_ROUGH_ACTUAL
    }

    // Finished Opening columns - only show for THINWALL openings
    if (opening.openingType === 'THINWALL') {
      const finishedSpec = formatDimension(opening.finishedWidth, opening.finishedHeight)
      pdf.text(finishedSpec, xPos + COL_FINISHED_SPEC / 2, yPos + 6.5, { align: 'center' })
      xPos += COL_FINISHED_SPEC
      drawDashedUnderline(xPos, yPos + 7.5, COL_FINISHED_ACTUAL)
      xPos += COL_FINISHED_ACTUAL
    } else {
      // Grey out finished columns for trimmed/framed openings
      pdf.setFillColor(235, 235, 235)
      pdf.rect(xPos, yPos, COL_FINISHED_SPEC + COL_FINISHED_ACTUAL, ROW_HEIGHT, 'F')
      xPos += COL_FINISHED_SPEC + COL_FINISHED_ACTUAL
    }

    // Notes column (blank with dashed underline)
    drawDashedUnderline(xPos, yPos + 7.5, COL_NOTES)

    yPos += ROW_HEIGHT
  }

  // Add signature section at bottom
  const signatureSpace = 40
  if (checkNewPage(signatureSpace)) {
    // If we had to add a page, just continue
  }

  yPos += 15
  pdf.setDrawColor(200, 200, 200)
  pdf.setLineWidth(0.5)
  pdf.line(MARGIN, yPos, MARGIN + CONTENT_WIDTH, yPos)
  yPos += 10

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(0, 0, 0)

  // Verified By line
  pdf.text('Verified By:', MARGIN, yPos)
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN + 25, yPos, MARGIN + 85, yPos)

  // Date line
  pdf.text('Date:', MARGIN + 95, yPos)
  pdf.line(MARGIN + 108, yPos, MARGIN + 155, yPos)

  // Digital Upload Section (with QR code)
  if (data.verificationUrl) {
    // Check if we need a new page for the upload section (needs ~70mm space)
    const uploadSectionHeight = 70
    if (yPos + uploadSectionHeight > PAGE_HEIGHT - MARGIN - 15) {
      // Add page number to current page before adding new page
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Page ${pageNumber}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })
      pdf.setTextColor(0, 0, 0)

      pdf.addPage()
      yPos = MARGIN
      pageNumber++
    } else {
      yPos += 15
    }

    // Draw section box
    const sectionBoxHeight = 60
    pdf.setDrawColor(180, 180, 180)
    pdf.setLineWidth(0.5)
    pdf.rect(MARGIN, yPos, CONTENT_WIDTH, sectionBoxHeight)

    // Section title
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)
    pdf.text('Upload Completed Form', MARGIN + CONTENT_WIDTH / 2, yPos + 8, { align: 'center' })

    // Generate and add QR code
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(data.verificationUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M'
      })

      const qrSize = 28  // QR code size in mm
      const qrX = MARGIN + 10
      const qrY = yPos + 14

      pdf.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      // Instructions text (to the right of QR code)
      const instructionsX = qrX + qrSize + 10

      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(60, 60, 60)

      const instruction1 = 'Scan this QR code with your phone to'
      const instruction2 = 'upload a photo of the completed form.'
      const instruction3 = 'Take a clear photo showing all written'
      const instruction4 = 'measurements before uploading.'

      pdf.text(instruction1, instructionsX, qrY + 6)
      pdf.text(instruction2, instructionsX, qrY + 12)
      pdf.text(instruction3, instructionsX, qrY + 22)
      pdf.text(instruction4, instructionsX, qrY + 28)

    } catch (error) {
      console.error('Error adding QR code to Field Verification PDF:', error)
    }

    yPos += sectionBoxHeight
  }

  // Add final page number
  pdf.setFontSize(8)
  pdf.setTextColor(150, 150, 150)
  pdf.text(`Page ${pageNumber}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: 'center' })

  return Buffer.from(pdf.output('arraybuffer'))
}

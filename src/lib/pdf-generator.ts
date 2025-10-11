// PDF Generation Utility for Shop Drawings
// Uses jsPDF to create properly formatted shop drawing PDFs

import { jsPDF } from 'jspdf'

export interface DrawingImageData {
  productName: string
  imageData: string // base64 PNG data
  width: number // inches
  height: number // inches
}

export interface OpeningDrawingData {
  openingNumber: string
  openingName: string
  totalWidth: number // inches
  totalHeight: number // inches
  elevationImages: DrawingImageData[]
  planViews?: DrawingImageData[]
}

export interface ProjectDrawingData {
  projectName: string
  projectId: number
  openings: OpeningDrawingData[]
}

/**
 * Creates a PDF for a single opening with elevation and plan views
 */
export function createSingleOpeningPDF(
  projectName: string,
  openingData: OpeningDrawingData
): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  let pageNum = 0

  // Page 1: Elevation View
  if (openingData.elevationImages && openingData.elevationImages.length > 0) {
    if (pageNum > 0) pdf.addPage()
    addElevationPage(pdf, projectName, openingData)
    pageNum++
  }

  // Page 2: Plan View
  if (openingData.planViews && openingData.planViews.length > 0) {
    if (pageNum > 0) pdf.addPage()
    addPlanViewPage(pdf, projectName, openingData)
    pageNum++
  }

  return pdf
}

/**
 * Creates a multi-page PDF for all openings in a project
 */
export function createMultiOpeningPDF(projectData: ProjectDrawingData): jsPDF {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  })

  // Page 1: Cover page
  addCoverPage(pdf, projectData)

  // Add pages for each opening (2 pages per opening: elevation + plan)
  projectData.openings.forEach((opening, index) => {
    // Elevation view
    if (opening.elevationImages && opening.elevationImages.length > 0) {
      pdf.addPage()
      addElevationPage(pdf, projectData.projectName, opening)
    }

    // Plan view
    if (opening.planViews && opening.planViews.length > 0) {
      pdf.addPage()
      addPlanViewPage(pdf, projectData.projectName, opening)
    }
  })

  return pdf
}

/**
 * Adds a cover page to the PDF
 */
function addCoverPage(pdf: jsPDF, projectData: ProjectDrawingData): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Title
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SHOP DRAWINGS', pageWidth / 2, 40, { align: 'center' })

  // Project name
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'normal')
  pdf.text(projectData.projectName, pageWidth / 2, 55, { align: 'center' })

  // Line separator
  pdf.setLineWidth(0.5)
  pdf.line(30, 65, pageWidth - 30, 65)

  // Project info
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  const infoY = 80
  pdf.text(`Project ID: ${projectData.projectId}`, 30, infoY)
  pdf.text(`Total Openings: ${projectData.openings.length}`, 30, infoY + 8)
  pdf.text(`Date Generated: ${new Date().toLocaleDateString()}`, 30, infoY + 16)

  // Table of contents
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('TABLE OF CONTENTS', 30, infoY + 35)

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  let tocY = infoY + 45
  let pageCounter = 2 // Start after cover page

  projectData.openings.forEach((opening) => {
    if (tocY > pageHeight - 30) {
      pdf.addPage()
      tocY = 30
    }

    const hasElevation = opening.elevationImages && opening.elevationImages.length > 0
    const hasPlan = opening.planViews && opening.planViews.length > 0

    if (hasElevation) {
      pdf.text(`Opening ${opening.openingNumber} - Elevation View`, 35, tocY)
      pdf.text(`${pageCounter}`, pageWidth - 35, tocY, { align: 'right' })
      tocY += 6
      pageCounter++
    }

    if (hasPlan) {
      pdf.text(`Opening ${opening.openingNumber} - Plan View`, 35, tocY)
      pdf.text(`${pageCounter}`, pageWidth - 35, tocY, { align: 'right' })
      tocY += 6
      pageCounter++
    }

    tocY += 2 // Extra space between openings
  })

  // Footer
  addFooter(pdf, projectData.projectName, '', 1)
}

/**
 * Adds an elevation view page to the PDF
 */
function addElevationPage(
  pdf: jsPDF,
  projectName: string,
  openingData: OpeningDrawingData
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Title block
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SHOP DRAWING - ELEVATION VIEW', pageWidth / 2, 15, { align: 'center' })

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Opening ${openingData.openingNumber} - ${openingData.openingName}`, pageWidth / 2, 23, {
    align: 'center'
  })

  // Dimensions
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W × ${openingData.totalHeight}" H`,
    pageWidth / 2,
    30,
    { align: 'center' }
  )

  // Calculate available space for images
  const marginTop = 40
  const marginBottom = 25
  const marginSide = 15
  const availableWidth = pageWidth - 2 * marginSide
  const availableHeight = pageHeight - marginTop - marginBottom

  // Combine all elevation images side by side
  const totalImageWidth = openingData.elevationImages.reduce((sum, img) => sum + img.width, 0)
  const maxImageHeight = Math.max(...openingData.elevationImages.map((img) => img.height))

  // Calculate scale to fit images on page
  const scaleByWidth = availableWidth / totalImageWidth
  const scaleByHeight = availableHeight / maxImageHeight
  const scale = Math.min(scaleByWidth, scaleByHeight, 1) // Don't scale up, only down

  // Center the images horizontally
  const scaledTotalWidth = totalImageWidth * scale
  let currentX = (pageWidth - scaledTotalWidth) / 2

  // Add each image side by side
  openingData.elevationImages.forEach((img) => {
    const imgWidth = img.width * scale
    const imgHeight = img.height * scale

    // Center vertically in available space
    const imgY = marginTop + (availableHeight - imgHeight) / 2

    try {
      const imgData = img.imageData.startsWith('data:')
        ? img.imageData
        : `data:image/png;base64,${img.imageData}`

      pdf.addImage(imgData, 'PNG', currentX, imgY, imgWidth, imgHeight)
    } catch (error) {
      console.error('Error adding elevation image to PDF:', error)
      // Draw placeholder rectangle
      pdf.setDrawColor(200, 200, 200)
      pdf.rect(currentX, imgY, imgWidth, imgHeight)
      pdf.setFontSize(8)
      pdf.text('Image Error', currentX + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' })
    }

    currentX += imgWidth
  })

  // Component labels
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  const labelsY = marginTop + availableHeight + 3
  const labelText = openingData.elevationImages.map((img) => img.productName).join(' + ')
  pdf.text(labelText, pageWidth / 2, labelsY, { align: 'center' })

  // Footer
  addFooter(pdf, projectName, `Opening ${openingData.openingNumber}`)
}

/**
 * Adds a plan view page to the PDF
 */
function addPlanViewPage(
  pdf: jsPDF,
  projectName: string,
  openingData: OpeningDrawingData
): void {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Title block
  pdf.setFontSize(16)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SHOP DRAWING - PLAN VIEW', pageWidth / 2, 15, { align: 'center' })

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Opening ${openingData.openingNumber} - ${openingData.openingName}`, pageWidth / 2, 23, {
    align: 'center'
  })

  // Dimensions
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W`,
    pageWidth / 2,
    30,
    { align: 'center' }
  )

  // Calculate available space for images
  const marginTop = 40
  const marginBottom = 25
  const marginSide = 15
  const availableWidth = pageWidth - 2 * marginSide
  const availableHeight = pageHeight - marginTop - marginBottom

  if (!openingData.planViews || openingData.planViews.length === 0) {
    pdf.setFontSize(12)
    pdf.text('No plan view available', pageWidth / 2, pageHeight / 2, { align: 'center' })
    addFooter(pdf, projectName, `Opening ${openingData.openingNumber}`)
    return
  }

  // Combine all plan view images side by side
  const totalImageWidth = openingData.planViews.reduce((sum, img) => sum + img.width, 0)
  const maxImageHeight = Math.max(...openingData.planViews.map((img) => img.height))

  // Calculate scale to fit images on page
  const scaleByWidth = availableWidth / totalImageWidth
  const scaleByHeight = availableHeight / maxImageHeight
  const scale = Math.min(scaleByWidth, scaleByHeight, 1) // Don't scale up, only down

  // Center the images horizontally
  const scaledTotalWidth = totalImageWidth * scale
  let currentX = (pageWidth - scaledTotalWidth) / 2

  // Add each image side by side
  openingData.planViews.forEach((img) => {
    const imgWidth = img.width * scale
    const imgHeight = img.height * scale

    // Center vertically in available space
    const imgY = marginTop + (availableHeight - imgHeight) / 2

    try {
      const imgData = img.imageData.startsWith('data:')
        ? img.imageData
        : `data:image/png;base64,${img.imageData}`

      pdf.addImage(imgData, 'PNG', currentX, imgY, imgWidth, imgHeight)
    } catch (error) {
      console.error('Error adding plan view image to PDF:', error)
      // Draw placeholder rectangle
      pdf.setDrawColor(200, 200, 200)
      pdf.rect(currentX, imgY, imgWidth, imgHeight)
      pdf.setFontSize(8)
      pdf.text('Image Error', currentX + imgWidth / 2, imgY + imgHeight / 2, { align: 'center' })
    }

    currentX += imgWidth
  })

  // Component labels
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  const labelsY = marginTop + availableHeight + 3
  const labelText = openingData.planViews.map((img) => `${img.productName}`).join(' + ')
  pdf.text(labelText, pageWidth / 2, labelsY, { align: 'center' })

  // Footer
  addFooter(pdf, projectName, `Opening ${openingData.openingNumber}`)
}

/**
 * Adds a footer to the current page
 */
function addFooter(
  pdf: jsPDF,
  projectName: string,
  openingInfo: string,
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

  // Center: Opening info
  if (openingInfo) {
    pdf.text(openingInfo, pageWidth / 2, footerY, { align: 'center' })
  }

  // Right: Date and page number
  const dateText = new Date().toLocaleDateString()
  const currentPage = pageNum || pdf.getCurrentPageInfo().pageNumber
  pdf.text(`${dateText} | Page ${currentPage}`, pageWidth - 15, footerY, { align: 'right' })

  // Reset text color
  pdf.setTextColor(0, 0, 0)
}

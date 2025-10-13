// PDF Generation Utility for Shop Drawings
// Uses jsPDF to create properly formatted shop drawing PDFs

import { jsPDF } from 'jspdf'

export interface DrawingImageData {
  productName: string
  imageData: string // base64 PNG data
  width: number // inches
  height: number // inches
  type?: string // Panel type
  glassType?: string
  locking?: string
  swingDirection?: string
  slidingDirection?: string
  hardware?: string // Hardware/sub-options
  productType?: string // SWING_DOOR, SLIDING_DOOR, FIXED_PANEL, etc.
  orientation?: string // Plan view orientation: 'bottom' or 'top'
  planViewName?: string // Plan view direction name
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
 * Uses 11x17 landscape format with both views on one page
 */
export function createSingleOpeningPDF(
  projectName: string,
  openingData: OpeningDrawingData
): jsPDF {
  // 11x17 inches = 279.4mm x 431.8mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [279.4, 431.8] // 11x17 in mm
  })

  // Combined page: Both elevation and plan views
  addCombinedViewPage(pdf, projectName, openingData)

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
 * Adds a combined page with both elevation and plan views (11x17 landscape)
 */
function addCombinedViewPage(
  pdf: jsPDF,
  projectName: string,
  openingData: OpeningDrawingData
): void {
  const pageWidth = pdf.internal.pageSize.getWidth() // 431.8mm
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4mm

  // Title block (centered)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SHOP DRAWING', pageWidth / 2, 12, { align: 'center' })

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Opening ${openingData.openingNumber} - ${openingData.openingName}`, pageWidth / 2, 20, {
    align: 'center'
  })

  // Dimensions with tolerance
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W (+/- 1") × ${openingData.totalHeight}" H`,
    pageWidth / 2,
    27,
    { align: 'center' }
  )

  // Divider line
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(150, 150, 150)
  pdf.line(15, 32, pageWidth - 15, 32)

  // Door Schedule Table (top left, below header) - matching modal design
  const scheduleX = 15
  const scheduleY = 38 // Below divider line
  const rowHeight = 6

  // Schedule title and opening info
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('DOOR SCHEDULE', scheduleX, scheduleY)

  // Opening info on second line
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  const maxNameLength = 40
  const displayName = openingData.openingName.length > maxNameLength
    ? openingData.openingName.substring(0, maxNameLength) + '...'
    : openingData.openingName
  pdf.text(`Opening ${openingData.openingNumber}: ${displayName} | ${openingData.totalWidth}" W × ${openingData.totalHeight}" H`, scheduleX, scheduleY + 5)

  // Component table with same columns as modal: Opening Name, Direction, Glass, Hardware
  const tableStartY = scheduleY + 10
  const colWidths = {
    openingName: 60,  // Product name
    direction: 35,
    glass: 40,
    hardware: 50
  }

  // Table header - simple borders only, no background fills
  pdf.setLineWidth(0.3)
  pdf.setDrawColor(100, 100, 100)

  let currentX = scheduleX
  pdf.rect(currentX, tableStartY, colWidths.openingName, rowHeight)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('Opening Name', currentX + 3, tableStartY + 4)

  currentX += colWidths.openingName
  pdf.rect(currentX, tableStartY, colWidths.direction, rowHeight)
  pdf.text('Direction', currentX + 3, tableStartY + 4)

  currentX += colWidths.direction
  pdf.rect(currentX, tableStartY, colWidths.glass, rowHeight)
  pdf.text('Glass', currentX + 3, tableStartY + 4)

  currentX += colWidths.glass
  pdf.rect(currentX, tableStartY, colWidths.hardware, rowHeight)
  pdf.text('Hardware', currentX + 3, tableStartY + 4)

  // Table rows - borders only, no fills
  let currentY = tableStartY + rowHeight
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(0, 0, 0)

  openingData.elevationImages.forEach((component, index) => {
    currentX = scheduleX

    // Opening Name (Product name)
    pdf.rect(currentX, currentY, colWidths.openingName, rowHeight)
    const truncatedName = component.productName.length > 30
      ? component.productName.substring(0, 28) + '..'
      : component.productName
    pdf.text(truncatedName, currentX + 3, currentY + 4)

    // Direction (based on product type)
    currentX += colWidths.openingName
    pdf.rect(currentX, currentY, colWidths.direction, rowHeight)
    let directionText = 'N/A'
    if (component.productType === 'SWING_DOOR') {
      directionText = component.swingDirection || 'None'
    } else if (component.productType === 'SLIDING_DOOR') {
      directionText = component.slidingDirection || 'Left'
    } else if (component.productType === 'FIXED_PANEL') {
      directionText = 'Fixed'
    }
    pdf.text(directionText, currentX + 3, currentY + 4)

    // Glass
    currentX += colWidths.direction
    pdf.rect(currentX, currentY, colWidths.glass, rowHeight)
    const glassText = component.glassType || 'N/A'
    const truncatedGlass = glassText.length > 18 ? glassText.substring(0, 16) + '..' : glassText
    pdf.text(truncatedGlass, currentX + 3, currentY + 4)

    // Hardware
    currentX += colWidths.glass
    pdf.rect(currentX, currentY, colWidths.hardware, rowHeight)
    const hardwareText = component.hardware || 'None'
    const truncatedHardware = hardwareText.length > 22 ? hardwareText.substring(0, 20) + '..' : hardwareText
    pdf.text(truncatedHardware, currentX + 3, currentY + 4)

    currentY += rowHeight
  })

  // Reset text color
  pdf.setTextColor(0, 0, 0)

  // Calculate layout: Elevation bottom left, Plan view top right
  const marginTop = 40
  const marginBottom = 25
  const marginSide = 20  // Increased from 15 to 20
  const middleGap = 15   // Increased from 10 to 15
  const sectionPadding = 8  // Internal padding within each section

  const availableWidth = pageWidth - 2 * marginSide - middleGap
  const availableHeight = pageHeight - marginTop - marginBottom

  // Left section for elevation (50% of width, bottom half) - aligned with door schedule at x=15
  const elevationWidth = availableWidth * 0.50 - 2 * sectionPadding
  const elevationX = scheduleX  // Align with door schedule left edge
  const elevationHeight = availableHeight * 0.5 - 2 * sectionPadding
  const elevationY = marginTop + availableHeight * 0.5 + sectionPadding // Start at middle

  // Right section for plan view (50% of width, top section) - decreased from 55%
  const planViewWidth = availableWidth * 0.50 - 2 * sectionPadding
  const planViewX = elevationX + elevationWidth + middleGap + sectionPadding
  const planViewHeight = availableHeight * 0.6 - 2 * sectionPadding
  const planViewY = marginTop + sectionPadding

  // Draw elevation view at bottom left
  if (openingData.elevationImages && openingData.elevationImages.length > 0) {
    // Section label
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('ELEVATION VIEW', elevationX + elevationWidth / 2, elevationY - 5, { align: 'center' })

    // Use fixed pixels-per-inch scale (same as modal: 4 pixels per inch)
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // Calculate total width and max height at this fixed scale
    const totalElevationWidthMm = openingData.elevationImages.reduce((sum, img) => sum + (img.width * mmPerDisplayInch), 0)
    const maxElevationHeightMm = Math.max(...openingData.elevationImages.map((img) => img.height * mmPerDisplayInch))

    // Scale down to fit in elevation section (allow up to 0.8 scale for better prominence)
    const scaleByWidth = elevationWidth / totalElevationWidthMm
    const scaleByHeight = elevationHeight / maxElevationHeightMm
    const elevationScale = Math.min(scaleByWidth, scaleByHeight, 0.8) // Max 0.8 for ~14% larger display

    // Left-align (starting at elevationX, which is aligned with door schedule)
    const scaledTotalWidthMm = totalElevationWidthMm * elevationScale
    const scaledMaxHeightMm = maxElevationHeightMm * elevationScale
    let currentX = elevationX  // Start at left edge (aligned with door schedule)

    openingData.elevationImages.forEach((img) => {
      // Calculate size using consistent scaling
      const imgWidthMm = img.width * mmPerDisplayInch * elevationScale
      const imgHeightMm = img.height * mmPerDisplayInch * elevationScale

      // Align to bottom edge (items-end / baseline alignment like modal)
      const imgY = elevationY + elevationHeight - imgHeightMm

      try {
        const imgData = img.imageData.startsWith('data:')
          ? img.imageData
          : `data:image/png;base64,${img.imageData}`

        pdf.addImage(imgData, 'PNG', currentX, imgY, imgWidthMm, imgHeightMm)
      } catch (error) {
        console.error('Error adding elevation image to PDF:', error)
        pdf.setDrawColor(200, 200, 200)
        pdf.rect(currentX, imgY, imgWidthMm, imgHeightMm)
      }

      currentX += imgWidthMm
    })

    // Component labels below elevation
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    const labelText = openingData.elevationImages.map((img) => img.productName).join(' + ')
    pdf.text(labelText, elevationX + elevationWidth / 2, elevationY + elevationHeight + 5, {
      align: 'center'
    })
  }

  // Draw plan view at top right
  if (openingData.planViews && openingData.planViews.length > 0) {
    // Section label
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PLAN VIEW', planViewX + planViewWidth / 2, 37, { align: 'center' })

    // Use fixed pixels-per-inch scale (same as modal: 4 pixels per inch)
    // Convert to mm: 1 inch = 25.4mm, so 4px/inch = 25.4/4 = 6.35mm per "display inch"
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // Calculate total width at this fixed scale
    const totalPlanWidthMm = openingData.planViews.reduce((sum, img) => sum + (img.width * mmPerDisplayInch), 0)
    const maxPlanHeightMm = Math.max(...openingData.planViews.map((img) => img.height * mmPerDisplayInch))

    // Check if we need to scale down to fit
    const scaleByWidth = planViewWidth / totalPlanWidthMm
    const scaleByHeight = planViewHeight / maxPlanHeightMm
    const planScale = Math.min(scaleByWidth, scaleByHeight, 1) // Only scale down if needed

    // Calculate baseline Y position (50% of the plan view section, matching modal's top: 50%)
    const baselineY = planViewY + planViewHeight / 2

    // Calculate total width of all images to center the group horizontally
    const totalWidthMm = openingData.planViews.reduce((sum, img) => sum + (img.width * mmPerDisplayInch * planScale), 0)

    // Start X position - center the group horizontally (matching modal's translate(-50%, 0))
    let currentX = planViewX + (planViewWidth - totalWidthMm) / 2

    openingData.planViews.forEach((img, index) => {
      // Calculate size using consistent scaling
      const imgWidthMm = img.width * mmPerDisplayInch * planScale
      const imgHeightMm = img.height * mmPerDisplayInch * planScale

      // Debug logging
      console.log(`PDF Plan view ${index}: ${img.planViewName}, orientation: ${img.orientation}`)

      // Apply orientation offset (exact modal logic):
      // Modal uses: transform: `translateY(${translateY})`
      // - 'bottom': translateY = `-${displayHeight}px` (moves up by full height)
      // - 'top': translateY = `0px` (stays at baseline)
      let imgY = baselineY
      if (img.orientation === 'bottom') {
        // Move up by full height so bottom edge aligns to baseline
        imgY = baselineY - imgHeightMm
        console.log(`  -> Orientation 'bottom': offsetting UP by ${imgHeightMm}mm, imgY = ${imgY}`)
      } else {
        console.log(`  -> Orientation '${img.orientation || 'undefined'}': staying at baseline, imgY = ${imgY}`)
      }
      // else orientation === 'top': top edge stays at baseline (no offset)

      try {
        const imgData = img.imageData.startsWith('data:')
          ? img.imageData
          : `data:image/png;base64,${img.imageData}`

        pdf.addImage(imgData, 'PNG', currentX, imgY, imgWidthMm, imgHeightMm)
      } catch (error) {
        console.error('Error adding plan view image to PDF:', error)
        pdf.setDrawColor(200, 200, 200)
        pdf.rect(currentX, imgY, imgWidthMm, imgHeightMm)
      }

      currentX += imgWidthMm
    })

    // Component labels below plan view
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    const labelText = openingData.planViews.map((img) => `${img.productName} (${img.planViewName || 'Plan'})`).join(' + ')
    pdf.text(labelText, planViewX + planViewWidth / 2, planViewY + planViewHeight + 3, {
      align: 'center'
    })
  } else {
    // No plan view available message
    pdf.setFontSize(10)
    pdf.setTextColor(150, 150, 150)
    pdf.text('No plan view available', planViewX + planViewWidth / 2, planViewY + planViewHeight / 2, {
      align: 'center'
    })
    pdf.setTextColor(0, 0, 0)
  }

  // Footer
  addFooter(pdf, projectName, `Opening ${openingData.openingNumber}`)
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

  // Dimensions with tolerance
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W (+/- 1") × ${openingData.totalHeight}" H`,
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

  // Dimensions with tolerance (plan view only shows width)
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W (+/- 1")`,
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

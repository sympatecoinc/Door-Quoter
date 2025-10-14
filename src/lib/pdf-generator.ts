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
  productType?: string // SWING_DOOR, SLIDING_DOOR, FIXED_PANEL, CORNER_90, etc.
  orientation?: string // Plan view orientation: 'bottom' or 'top'
  planViewName?: string // Plan view direction name
  cornerDirection?: string // Corner direction: 'Up' or 'Down'
  isCorner?: boolean // Whether this is a corner marker
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

  // Component table with same columns as modal: Opening Name, Dimensions, Direction, Glass, Hardware
  const tableStartY = scheduleY + 10
  const colWidths = {
    openingName: 50,  // Product name (reduced to make room for dimensions)
    dimensions: 30,   // Width x Height
    direction: 30,    // Direction (reduced)
    glass: 35,        // Glass type (reduced)
    hardware: 40      // Hardware (reduced)
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
  pdf.rect(currentX, tableStartY, colWidths.dimensions, rowHeight)
  pdf.text('Dimensions', currentX + 3, tableStartY + 4)

  currentX += colWidths.dimensions
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
    const truncatedName = component.productName.length > 25
      ? component.productName.substring(0, 23) + '..'
      : component.productName
    pdf.text(truncatedName, currentX + 3, currentY + 4)

    // Dimensions (Width x Height)
    currentX += colWidths.openingName
    pdf.rect(currentX, currentY, colWidths.dimensions, rowHeight)
    const dimensionsText = `${component.width}" × ${component.height}"`
    pdf.text(dimensionsText, currentX + 3, currentY + 4)

    // Direction (based on product type)
    currentX += colWidths.dimensions
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
    const truncatedGlass = glassText.length > 15 ? glassText.substring(0, 13) + '..' : glassText
    pdf.text(truncatedGlass, currentX + 3, currentY + 4)

    // Hardware
    currentX += colWidths.glass
    pdf.rect(currentX, currentY, colWidths.hardware, rowHeight)
    const hardwareText = component.hardware || 'None'
    const truncatedHardware = hardwareText.length > 18 ? hardwareText.substring(0, 16) + '..' : hardwareText
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
    // Split images into rows based on corners (same logic as modal)
    const elevationRows: typeof openingData.elevationImages[] = []
    let currentRow: typeof openingData.elevationImages = []

    openingData.elevationImages.forEach((img) => {
      // If this is a corner, end the current row and start a new one
      if (img.productType === 'CORNER_90' && img.isCorner && currentRow.length > 0) {
        elevationRows.push(currentRow)
        currentRow = [img]
      } else {
        currentRow.push(img)
      }
    })

    // Push the last row
    if (currentRow.length > 0) {
      elevationRows.push(currentRow)
    }

    // Section label(s)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')

    if (elevationRows.length === 1) {
      pdf.text('ELEVATION VIEW', elevationX + elevationWidth / 2, elevationY - 5, { align: 'center' })
    } else {
      // Multiple rows - label them A, B, C, etc.
      pdf.text('ELEVATION VIEWS', elevationX + elevationWidth / 2, elevationY - 5, { align: 'center' })
    }

    // Use fixed pixels-per-inch scale (same as modal: 4 pixels per inch)
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // Calculate available height per row
    const rowSpacing = 3 // mm spacing between rows
    const availableHeightPerRow = (elevationHeight - (elevationRows.length - 1) * rowSpacing) / elevationRows.length

    let currentRowY = elevationY

    elevationRows.forEach((row, rowIndex) => {
      // Filter out corners (they don't render)
      const visibleImages = row.filter(img => img.productType !== 'CORNER_90')

      if (visibleImages.length === 0) return

      // Row label if multiple rows
      if (elevationRows.length > 1) {
        const rowLabel = String.fromCharCode(65 + rowIndex) // A, B, C, etc.
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'bold')
        pdf.text(rowLabel, elevationX - 5, currentRowY + availableHeightPerRow / 2, { align: 'right' })
      }

      // Calculate total width and max height for this row
      const totalRowWidthMm = visibleImages.reduce((sum, img) => sum + (img.width * mmPerDisplayInch), 0)
      const maxRowHeightMm = Math.max(...visibleImages.map((img) => img.height * mmPerDisplayInch))

      // Scale down to fit in elevation section
      const scaleByWidth = elevationWidth / totalRowWidthMm
      const scaleByHeight = availableHeightPerRow / maxRowHeightMm
      const rowScale = Math.min(scaleByWidth, scaleByHeight, 0.8)

      // Left-align (starting at elevationX)
      let currentX = elevationX

      visibleImages.forEach((img) => {
        // Calculate size using consistent scaling
        const imgWidthMm = img.width * mmPerDisplayInch * rowScale
        const imgHeightMm = img.height * mmPerDisplayInch * rowScale

        // Align to bottom edge of row
        const imgY = currentRowY + availableHeightPerRow - imgHeightMm

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

      currentRowY += availableHeightPerRow + rowSpacing
    })

    // Component labels below elevation
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    const labelText = openingData.elevationImages
      .filter(img => img.productType !== 'CORNER_90')
      .map((img) => {
        // Build component label with direction prefix if applicable
        let label = ''

        // Add direction prefix
        if (img.productType === 'SWING_DOOR' && img.swingDirection) {
          label = `${img.swingDirection} ${img.productName}`
        } else if (img.productType === 'SLIDING_DOOR' && img.slidingDirection) {
          label = `${img.slidingDirection} ${img.productName}`
        } else {
          label = img.productName
        }

        // Add dimensions
        label += ` (${img.width}" x ${img.height}")`

        return label
      }).join(' + ')
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
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // For now, just render horizontal panels (skip corners and vertical panels)
    // Filter out corners
    const horizontalPanels = openingData.planViews.filter(v => v.productType !== 'CORNER_90')

    console.log(`PDF Plan: Rendering ${horizontalPanels.length} horizontal panels (${openingData.planViews.length} total including corners)`)

    // Simple horizontal layout - just position panels side by side
    interface PanelPosition {
      view: typeof openingData.planViews[0]
      x: number
      y: number
      displayWidth: number
      displayHeight: number
      translateY: number
      imgData: string
    }

    const panelPositions: PanelPosition[] = []
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    let cumulativeX = 0

    horizontalPanels.forEach((view) => {
      const displayHeight = view.height * mmPerDisplayInch
      const displayWidth = view.width * mmPerDisplayInch

      const x = cumulativeX
      const y = 0
      const translateY = view.orientation === 'bottom' ? -displayHeight : 0

      // Update bounding box
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x + displayWidth)
      const yWithTranslate = y + translateY
      minY = Math.min(minY, yWithTranslate)
      maxY = Math.max(maxY, yWithTranslate + displayHeight)

      const imgData = view.imageData.startsWith('data:')
        ? view.imageData
        : `data:image/png;base64,${view.imageData}`

      panelPositions.push({
        view,
        x,
        y,
        displayWidth,
        displayHeight,
        translateY,
        imgData
      })

      cumulativeX += displayWidth
    })

    // Calculate center offset to center the entire assembly
    const assemblyWidth = maxX - minX
    const assemblyHeight = maxY - minY
    const centerOffsetX = -minX - assemblyWidth / 2
    const centerOffsetY = -minY - assemblyHeight / 2

    console.log(`PDF Plan: Assembly ${assemblyWidth.toFixed(1)}mm x ${assemblyHeight.toFixed(1)}mm, offset (${centerOffsetX.toFixed(1)}, ${centerOffsetY.toFixed(1)})`)

    // Check if we need to scale down to fit
    const scaleByWidth = planViewWidth / assemblyWidth
    const scaleByHeight = planViewHeight / assemblyHeight
    const planScale = Math.min(scaleByWidth, scaleByHeight, 1) // Only scale down if needed

    console.log(`PDF Plan: Scale factor ${planScale.toFixed(3)}`)

    // Center point of plan view section
    const centerX = planViewX + planViewWidth / 2
    const centerY = planViewY + planViewHeight / 2

    // Second pass: render all panels with center offset and scaling applied
    panelPositions.forEach((panel) => {
      const scaledWidth = panel.displayWidth * planScale
      const scaledHeight = panel.displayHeight * planScale

      // Apply center offset, then scale, then translate to center of section
      const finalX = centerX + (panel.x + centerOffsetX) * planScale
      const finalY = centerY + (panel.y + centerOffsetY + panel.translateY) * planScale

      try {
        pdf.addImage(panel.imgData, 'PNG', finalX, finalY, scaledWidth, scaledHeight)
      } catch (error) {
        console.error('Error adding plan view image to PDF:', error)
        pdf.setDrawColor(200, 200, 200)
        pdf.rect(finalX, finalY, scaledWidth, scaledHeight)
      }
    })

    // Component labels below plan view
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    const labelText = openingData.planViews
      .filter(v => v.productType !== 'CORNER_90')
      .map((img) => `${img.productName} (${img.planViewName || 'Plan'})`)
      .join(' + ')
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
  const labelText = openingData.elevationImages.map((img) => {
    // Build component label with direction prefix if applicable
    let label = ''

    // Add direction prefix
    if (img.productType === 'SWING_DOOR' && img.swingDirection) {
      label = `${img.swingDirection} ${img.productName}`
    } else if (img.productType === 'SLIDING_DOOR' && img.slidingDirection) {
      label = `${img.slidingDirection} ${img.productName}`
    } else {
      label = img.productName
    }

    // Add dimensions
    label += ` (${img.width}" x ${img.height}")`

    return label
  }).join(' + ')
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

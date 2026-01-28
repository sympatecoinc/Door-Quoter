// PDF Generation Utility for Shop Drawings
// Uses jsPDF to create properly formatted shop drawing PDFs

import { jsPDF } from 'jspdf'
import { rotateImage } from './image-rotator'

// Natural sort comparison for opening names (handles "2" before "10", "Office 1" before "Office 10")
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
  // Framed opening fields
  roughWidth?: number
  roughHeight?: number
  openingType?: string // "THINWALL" or "FRAMED"
  isFinishedOpening?: boolean
}

export interface ProjectDrawingData {
  projectName: string
  projectId: number
  openings: OpeningDrawingData[]
}

/**
 * Formats a decimal inch value to fractional format (e.g., 51.75 -> "51 3/4")
 */
function formatDimensionInches(value: number): string {
  const wholePart = Math.floor(value)
  const fractionalPart = value - wholePart

  // Common fractions to check (in order of precision)
  const fractions: Array<{ decimal: number; display: string }> = [
    { decimal: 0, display: '' },
    { decimal: 0.0625, display: '1/16' },
    { decimal: 0.125, display: '1/8' },
    { decimal: 0.1875, display: '3/16' },
    { decimal: 0.25, display: '1/4' },
    { decimal: 0.3125, display: '5/16' },
    { decimal: 0.375, display: '3/8' },
    { decimal: 0.4375, display: '7/16' },
    { decimal: 0.5, display: '1/2' },
    { decimal: 0.5625, display: '9/16' },
    { decimal: 0.625, display: '5/8' },
    { decimal: 0.6875, display: '11/16' },
    { decimal: 0.75, display: '3/4' },
    { decimal: 0.8125, display: '13/16' },
    { decimal: 0.875, display: '7/8' },
    { decimal: 0.9375, display: '15/16' },
    { decimal: 1, display: '' }
  ]

  // Find closest fraction
  let closestFraction = fractions[0]
  let minDiff = Math.abs(fractionalPart - fractions[0].decimal)

  for (const frac of fractions) {
    const diff = Math.abs(fractionalPart - frac.decimal)
    if (diff < minDiff) {
      minDiff = diff
      closestFraction = frac
    }
  }

  // Handle rounding up to next whole number
  if (closestFraction.decimal === 1) {
    return `${wholePart + 1}"`
  }

  if (closestFraction.display === '') {
    return `${wholePart}"`
  }

  return `${wholePart} ${closestFraction.display}"`
}

/**
 * Draws a horizontal dimension line with arrows and text
 * Used for width dimensions above the elevation
 */
function drawHorizontalDimension(
  pdf: jsPDF,
  x1: number,
  x2: number,
  y: number,
  dimensionText: string,
  labelText?: string,
  extensionLength: number = 8
): void {
  const arrowSize = 2
  const textOffset = 3

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.3)

  // Extension lines (vertical)
  pdf.line(x1, y + extensionLength, x1, y - extensionLength)
  pdf.line(x2, y + extensionLength, x2, y - extensionLength)

  // Dimension line (horizontal)
  pdf.line(x1, y, x2, y)

  // Left arrow
  pdf.line(x1, y, x1 + arrowSize, y - arrowSize / 2)
  pdf.line(x1, y, x1 + arrowSize, y + arrowSize / 2)

  // Right arrow
  pdf.line(x2, y, x2 - arrowSize, y - arrowSize / 2)
  pdf.line(x2, y, x2 - arrowSize, y + arrowSize / 2)

  // Dimension text (centered above the line) - large bold text
  const centerX = (x1 + x2) / 2
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text(dimensionText, centerX, y - textOffset - 1, { align: 'center' })

  // Optional label below (e.g., "OPENING")
  if (labelText) {
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(labelText, centerX, y + textOffset + 3, { align: 'center' })
  }
}

/**
 * Draws a vertical dimension line with arrows and text
 * Used for height dimensions to the right of the elevation
 */
function drawVerticalDimension(
  pdf: jsPDF,
  x: number,
  y1: number,
  y2: number,
  dimensionText: string,
  extensionLength: number = 8
): void {
  const arrowSize = 2
  const textOffset = 5

  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.3)

  // Extension lines (horizontal)
  pdf.line(x - extensionLength, y1, x + extensionLength, y1)
  pdf.line(x - extensionLength, y2, x + extensionLength, y2)

  // Dimension line (vertical)
  pdf.line(x, y1, x, y2)

  // Top arrow
  pdf.line(x, y1, x - arrowSize / 2, y1 + arrowSize)
  pdf.line(x, y1, x + arrowSize / 2, y1 + arrowSize)

  // Bottom arrow
  pdf.line(x, y2, x - arrowSize / 2, y2 - arrowSize)
  pdf.line(x, y2, x + arrowSize / 2, y2 - arrowSize)

  // Dimension text (rotated 90 degrees, centered along the line) - large bold text
  const centerY = (y1 + y2) / 2
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')

  // Save state, translate to position, rotate, draw text, restore
  // jsPDF text rotation: use the angle parameter
  pdf.text(dimensionText, x + textOffset + 2, centerY, {
    angle: 90,
    align: 'center'
  })
}

/**
 * Draws a hatched rectangle representing a wall section
 * Uses diagonal lines at 45 degrees for standard architectural wall indication
 */
function drawHatchedWall(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  hatchSpacing: number = 2
): void {
  // Draw outer rectangle
  pdf.setDrawColor(0, 0, 0)
  pdf.setLineWidth(0.3)
  pdf.rect(x, y, width, height)

  // Draw diagonal hatch lines at 45 degrees
  // Lines go from lower-left to upper-right (in visual terms)
  // In PDF coords: from (lower X, higher Y) to (higher X, lower Y)
  pdf.setLineWidth(0.15)

  // Parameter d represents offset along the diagonal
  // Each line satisfies: (x' - x) + (y' - y) = d for points on the line
  const totalDiagonal = width + height

  for (let d = hatchSpacing; d < totalDiagonal; d += hatchSpacing) {
    let x1: number, y1: number, x2: number, y2: number

    // Find the two intersection points of the line with the rectangle
    if (d <= width && d <= height) {
      // Line intersects left edge and top edge
      x1 = x
      y1 = y + d
      x2 = x + d
      y2 = y
    } else if (d <= width && d > height) {
      // Line intersects bottom edge and top edge
      x1 = x + (d - height)
      y1 = y + height
      x2 = x + d
      y2 = y
    } else if (d > width && d <= height) {
      // Line intersects left edge and right edge
      x1 = x
      y1 = y + d
      x2 = x + width
      y2 = y + (d - width)
    } else {
      // d > width && d > height
      // Line intersects bottom edge and right edge
      x1 = x + (d - height)
      y1 = y + height
      x2 = x + width
      y2 = y + (d - width)
    }

    pdf.line(x1, y1, x2, y2)
  }
}

/**
 * Creates a PDF for a single opening with elevation and plan views
 * Uses 11x17 landscape format with both views on one page
 */
export async function createSingleOpeningPDF(
  projectName: string,
  openingData: OpeningDrawingData
): Promise<jsPDF> {
  // 11x17 inches = 279.4mm x 431.8mm
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [279.4, 431.8] // 11x17 in mm
  })

  // Combined page: Both elevation and plan views
  await addCombinedViewPage(pdf, projectName, openingData)

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

  // Sort openings by name (natural alphanumeric sort)
  const sortedOpenings = [...projectData.openings].sort((a, b) => naturalSortCompare(a.openingName, b.openingName))

  // Add pages for each opening (2 pages per opening: elevation + plan)
  sortedOpenings.forEach((opening, index) => {
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
async function addCombinedViewPage(
  pdf: jsPDF,
  projectName: string,
  openingData: OpeningDrawingData
): Promise<void> {
  const pageWidth = pdf.internal.pageSize.getWidth() // 431.8mm
  const pageHeight = pdf.internal.pageSize.getHeight() // 279.4mm

  // Title block (centered)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('SHOP DRAWING', pageWidth / 2, 12, { align: 'center' })

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(openingData.openingName, pageWidth / 2, 20, {
    align: 'center'
  })

  // Framed Opening Size (if applicable)
  let dividerY = 32
  if (openingData.isFinishedOpening && openingData.roughWidth && openingData.roughHeight) {
    const sizeLabel = openingData.openingType === 'THINWALL' ? 'Finished' : 'Rough'
    const framedSizeText = `Framed Opening Size: ${openingData.roughWidth}" W × ${openingData.roughHeight}" H (${sizeLabel})`
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(framedSizeText, pageWidth / 2, 26, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    dividerY = 34
  }

  // Divider line
  pdf.setLineWidth(0.5)
  pdf.setDrawColor(150, 150, 150)
  pdf.line(15, dividerY, pageWidth - 15, dividerY)

  // Door Schedule Table (top left, below header) - matching modal design
  const scheduleX = 15
  const scheduleY = 38 // Below divider line
  const rowHeight = 6

  // Schedule title
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(0, 0, 0)
  pdf.text('DOOR SCHEDULE', scheduleX, scheduleY)

  // Component table with same columns as modal: Opening Name, Dimensions, Direction, Glass, Hardware
  const tableStartY = scheduleY + 5
  const colWidths = {
    openingName: 50,  // Product name
    dimensions: 30,   // Width x Height
    direction: 30,    // Direction
    glass: 35,        // Glass type
    hardware: 80      // Hardware (wide enough for multiple options)
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
    const truncatedHardware = hardwareText.length > 45 ? hardwareText.substring(0, 43) + '..' : hardwareText
    pdf.text(truncatedHardware, currentX + 3, currentY + 4)

    currentY += rowHeight
  })

  // Reset text color
  pdf.setTextColor(0, 0, 0)

  // Calculate layout: Elevation bottom left, Plan view top right
  const marginTop = 40
  const marginBottom = 25
  const marginSide = 13.33  // Reduced by 1/3 from 20mm
  const middleGap = 15   // Increased from 10 to 15
  const sectionPadding = 8  // Internal padding within each section

  const availableWidth = pageWidth - 2 * marginSide - middleGap
  const availableHeight = pageHeight - marginTop - marginBottom

  // Left section for elevation (60% of width, bottom section) - aligned with door schedule at x=15
  // Position closer to bottom with minimal spacing above footer
  const elevationWidth = availableWidth * 0.60 - 2 * sectionPadding
  const elevationX = scheduleX  // Align with door schedule left edge
  const elevationHeight = availableHeight * 0.65 - 2 * sectionPadding
  const footerLineY = pageHeight - 17 // Footer line position
  const elevationY = footerLineY - elevationHeight - 34 // Spacing for dimension lines + Elevation label + component text

  // Right section for plan view (40% of width, top section) - adjusted for larger elevation
  const planViewWidth = availableWidth * 0.40 - 2 * sectionPadding
  const planViewX = elevationX + elevationWidth + middleGap + sectionPadding
  // planViewY accounts for title (38mm) + wrapped labels (~15mm for 2-3 lines) + padding + 1 inch offset
  const planViewY = 83.4  // 58 + 25.4mm (1 inch)
  const planViewHeight = availableHeight * 0.55 - 2 * sectionPadding // Reduced to fit below labels

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

    // Use fixed pixels-per-inch scale (same as modal: 4 pixels per inch)
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // Render rows side by side instead of stacked - with uniform heights
    const rowSpacing = 10 // mm spacing between elevation groups
    const availableWidthPerRow = (elevationWidth - (elevationRows.length - 1) * rowSpacing) / elevationRows.length

    // First pass: Calculate the uniform scale factor for all rows (increased to 1.425 for 50% larger elevations)
    let globalScale = Infinity
    elevationRows.forEach((row) => {
      const visibleImages = row.filter(img => img.productType !== 'CORNER_90')
      if (visibleImages.length === 0) return

      const totalRowWidthMm = visibleImages.reduce((sum, img) => sum + (img.width * mmPerDisplayInch), 0)
      const maxRowHeightMm = Math.max(...visibleImages.map((img) => img.height * mmPerDisplayInch))

      const scaleByWidth = availableWidthPerRow / totalRowWidthMm
      const scaleByHeight = elevationHeight / maxRowHeightMm
      const rowScale = Math.min(scaleByWidth, scaleByHeight, 1.425)

      globalScale = Math.min(globalScale, rowScale)
    })

    let currentRowX = elevationX

    elevationRows.forEach((row, rowIndex) => {
      // Filter out corners (they don't render)
      const visibleImages = row.filter(img => img.productType !== 'CORNER_90')

      if (visibleImages.length === 0) return

      // Calculate total width using the global uniform scale
      const totalRowWidthMm = visibleImages.reduce((sum, img) => sum + (img.width * mmPerDisplayInch), 0)
      const scaledTotalWidth = totalRowWidthMm * globalScale

      // Calculate max height for dimension lines
      const maxRowHeightMm = Math.max(...visibleImages.map((img) => img.height * mmPerDisplayInch)) * globalScale

      // Calculate actual total width and height in inches (for dimension display)
      const totalWidthInches = visibleImages.reduce((sum, img) => sum + img.width, 0)
      const maxHeightInches = Math.max(...visibleImages.map((img) => img.height))

      // Left align within this row's space
      let currentX = currentRowX

      visibleImages.forEach((img) => {
        // Calculate size using uniform global scaling
        const imgWidthMm = img.width * mmPerDisplayInch * globalScale
        const imgHeightMm = img.height * mmPerDisplayInch * globalScale

        // Align to bottom edge
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

      // Calculate bounds for dimension lines
      const leftX = currentRowX
      const rightX = currentRowX + scaledTotalWidth
      const topY = elevationY + elevationHeight - maxRowHeightMm
      const bottomY = elevationY + elevationHeight

      // Draw total width dimension above the elevation
      const widthDimY = topY - 12 // Position above the elevation
      drawHorizontalDimension(
        pdf,
        leftX,
        rightX,
        widthDimY,
        formatDimensionInches(totalWidthInches),
        undefined,
        5
      )

      // Draw individual panel width dimensions at the bottom
      const bottomDimY = bottomY + 8 // Position below the elevation
      let panelX = leftX
      visibleImages.forEach((img) => {
        const imgWidthMm = img.width * mmPerDisplayInch * globalScale
        drawHorizontalDimension(
          pdf,
          panelX,
          panelX + imgWidthMm,
          bottomDimY,
          formatDimensionInches(img.width),
          undefined,
          5
        )
        panelX += imgWidthMm
      })

      // Draw height dimension to the right of the elevation
      const heightDimX = rightX + 12 // Position to the right of the elevation
      drawVerticalDimension(
        pdf,
        heightDimX,
        topY,
        bottomY,
        formatDimensionInches(maxHeightInches),
        5
      )

      // Row label (Elevation A, B, etc.) - positioned below bottom dimensions
      const rowLabel = String.fromCharCode(65 + rowIndex) // A, B, C, etc.
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Elevation ${rowLabel}`, currentRowX, bottomDimY + 14)

      // Component labels below elevation label - left aligned
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'italic')
      const rowLabelText = visibleImages
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

      pdf.text(rowLabelText, currentRowX, bottomDimY + 20, {
        maxWidth: availableWidthPerRow - 5
      })

      currentRowX += availableWidthPerRow + rowSpacing
    })
  }

  // Draw plan view at top right
  if (openingData.planViews && openingData.planViews.length > 0) {
    // Section label - moved down 1 inch from original position
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PLAN VIEW', planViewX + planViewWidth / 2, 63.4, { align: 'center' })  // 38 + 25.4mm

    // Component labels right below title
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    const labelText = openingData.planViews
      .filter(v => v.productType !== 'CORNER_90')
      .map((img) => `${img.productName} (${img.planViewName || 'Plan'})`)
      .join(' + ')
    pdf.text(labelText, planViewX + planViewWidth / 2, 69.4, {  // 44 + 25.4mm
      align: 'center',
      maxWidth: planViewWidth - 10
    })

    // Use fixed pixels-per-inch scale (same as modal: 4 pixels per inch)
    const mmPerDisplayInch = 25.4 / 4  // 6.35mm

    // Build segments to detect where corners are
    interface Segment {
      views: typeof openingData.planViews
      direction: 'horizontal' | 'vertical-up' | 'vertical-down'
    }

    const segments: Segment[] = []
    let currentSegment: typeof openingData.planViews = []
    let currentDirection: 'horizontal' | 'vertical-up' | 'vertical-down' = 'horizontal'
    const cornerPositions: Array<{ direction: string, afterPanelCount: number }> = []

    openingData.planViews.forEach((view) => {
      if (view.isCorner && view.productType === 'CORNER_90') {
        console.log(`PDF Plan: Corner detected, direction: ${view.cornerDirection}`)
        cornerPositions.push({
          direction: view.cornerDirection || 'Up',
          afterPanelCount: currentSegment.length
        })
        // Push current segment before corner
        if (currentSegment.length > 0) {
          segments.push({ views: currentSegment, direction: currentDirection })
          currentSegment = []
        }
        // Change direction based on corner
        currentDirection = view.cornerDirection === 'Down' ? 'vertical-down' : 'vertical-up'
      } else {
        currentSegment.push(view)
      }
    })

    // Push last segment
    if (currentSegment.length > 0) {
      segments.push({ views: currentSegment, direction: currentDirection })
    }

    console.log(`PDF Plan: ${segments.length} segments, ${cornerPositions.length} corners`)

    // Full rotation implementation - render all segments
    interface PanelPosition {
      view: typeof openingData.planViews[0]
      x: number
      y: number
      displayWidth: number
      displayHeight: number
      translateY: number
      rotation: number
      imgData: string
      sliderOffset: number // Offset for sliding doors to appear "open"
      segmentIndex: number // Track which segment this panel belongs to
    }

    const panelPositions: PanelPosition[] = []
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    let cumulativeX = 0
    let cumulativeY = 0

    // Track segment endpoints for wall placement
    interface SegmentEndpoint {
      x: number
      y: number
      direction: 'horizontal' | 'vertical-up' | 'vertical-down'
      isStart: boolean
      frameDepth: number // Height/depth of the frame at this point
    }
    const segmentEndpoints: SegmentEndpoint[] = []

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex]
      const isHorizontal = segment.direction === 'horizontal'
      const isVerticalDown = segment.direction === 'vertical-down'
      const isVerticalUp = segment.direction === 'vertical-up'

      // Track start of segment for wall placement
      const firstView = segment.views[0]
      if (firstView && segmentIndex === 0) {
        // First segment start - this is where we need a wall
        segmentEndpoints.push({
          x: cumulativeX,
          y: cumulativeY,
          direction: segment.direction,
          isStart: true,
          frameDepth: firstView.height * mmPerDisplayInch
        })
      }

      for (const view of segment.views) {
        const displayHeight = view.height * mmPerDisplayInch
        const displayWidth = view.width * mmPerDisplayInch

        let x = cumulativeX
        let y = cumulativeY
        let translateY = 0
        let rotation = 0

        // Calculate slider offset - sliding doors are offset to appear "open"
        // Offset perpendicular to the wall by the panel's depth (displayHeight)
        let sliderOffset = 0
        if (view.productType === 'SLIDING_DOOR') {
          sliderOffset = displayHeight  // Offset by depth to show "open" position
        }

        if (isHorizontal) {
          // Horizontal layout - no rotation
          translateY = view.orientation === 'bottom' ? -displayHeight : 0

          // Update bounding box - include slider offset in Y bounds
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x + displayWidth)
          const yWithTranslate = y + translateY
          minY = Math.min(minY, yWithTranslate)
          // For sliders, extend maxY to include the offset position
          maxY = Math.max(maxY, yWithTranslate + displayHeight + sliderOffset)

          cumulativeX += displayWidth
        } else if (isVerticalDown) {
          // Vertical down - rotate 90 degrees clockwise
          rotation = 90

          // After rotation: width becomes height, height becomes width
          // Position at current cumulative position
          // For sliders in vertical segments, offset extends in X direction
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x + displayHeight + sliderOffset)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y + displayWidth)

          cumulativeY += displayWidth
        } else if (isVerticalUp) {
          // Vertical up - rotate 90 degrees counter-clockwise
          rotation = -90
          // Need translateY to position rotated image to extend upward
          translateY = -displayWidth

          // After rotation: width becomes height, height becomes width
          // For vertical up, we need to offset to go upward
          // For sliders, offset extends in X direction
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x + displayHeight + sliderOffset)
          minY = Math.min(minY, y - displayWidth)
          maxY = Math.max(maxY, y)

          cumulativeY -= displayWidth
        }

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
          rotation,
          imgData,
          sliderOffset,
          segmentIndex
        })
      }

      // Track end of segment for wall placement
      const lastView = segment.views[segment.views.length - 1]
      if (lastView && segmentIndex === segments.length - 1) {
        // Last segment end - this is where we need a wall
        segmentEndpoints.push({
          x: cumulativeX,
          y: cumulativeY,
          direction: segment.direction,
          isStart: false,
          frameDepth: lastView.height * mmPerDisplayInch
        })
      }
    }

    console.log(`PDF Plan: Tracked ${segmentEndpoints.length} segment endpoints for walls`)

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
    // Rotate images if needed
    for (const panel of panelPositions) {
      let scaledWidth = panel.displayWidth * planScale
      let scaledHeight = panel.displayHeight * planScale

      // Calculate slider offset direction based on rotation
      // For horizontal segments: offset in Y direction (perpendicular to wall)
      // For vertical segments: offset in X direction (perpendicular to wall)
      let sliderOffsetX = 0
      let sliderOffsetY = 0
      if (panel.sliderOffset > 0) {
        if (panel.rotation === 0) {
          // Horizontal segment - offset downward (positive Y)
          sliderOffsetY = panel.sliderOffset * planScale
        } else {
          // Vertical segment - offset to the right (positive X)
          sliderOffsetX = panel.sliderOffset * planScale
        }
      }

      // Apply center offset, then scale, then translate to center of section
      // Add slider offset for sliding doors
      const finalX = centerX + (panel.x + centerOffsetX) * planScale + sliderOffsetX
      const finalY = centerY + (panel.y + centerOffsetY + panel.translateY) * planScale + sliderOffsetY

      try {
        let imageToRender = panel.imgData

        if (panel.rotation !== 0) {
          // Rotate the image
          console.log(`PDF Plan: Rotating image ${panel.rotation}° for ${panel.view.productName}`)
          imageToRender = await rotateImage(panel.imgData, panel.rotation)

          // After rotation, swap width and height for 90/-90 degree rotations
          if (panel.rotation === 90 || panel.rotation === -90) {
            const temp = scaledWidth
            scaledWidth = scaledHeight
            scaledHeight = temp
          }
        }

        pdf.addImage(imageToRender, 'PNG', finalX, finalY, scaledWidth, scaledHeight)
      } catch (error) {
        console.error('Error adding plan view image to PDF:', error)
        pdf.setDrawColor(200, 200, 200)
        pdf.rect(finalX, finalY, scaledWidth, scaledHeight)
      }
    }

    // === WALL SECTIONS ===
    // Draw hatched wall sections at the ends of the plan view (not in the middle for L-shapes)
    const mmPerDisplayInchForWalls = 25.4 / 4 // Same scale as plan view (6.35mm per inch)
    const wallLengthInches = 6 // 6 inch walls
    const wallLengthMm = wallLengthInches * mmPerDisplayInchForWalls * planScale

    // Draw walls at segment endpoints (start of first segment, end of last segment)
    for (const endpoint of segmentEndpoints) {
      const wallThicknessMm = endpoint.frameDepth * planScale

      // Calculate rendered position
      const renderedX = centerX + (endpoint.x + centerOffsetX) * planScale
      const renderedY = centerY + (endpoint.y + centerOffsetY) * planScale

      if (endpoint.direction === 'horizontal') {
        // Horizontal segment - walls extend horizontally
        if (endpoint.isStart) {
          // Start of horizontal segment - wall on left
          // Adjust Y position based on frame depth (wall spans the frame depth)
          const wallY = renderedY - wallThicknessMm
          drawHatchedWall(
            pdf,
            renderedX - wallLengthMm,
            wallY,
            wallLengthMm,
            wallThicknessMm,
            1.5
          )
          console.log(`PDF Plan: Drew left wall at (${(renderedX - wallLengthMm).toFixed(1)}, ${wallY.toFixed(1)})`)
        } else {
          // End of horizontal segment - wall on right
          const wallY = renderedY - wallThicknessMm
          drawHatchedWall(
            pdf,
            renderedX,
            wallY,
            wallLengthMm,
            wallThicknessMm,
            1.5
          )
          console.log(`PDF Plan: Drew right wall at (${renderedX.toFixed(1)}, ${wallY.toFixed(1)})`)
        }
      } else if (endpoint.direction === 'vertical-down') {
        // Vertical down segment - walls extend vertically
        if (endpoint.isStart) {
          // Start of vertical-down segment - wall at top
          drawHatchedWall(
            pdf,
            renderedX,
            renderedY - wallLengthMm,
            wallThicknessMm,
            wallLengthMm,
            1.5
          )
          console.log(`PDF Plan: Drew top wall (vertical-down start) at (${renderedX.toFixed(1)}, ${(renderedY - wallLengthMm).toFixed(1)})`)
        } else {
          // End of vertical-down segment - wall at bottom
          drawHatchedWall(
            pdf,
            renderedX,
            renderedY,
            wallThicknessMm,
            wallLengthMm,
            1.5
          )
          console.log(`PDF Plan: Drew bottom wall (vertical-down end) at (${renderedX.toFixed(1)}, ${renderedY.toFixed(1)})`)
        }
      } else if (endpoint.direction === 'vertical-up') {
        // Vertical up segment - walls extend vertically
        if (endpoint.isStart) {
          // Start of vertical-up segment - wall at bottom
          drawHatchedWall(
            pdf,
            renderedX,
            renderedY,
            wallThicknessMm,
            wallLengthMm,
            1.5
          )
          console.log(`PDF Plan: Drew bottom wall (vertical-up start) at (${renderedX.toFixed(1)}, ${renderedY.toFixed(1)})`)
        } else {
          // End of vertical-up segment - wall at top
          drawHatchedWall(
            pdf,
            renderedX,
            renderedY - wallLengthMm,
            wallThicknessMm,
            wallLengthMm,
            1.5
          )
          console.log(`PDF Plan: Drew top wall (vertical-up end) at (${renderedX.toFixed(1)}, ${(renderedY - wallLengthMm).toFixed(1)})`)
        }
      }
    }

    // === INSIDE/OUTSIDE LABELS ===
    // Add labels above and below the plan view assembly
    const scaledAssemblyHeight = assemblyHeight * planScale
    const assemblyTopY = centerY - scaledAssemblyHeight / 2
    const assemblyBottomY = centerY + scaledAssemblyHeight / 2

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(0, 0, 0)

    // "INSIDE" label above the assembly
    pdf.text('INSIDE', centerX, assemblyTopY - 8, { align: 'center' })

    // "OUTSIDE" label below the assembly
    pdf.text('OUTSIDE', centerX, assemblyBottomY + 18, { align: 'center' })
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
  addFooter(pdf, projectName, '')
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

  // Sort openings by name (natural alphanumeric sort) - same order as main content
  const sortedOpeningsForToc = [...projectData.openings].sort((a, b) => naturalSortCompare(a.openingName, b.openingName))

  sortedOpeningsForToc.forEach((opening) => {
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

  // Framed Opening Size (if applicable)
  let dimensionsY = 30
  if (openingData.isFinishedOpening && openingData.roughWidth && openingData.roughHeight) {
    const sizeLabel = openingData.openingType === 'THINWALL' ? 'Finished' : 'Rough'
    const framedSizeText = `Framed Opening Size: ${openingData.roughWidth}" W × ${openingData.roughHeight}" H (${sizeLabel})`
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text(framedSizeText, pageWidth / 2, 29, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    dimensionsY = 35
  }

  // Dimensions
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W × ${openingData.totalHeight}" H`,
    pageWidth / 2,
    dimensionsY,
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

  // Framed Opening Size (if applicable)
  let dimensionsY = 30
  if (openingData.isFinishedOpening && openingData.roughWidth && openingData.roughHeight) {
    const sizeLabel = openingData.openingType === 'THINWALL' ? 'Finished' : 'Rough'
    const framedSizeText = `Framed Opening Size: ${openingData.roughWidth}" W × ${openingData.roughHeight}" H (${sizeLabel})`
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text(framedSizeText, pageWidth / 2, 29, { align: 'center' })
    pdf.setTextColor(0, 0, 0)
    dimensionsY = 35
  }

  // Dimensions (plan view only shows width)
  pdf.setFontSize(10)
  pdf.text(
    `Overall: ${openingData.totalWidth}" W`,
    pageWidth / 2,
    dimensionsY,
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Function to evaluate simple formulas for cut lengths
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0

  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      // Case-insensitive variable replacement
      const regex = new RegExp(`\\b${key}\\b`, 'gi')
      expression = expression.replace(regex, value.toString())
    }

    if (!expression || expression.trim() === '') {
      return 0
    }

    const result = eval(expression)
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch (error) {
    console.error('Formula evaluation error for formula:', formula, 'error:', error)
    return 0
  }
}

// Helper function to get finish suffix for part numbers
function getFinishSuffix(finishColor: string): string {
  switch (finishColor) {
    case 'Black': return '-BL'
    case 'Clear': return '-C2'
    case 'Other': return '-AL'
    default: return ''
  }
}

// Helper function to apply finish code to part number
function applyFinishCode(partNumber: string, finishColor: string): string {
  if (!partNumber || !finishColor) return partNumber
  
  const finishSuffix = getFinishSuffix(finishColor)
  if (!finishSuffix) return partNumber
  
  if (partNumber.endsWith(finishSuffix)) {
    return partNumber
  }
  
  const finishCodes = ['-BL', '-C2', '-AL']
  for (const code of finishCodes) {
    if (partNumber.endsWith(code)) {
      return partNumber.slice(0, -code.length) + finishSuffix
    }
  }
  
  return partNumber + finishSuffix
}

// Helper function to find stock length for extrusions
async function findStockLength(partNumber: string, componentWidth: number, componentHeight: number): Promise<number | null> {
  try {
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber },
      include: {
        stockLengthRules: { where: { isActive: true } }
      }
    })

    if (masterPart && masterPart.stockLengthRules.length > 0) {
      const applicableRules = masterPart.stockLengthRules.filter(rule => {
        const matchesWidth = (rule.minWidth === null || componentWidth >= rule.minWidth) && 
                            (rule.maxWidth === null || componentWidth <= rule.maxWidth)
        const matchesHeight = (rule.minHeight === null || componentHeight >= rule.minHeight) && 
                             (rule.maxHeight === null || componentHeight <= rule.maxHeight)
        
        return rule.isActive && matchesWidth && matchesHeight
      })
      
      if (applicableRules.length > 0) {
        const bestRule = applicableRules.sort((a, b) => {
          const aSpecificity = (a.minWidth !== null ? 1 : 0) + (a.maxWidth !== null ? 1 : 0) +
                              (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
          const bSpecificity = (b.minWidth !== null ? 1 : 0) + (b.maxWidth !== null ? 1 : 0) +
                              (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
          return bSpecificity - aSpecificity
        })[0]
        
        return bestRule.stockLength || null
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error finding stock length for ${partNumber}:`, error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Get project with all related data for BOM generation
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const bomItems: any[] = []

    // Process each opening
    for (const opening of project.openings) {
      // Process each panel in the opening
      for (const panel of opening.panels) {
        if (!panel.componentInstance) continue

        const product = panel.componentInstance.product
        
        // Process each BOM item for this component
        for (const bom of product.productBOMs) {
          const variables = {
            width: panel.width || 0,
            height: panel.height || 0,
            quantity: bom.quantity || 1
          }

          // Calculate cut length if formula exists
          let cutLength: number | null = null
          if (bom.formula && bom.partType === 'Extrusion') {
            cutLength = evaluateFormula(bom.formula, variables)
          }

          // Generate part number with finish code for extrusions
          let fullPartNumber = bom.partNumber || ''
          if (bom.partType === 'Extrusion' && fullPartNumber && opening.finishColor) {
            fullPartNumber = applyFinishCode(fullPartNumber, opening.finishColor)
          }

          // Find stock length for extrusions
          let stockLength: number | null = null
          if (bom.partType === 'Extrusion' && bom.partNumber) {
            stockLength = await findStockLength(bom.partNumber, panel.width, panel.height)
          }

          // Calculate % of stock used
          let percentOfStock: string = ''
          if (bom.partType === 'Extrusion' && cutLength && stockLength && stockLength > 0) {
            const percentage = (cutLength / stockLength) * 100
            percentOfStock = percentage.toFixed(1) + '%'
          }

          // Add stock length to part number if available
          if (stockLength && fullPartNumber) {
            fullPartNumber = `${fullPartNumber}-${stockLength}`
          }

          // Apply finish code for Hardware parts with addFinishToPartNumber flag
          if (bom.partType === 'Hardware' && fullPartNumber && bom.addFinishToPartNumber && opening.finishColor) {
            fullPartNumber = applyFinishCode(fullPartNumber, opening.finishColor)
          }

          bomItems.push({
            openingName: opening.name,
            productName: product.name,
            panelWidth: panel.width,
            panelHeight: panel.height,
            partNumber: fullPartNumber,
            partName: bom.partName,
            partType: bom.partType,
            quantity: bom.quantity || 1,
            cutLength: cutLength ? cutLength.toFixed(2) : '',
            percentOfStock: percentOfStock,
            unit: bom.unit || '',
            description: bom.description || '',
            color: opening.finishColor || 'N/A'
          })
        }

        // Add glass as a separate row if panel has glass and it's not N/A
        if (panel.glassType && panel.glassType !== 'None' && panel.glassType !== 'N/A') {
          // Calculate glass dimensions using product formulas if available
          let glassWidth = panel.width
          let glassHeight = panel.height

          if (product.glassWidthFormula) {
            // If formula doesn't contain 'width' or 'height', assume it's a simple offset from width
            let formula = product.glassWidthFormula
            if (!formula.includes('width') && !formula.includes('height')) {
              formula = `width ${formula.startsWith('-') ? '' : '+'}${formula}`
            }
            glassWidth = evaluateFormula(formula, {
              width: panel.width,
              height: panel.height
            })
          }

          if (product.glassHeightFormula) {
            // If formula doesn't contain 'width' or 'height', assume it's a simple offset from height
            let formula = product.glassHeightFormula
            if (!formula.includes('width') && !formula.includes('height')) {
              formula = `height ${formula.startsWith('-') ? '' : '+'}${formula}`
            }
            glassHeight = evaluateFormula(formula, {
              width: panel.width,
              height: panel.height
            })
          }

          const glassArea = Math.round((glassWidth * glassHeight / 144) * 100) / 100

          bomItems.push({
            openingName: opening.name,
            productName: product.name,
            panelWidth: panel.width,
            panelHeight: panel.height,
            partNumber: `GLASS-${panel.glassType.toUpperCase()}`,
            partName: `${panel.glassType} Glass`,
            partType: 'Glass',
            quantity: 1,
            cutLength: `${glassWidth.toFixed(2)}" x ${glassHeight.toFixed(2)}" (${glassArea} SQ FT)`,
            percentOfStock: '',
            unit: 'SQ FT',
            description: panel.glassType,
            color: 'N/A'
          })
        }
      }
    }

    // Sort BOM items
    const sortedBomItems = bomItems.sort((a, b) => {
      if (a.openingName !== b.openingName) {
        return a.openingName.localeCompare(b.openingName)
      }
      
      const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3 }
      const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 4
      const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 4
      
      return aOrder - bOrder
    })

    // Generate CSV content with component grouping
    const headers = [
      'Opening',
      'Product Name',
      'Component Size',
      'Part Number',
      'Part Name',
      'Part Type',
      'Quantity',
      'Cut Length',
      '% of Stock',
      'Unit',
      'Color',
      'Description'
    ]

    const csvRows = [
      headers.join(','),
      ...sortedBomItems.map(item => [
        `"${item.openingName}"`,
        `"${item.productName}"`,
`"${item.panelWidth || 0}" × ${item.panelHeight || 0}""`,
        `"${item.partNumber}"`,
        `"${item.partName}"`,
        `"${item.partType}"`,
        item.quantity,
        `"${item.cutLength}"`,
        `"${item.percentOfStock}"`,
        `"${item.unit}"`,
        `"${item.color}"`,
        `"${item.description}"`
      ].join(','))
    ]

    const csvContent = csvRows.join('\n')

    // Return CSV response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${project.name}-BOM-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    })
  } catch (error) {
    console.error('Error generating project BOM CSV:', error)
    return NextResponse.json(
      { error: 'Failed to generate project BOM CSV' },
      { status: 500 }
    )
  }
}
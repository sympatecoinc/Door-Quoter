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
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    const panelId = parseInt(resolvedParams.panelId)
    
    if (isNaN(projectId) || isNaN(panelId)) {
      return NextResponse.json(
        { error: 'Invalid project ID or panel ID' },
        { status: 400 }
      )
    }

    // Get project and panel data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              where: { id: panelId },
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: true,
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: true
                              }
                            }
                          }
                        }
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

    // Find the specific panel
    const panel = project.openings.flatMap(o => o.panels).find(p => p.id === panelId)
    const opening = project.openings.find(o => o.panels.some(p => p.id === panelId))

    if (!panel || !opening || !panel.componentInstance) {
      return NextResponse.json(
        { error: 'Panel or component not found' },
        { status: 404 }
      )
    }

    const product = panel.componentInstance.product
    const bomItems: any[] = []

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
        cutLength: cutLength ? cutLength.toFixed(3) : '',
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
        cutLength: `${glassWidth.toFixed(3)}" x ${glassHeight.toFixed(3)}" (${glassArea} SQ FT)`,
        unit: 'SQ FT',
        description: panel.glassType,
        color: 'N/A'
      })
    }

    // Add product options (sub-options) to BOM
    if (panel.componentInstance.subOptionSelections) {
      try {
        const selections = JSON.parse(panel.componentInstance.subOptionSelections)
        const includedOptions = JSON.parse(panel.componentInstance.includedOptions || '[]')

        // Process each selected option
        for (const [categoryIdStr, optionId] of Object.entries(selections)) {
          if (optionId) {
            const categoryId = parseInt(categoryIdStr)

            // Find the product sub-option and individual option details
            const productSubOption = product.productSubOptions?.find(
              (pso: any) => pso.category.id === categoryId
            )

            if (productSubOption) {
              const individualOption = productSubOption.category.individualOptions?.find(
                (opt: any) => opt.id === Number(optionId)
              )

              if (individualOption) {
                const isIncluded = includedOptions.includes(Number(optionId))

                // Extract part number from description field (format: "PART-NUMBER - BASE-NAME")
                let partNumber = `OPTION-${individualOption.id}`
                if (individualOption.description) {
                  // Match everything before " - " (space-dash-space)
                  const match = individualOption.description.match(/^(.+?)\s+-\s+/)
                  if (match) {
                    partNumber = match[1]
                  }
                }

                bomItems.push({
                  openingName: opening.name,
                  productName: product.name,
                  panelWidth: panel.width,
                  panelHeight: panel.height,
                  partNumber: partNumber,
                  partName: individualOption.name,
                  partType: 'Option',
                  quantity: 1,
                  cutLength: isIncluded ? 'Included' : `$${((individualOption as any).price ?? 0).toFixed(2)}`,
                  unit: 'EA',
                  description: `${productSubOption.category.name}: ${individualOption.name}`,
                  color: 'N/A'
                })
              }
            }
          }
        }
      } catch (error) {
        console.error('Error parsing product options:', error)
      }
    }

    // Sort items by part type
    const sortedBomItems = bomItems.sort((a, b) => {
      const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
      const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 5
      const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 5

      return aOrder - bOrder
    })

    // Generate CSV content
    const headers = [
      'Opening',
      'Product Name',
      'Component Size',
      'Part Number',
      'Part Name', 
      'Part Type',
      'Quantity',
      'Cut Length',
      'Unit',
      'Color',
      'Description'
    ]

    const csvRows = [
      headers.join(','),
      ...sortedBomItems.map(item => [
        `"${item.openingName}"`,
        `"${item.productName}"`,
        `"${item.panelWidth}" × ${item.panelHeight}""`,
        `"${item.partNumber}"`,
        `"${item.partName}"`,
        `"${item.partType}"`,
        item.quantity,
        `"${item.cutLength}"`,
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
        'Content-Disposition': `attachment; filename="${project.name}-${opening.name}-${product.name}-BOM-${new Date().toISOString().slice(0, 10)}.csv"`
      }
    })
  } catch (error) {
    console.error('Error generating component BOM CSV:', error)
    return NextResponse.json(
      { error: 'Failed to generate component BOM CSV' },
      { status: 500 }
    )
  }
}
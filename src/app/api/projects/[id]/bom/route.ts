import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Function to evaluate simple formulas for cut lengths
function evaluateFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') return 0
  
  try {
    let expression = formula.trim()
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
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

          // Add stock length to part number if available
          if (stockLength && fullPartNumber) {
            fullPartNumber = `${fullPartNumber}-${stockLength}`
          }

          bomItems.push({
            openingName: opening.name,
            panelId: panel.id,
            productName: product.name,
            panelWidth: panel.width,
            panelHeight: panel.height,
            partNumber: fullPartNumber,
            partName: bom.partName,
            partType: bom.partType,
            quantity: bom.quantity || 1,
            cutLength: cutLength,
            stockLength: stockLength,
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

          bomItems.push({
            openingName: opening.name,
            panelId: panel.id,
            productName: product.name,
            panelWidth: panel.width,
            panelHeight: panel.height,
            partNumber: `GLASS-${panel.glassType.toUpperCase()}`,
            partName: `${panel.glassType} Glass`,
            partType: 'Glass',
            quantity: 1,
            cutLength: null,
            stockLength: null,
            unit: 'SQ FT',
            description: panel.glassType,
            glassWidth: glassWidth,
            glassHeight: glassHeight,
            glassArea: Math.round((glassWidth * glassHeight / 144) * 100) / 100, // Convert to sq ft
            color: 'N/A'
          })
        }
      }
    }

    // Group BOM items by opening and component
    const groupedBomItems: any = {}
    
    for (const item of bomItems) {
      const openingKey = item.openingName
      const componentKey = `${item.productName}_${item.panelId}`
      
      if (!groupedBomItems[openingKey]) {
        groupedBomItems[openingKey] = {}
      }
      
      if (!groupedBomItems[openingKey][componentKey]) {
        groupedBomItems[openingKey][componentKey] = {
          productName: item.productName,
          panelId: item.panelId,
          panelWidth: item.panelWidth,
          panelHeight: item.panelHeight,
          items: []
        }
      }
      
      groupedBomItems[openingKey][componentKey].items.push(item)
    }
    
    // Sort items within each component
    Object.values(groupedBomItems).forEach((opening: any) => {
      Object.values(opening).forEach((component: any) => {
        component.items.sort((a: any, b: any) => {
          const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3 }
          const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 4
          const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 4
          
          return aOrder - bOrder
        })
      })
    })

    return NextResponse.json({
      projectId,
      projectName: project.name,
      bomItems: bomItems.sort((a, b) => {
        // Sort by opening name, then by part type (Extrusion, Hardware, Glass)
        if (a.openingName !== b.openingName) {
          return a.openingName.localeCompare(b.openingName)
        }
        
        const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3 }
        const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 4
        const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 4
        
        return aOrder - bOrder
      }),
      groupedBomItems
    })
  } catch (error) {
    console.error('Error generating project BOM:', error)
    return NextResponse.json(
      { error: 'Failed to generate project BOM' },
      { status: 500 }
    )
  }
}
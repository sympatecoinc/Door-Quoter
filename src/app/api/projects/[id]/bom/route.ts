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

// Helper function to get finish code from database
async function getFinishCode(finishType: string): Promise<string> {
  try {
    const finish = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })
    return finish?.finishCode ? `-${finish.finishCode}` : ''
  } catch (error) {
    console.error('Error fetching finish code:', error)
    return ''
  }
}


// Helper function to calculate required part length from formula
function calculateRequiredPartLength(bom: any, variables: Record<string, number>): number {
  if (bom.formula) {
    try {
      return evaluateFormula(bom.formula, variables)
    } catch (error) {
      console.error('Error evaluating part length formula:', error)
      return 0
    }
  }
  
  // For extrusions without formulas, try to use a reasonable default based on component size
  // This handles cases where extrusions don't have specific formulas but still need stock lengths
  if (bom.partType === 'Extrusion') {
    // Use the larger of width or height as a reasonable default for part length
    return Math.max(variables.width || 0, variables.height || 0)
  }
  
  return bom.quantity || 0
}

// Helper function to find best stock length rule based on calculated part length
function findBestStockLengthRule(rules: any[], requiredLength: number): any | null {
  const applicableRules = rules.filter(rule => {
    // Check if rule applies to the required part length
    const matchesLength = (rule.minHeight === null || requiredLength >= rule.minHeight) && 
                         (rule.maxHeight === null || requiredLength <= rule.maxHeight)
    
    return rule.isActive && matchesLength
  })
  
  // Return the rule with the most restrictive constraints (most specific)
  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
}

// Helper function to find stock length for extrusions using the new formula-based approach
async function findStockLength(partNumber: string, bom: any, variables: Record<string, number>): Promise<{ stockLength: number | null, isMillFinish: boolean }> {
  try {
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber },
      include: {
        stockLengthRules: { where: { isActive: true } }
      }
    })

    if (masterPart && masterPart.partType === 'Extrusion' && masterPart.stockLengthRules.length > 0) {
      // Calculate the required part length from the ProductBOM formula
      const requiredLength = calculateRequiredPartLength(bom, variables)

      const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength)
      if (bestRule) {
        return {
          stockLength: bestRule.stockLength || null,
          isMillFinish: masterPart.isMillFinish || false
        }
      }
    }

    return { stockLength: null, isMillFinish: masterPart?.isMillFinish || false }
  } catch (error) {
    console.error(`Error finding stock length for ${partNumber}:`, error)
    return { stockLength: null, isMillFinish: false }
  }
}

// Helper function to aggregate BOM items for purchasing summary
function aggregateBomItems(bomItems: any[]): any[] {
  const aggregated: Record<string, any> = {}

  for (const item of bomItems) {
    const key = item.partNumber

    if (!aggregated[key]) {
      aggregated[key] = {
        partNumber: item.partNumber,
        partName: item.partName,
        partType: item.partType,
        totalQuantity: 0,
        unit: item.unit,
        stockLength: item.stockLength,
        cutLengths: [],
        totalCutLength: 0,
        glassDimensions: [],
        totalArea: 0
      }
    }

    aggregated[key].totalQuantity += item.quantity || 1

    // For extrusions, collect cut lengths
    if (item.partType === 'Extrusion' && item.cutLength) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        aggregated[key].cutLengths.push(item.cutLength)
      }
      aggregated[key].totalCutLength += (item.cutLength * (item.quantity || 1))
    }

    // For glass, collect dimensions and area
    if (item.partType === 'Glass') {
      aggregated[key].glassDimensions.push({
        width: item.glassWidth,
        height: item.glassHeight,
        area: item.glassArea
      })
      aggregated[key].totalArea += item.glassArea || 0
    }
  }

  // Sort by part type then part number
  const typeOrder: Record<string, number> = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
  return Object.values(aggregated).sort((a: any, b: any) => {
    const aOrder = typeOrder[a.partType] || 5
    const bOrder = typeOrder[b.partType] || 5
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.partNumber.localeCompare(b.partNumber)
  })
}

// Helper function to aggregate BOM items for cut list (extrusions only, grouped by product + size + cut length)
function aggregateCutListItems(bomItems: any[]): any[] {
  const aggregated: Record<string, any> = {}

  // Filter to extrusions only
  const extrusions = bomItems.filter(item => item.partType === 'Extrusion')

  // First, count unique panels per product+size combination
  const panelCounts: Record<string, Set<number>> = {}
  for (const item of extrusions) {
    const productSizeKey = `${item.productName}|${item.panelWidth}x${item.panelHeight}`
    if (!panelCounts[productSizeKey]) {
      panelCounts[productSizeKey] = new Set()
    }
    panelCounts[productSizeKey].add(item.panelId)
  }

  for (const item of extrusions) {
    // Group by product name + panel dimensions + part number + cut length
    // This ensures parts with same part number but different cut lengths (e.g., vertical vs horizontal glass stop) are shown separately
    const sizeKey = `${item.panelWidth}x${item.panelHeight}`
    const cutLengthKey = item.cutLength ? item.cutLength.toFixed(2) : 'none'
    const key = `${item.productName}|${sizeKey}|${item.partNumber}|${cutLengthKey}`
    const productSizeKey = `${item.productName}|${sizeKey}`

    if (!aggregated[key]) {
      // Get the actual count of unique panels for this product+size
      const unitCount = panelCounts[productSizeKey]?.size || 1

      aggregated[key] = {
        productName: item.productName,
        panelWidth: item.panelWidth,
        panelHeight: item.panelHeight,
        sizeKey: sizeKey,
        partNumber: item.partNumber,
        partName: item.partName,
        stockLength: item.stockLength,
        cutLength: item.cutLength,
        qtyPerUnit: item.quantity || 1,
        unitCount: unitCount,
        totalQty: (item.quantity || 1) * unitCount,
        color: item.color
      }
    }
  }

  // Sort by product name, then size, then part number, then cut length
  return Object.values(aggregated).sort((a: any, b: any) => {
    if (a.productName !== b.productName) return a.productName.localeCompare(b.productName)
    if (a.sizeKey !== b.sizeKey) return a.sizeKey.localeCompare(b.sizeKey)
    if (a.partNumber !== b.partNumber) return a.partNumber.localeCompare(b.partNumber)
    return (a.cutLength || 0) - (b.cutLength || 0)
  })
}

// Helper function to calculate stock optimization for cut list
function calculateStockOptimization(cutListItems: any[]): any[] {
  const optimizations: any[] = []

  // Group by part number and stock length
  const grouped: Record<string, any[]> = {}
  for (const item of cutListItems) {
    if (item.stockLength && item.cutLength) {
      const key = `${item.partNumber}|${item.stockLength}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    }
  }

  for (const [key, items] of Object.entries(grouped)) {
    const [partNumber, stockLengthStr] = key.split('|')
    const stockLength = parseFloat(stockLengthStr)

    // Calculate total cuts needed
    let totalCuts = 0
    const cutDetails: { cutLength: number; qty: number }[] = []

    for (const item of items) {
      totalCuts += item.totalQty
      cutDetails.push({
        cutLength: item.cutLength,
        qty: item.totalQty
      })
    }

    // Simple bin-packing: calculate minimum stock pieces needed
    // Sort cuts by length descending for first-fit decreasing
    const allCuts: number[] = []
    for (const detail of cutDetails) {
      for (let i = 0; i < detail.qty; i++) {
        allCuts.push(detail.cutLength)
      }
    }
    allCuts.sort((a, b) => b - a)

    // First-fit decreasing bin packing
    const bins: number[] = []
    for (const cut of allCuts) {
      let placed = false
      for (let i = 0; i < bins.length; i++) {
        if (bins[i] >= cut) {
          bins[i] -= cut
          placed = true
          break
        }
      }
      if (!placed) {
        bins.push(stockLength - cut)
      }
    }

    const stockPiecesNeeded = bins.length
    const totalStockLength = stockPiecesNeeded * stockLength
    const totalCutLength = allCuts.reduce((sum, cut) => sum + cut, 0)
    const wasteLength = totalStockLength - totalCutLength
    const wastePercent = totalStockLength > 0 ? (wasteLength / totalStockLength) * 100 : 0

    optimizations.push({
      partNumber,
      partName: items[0].partName,
      stockLength,
      totalCuts,
      stockPiecesNeeded,
      totalStockLength,
      totalCutLength,
      wasteLength,
      wastePercent
    })
  }

  return optimizations.sort((a, b) => a.partNumber.localeCompare(b.partNumber))
}

// Helper function to convert cut list to CSV
function cutlistToCSV(
  projectName: string,
  cutListItems: any[],
  batchInfo?: { totalUnits: number; batchSize: number; remainder: number; remainderItems?: any[] }
): string {
  const headers = ['Product', 'Size (WxH)', 'Part Number', 'Part Name', 'Stock Length', 'Cut Length', 'Qty Per Unit', 'Unit Count', 'Total Qty', 'Color']

  const rows = cutListItems.map(item => {
    return [
      item.productName,
      `${item.panelWidth}"x${item.panelHeight}"`,
      item.partNumber,
      item.partName,
      item.stockLength || '',
      item.cutLength ? item.cutLength.toFixed(2) : '',
      item.qtyPerUnit,
      item.unitCount,
      item.totalQty,
      item.color || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)
  })

  let csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')

  // Add batch information section at bottom
  if (batchInfo) {
    csv += '\n\n'
    csv += '"--- BATCH INFORMATION ---"\n'
    csv += `"Total Units:",${batchInfo.totalUnits}\n`
    csv += `"Batch Size:",${batchInfo.batchSize}\n`
    csv += `"Full Batches:",${Math.floor(batchInfo.totalUnits / batchInfo.batchSize)}\n`

    if (batchInfo.remainder > 0) {
      csv += `"Remainder Units:",${batchInfo.remainder}\n`
      csv += '\n"--- REMAINDER CUT LIST (Last Batch) ---"\n'
      csv += headers.join(',') + '\n'

      if (batchInfo.remainderItems) {
        for (const item of batchInfo.remainderItems) {
          const remainderRow = [
            item.productName,
            `${item.panelWidth}"x${item.panelHeight}"`,
            item.partNumber,
            item.partName,
            item.stockLength || '',
            item.cutLength ? item.cutLength.toFixed(2) : '',
            item.qtyPerUnit,
            item.unitCount,
            item.totalQty,
            item.color || ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`)
          csv += remainderRow.join(',') + '\n'
        }
      }
    } else {
      csv += '"Remainder Units:","None - batches divide evenly"\n'
    }
  }

  return csv
}

// Helper function to convert summary to CSV
function summaryToCSV(projectName: string, summaryItems: any[]): string {
  const headers = ['Part Number', 'Part Name', 'Type', 'Total Qty', 'Unit', 'Stock Length', 'Cut Lengths']

  const rows = summaryItems.map(item => {
    // Combine cut lengths and glass dimensions into a single column
    let cutLengthsStr = ''
    if (item.cutLengths.length > 0) {
      cutLengthsStr = item.cutLengths.map((l: number) => l.toFixed(2)).join('; ')
    } else if (item.glassDimensions.length > 0) {
      cutLengthsStr = item.glassDimensions.map((g: any) => `${g.width?.toFixed(2)}"x${g.height?.toFixed(2)}"`).join('; ')
    }

    return [
      item.partNumber,
      item.partName,
      item.partType,
      item.totalQuantity,
      item.unit,
      item.stockLength || '',
      cutLengthsStr
    ].map(field => `"${String(field).replace(/"/g, '""')}"`)
  })

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const summary = searchParams.get('summary') === 'true'
    const cutlist = searchParams.get('cutlist') === 'true'
    const format = searchParams.get('format')
    const productFilter = searchParams.get('product')
    const batchSize = parseInt(searchParams.get('batch') || '1') || 1

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
            Width: panel.width || 0,    // Support both uppercase and lowercase
            Height: panel.height || 0,  // Support both uppercase and lowercase
            quantity: bom.quantity || 1
          }

          // Calculate cut length if formula exists
          let cutLength: number | null = null
          if (bom.formula && bom.partType === 'Extrusion') {
            cutLength = evaluateFormula(bom.formula, variables)
          }

          // Generate part number with finish code and stock length for extrusions
          let fullPartNumber = bom.partNumber || ''
          let stockLength: number | null = null
          let isMillFinish = false

          if (bom.partType === 'Extrusion' && fullPartNumber) {
            // Find stock length and isMillFinish flag for extrusions from MasterPart
            if (bom.partNumber) {
              const stockInfo = await findStockLength(bom.partNumber, bom, variables)
              stockLength = stockInfo.stockLength
              isMillFinish = stockInfo.isMillFinish
            }

            // Only append finish color code if NOT mill finish (using masterPart.isMillFinish)
            if (opening.finishColor && !isMillFinish) {
              const finishCode = await getFinishCode(opening.finishColor)
              if (finishCode) {
                fullPartNumber = `${fullPartNumber}${finishCode}`
              }
            }

            // Always append stock length (regardless of mill finish status)
            if (stockLength) {
              fullPartNumber = `${fullPartNumber}-${stockLength}`
            }
          }

          // Apply finish code for Hardware parts with addFinishToPartNumber flag
          if (bom.partType === 'Hardware' && fullPartNumber && bom.addFinishToPartNumber && opening.finishColor) {
            const finishCode = await getFinishCode(opening.finishColor)
            if (finishCode) {
              fullPartNumber = `${fullPartNumber}${finishCode}`
            }
          }

          // Calculate % of stock used
          let percentOfStock: number | null = null
          if (bom.partType === 'Extrusion' && cutLength && stockLength && stockLength > 0) {
            percentOfStock = (cutLength / stockLength) * 100
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
            percentOfStock: null,
            unit: 'SQ FT',
            description: panel.glassType,
            glassWidth: glassWidth,
            glassHeight: glassHeight,
            glassArea: Math.round((glassWidth * glassHeight / 144) * 100) / 100, // Convert to sq ft
            color: 'N/A'
          })
        }

        // Add product options (sub-options) to BOM with standard hardware logic
        const processedBomCategories = new Set<string>()

        if (panel.componentInstance.subOptionSelections) {
          try {
            const selections = JSON.parse(panel.componentInstance.subOptionSelections)
            const includedOptions = JSON.parse(panel.componentInstance.includedOptions || '[]')

            // Process each selected option
            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              processedBomCategories.add(categoryIdStr)
              const categoryId = parseInt(categoryIdStr)

              // Find the product sub-option and individual option details
              const productSubOption = product.productSubOptions?.find(
                (pso: any) => pso.category.id === categoryId
              )

              if (!productSubOption) continue

              const standardOptionId = productSubOption.standardOptionId
              const standardOption = standardOptionId
                ? productSubOption.category.individualOptions?.find((opt: any) => opt.id === standardOptionId)
                : null

              if (!optionId) {
                // No option selected - add standard if available
                if (standardOption) {
                  let partNumber = standardOption.partNumber || `OPTION-${standardOption.id}`
                  if (!standardOption.partNumber && standardOption.description) {
                    const match = standardOption.description.match(/^(.+?)\s+-\s+/)
                    if (match) {
                      partNumber = match[1]
                    }
                  }

                  // Apply finish code if addFinishToPartNumber is set
                  if (standardOption.addFinishToPartNumber && opening.finishColor && standardOption.partNumber) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      partNumber = `${partNumber}${finishCode}`
                    }
                  }

                  bomItems.push({
                    openingName: opening.name,
                    panelId: panel.id,
                    productName: product.name,
                    panelWidth: panel.width,
                    panelHeight: panel.height,
                    partNumber: partNumber,
                    partName: standardOption.name,
                    partType: 'Option',
                    quantity: 1,
                    cutLength: null,
                    stockLength: null,
                    percentOfStock: null,
                    unit: 'EA',
                    description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                    color: opening.finishColor || 'N/A',
                    isIncluded: false,
                    isStandard: true,
                    optionPrice: standardOption.price
                  })
                }
                continue
              }

              const individualOption = productSubOption.category.individualOptions?.find(
                (opt: any) => opt.id === Number(optionId)
              )

              if (individualOption) {
                const isIncluded = includedOptions.includes(Number(optionId))
                const isStandardOption = standardOptionId === individualOption.id

                // Use partNumber field if available, otherwise fall back to parsing description or OPTION-{id}
                let partNumber = individualOption.partNumber || `OPTION-${individualOption.id}`
                if (!individualOption.partNumber && individualOption.description) {
                  // Legacy fallback: Match everything before " - " (space-dash-space)
                  const match = individualOption.description.match(/^(.+?)\s+-\s+/)
                  if (match) {
                    partNumber = match[1]
                  }
                }

                // Apply finish code if addFinishToPartNumber is set
                if (individualOption.addFinishToPartNumber && opening.finishColor && individualOption.partNumber) {
                  const finishCode = await getFinishCode(opening.finishColor)
                  if (finishCode) {
                    partNumber = `${partNumber}${finishCode}`
                  }
                }

                let description = `${productSubOption.category.name}: ${individualOption.name}`
                if (isStandardOption) {
                  description += ' (Standard - Included)'
                } else if (isIncluded) {
                  description += ' (Included)'
                }

                bomItems.push({
                  openingName: opening.name,
                  panelId: panel.id,
                  productName: product.name,
                  panelWidth: panel.width,
                  panelHeight: panel.height,
                  partNumber: partNumber,
                  partName: individualOption.name,
                  partType: 'Option',
                  quantity: 1,
                  cutLength: null,
                  stockLength: null,
                  percentOfStock: null,
                  unit: 'EA',
                  description: description,
                  color: opening.finishColor || 'N/A',
                  isIncluded: isIncluded,
                  isStandard: isStandardOption,
                  optionPrice: individualOption.price
                })
              }
            }
          } catch (error) {
            console.error('Error parsing product options:', error)
          }
        }

        // Add standard options for categories not in selections
        for (const productSubOption of product.productSubOptions || []) {
          const categoryId = productSubOption.category.id.toString()
          if (!processedBomCategories.has(categoryId) && productSubOption.standardOptionId) {
            const standardOption = productSubOption.category.individualOptions?.find(
              (opt: any) => opt.id === productSubOption.standardOptionId
            )
            if (standardOption) {
              let partNumber = standardOption.partNumber || `OPTION-${standardOption.id}`
              if (!standardOption.partNumber && standardOption.description) {
                const match = standardOption.description.match(/^(.+?)\s+-\s+/)
                if (match) {
                  partNumber = match[1]
                }
              }

              // Apply finish code if addFinishToPartNumber is set
              if (standardOption.addFinishToPartNumber && opening.finishColor && standardOption.partNumber) {
                const finishCode = await getFinishCode(opening.finishColor)
                if (finishCode) {
                  partNumber = `${partNumber}${finishCode}`
                }
              }

              bomItems.push({
                openingName: opening.name,
                panelId: panel.id,
                productName: product.name,
                panelWidth: panel.width,
                panelHeight: panel.height,
                partNumber: partNumber,
                partName: standardOption.name,
                partType: 'Option',
                quantity: 1,
                cutLength: null,
                stockLength: null,
                percentOfStock: null,
                unit: 'EA',
                description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                color: opening.finishColor || 'N/A',
                isIncluded: false,
                isStandard: true,
                optionPrice: standardOption.price
              })
            }
          }
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
          const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
          const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 5
          const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 5

          return aOrder - bOrder
        })
      })
    })

    // If summary mode is requested, return aggregated data
    if (summary) {
      const summaryItems = aggregateBomItems(bomItems)

      // Calculate totals by type
      const totals = {
        totalParts: summaryItems.reduce((sum, item) => sum + item.totalQuantity, 0),
        totalExtrusions: summaryItems.filter(item => item.partType === 'Extrusion').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalHardware: summaryItems.filter(item => item.partType === 'Hardware').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalGlass: summaryItems.filter(item => item.partType === 'Glass').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalOptions: summaryItems.filter(item => item.partType === 'Option').reduce((sum, item) => sum + item.totalQuantity, 0)
      }

      // If CSV format requested, return as file download
      if (format === 'csv') {
        const csvContent = summaryToCSV(project.name, summaryItems)
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-purchasing-summary.csv`

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      }

      return NextResponse.json({
        projectId,
        projectName: project.name,
        summaryItems,
        ...totals
      })
    }

    // If cutlist mode is requested, return cut list data (extrusions only, grouped by product + size)
    if (cutlist) {
      let cutListItems = aggregateCutListItems(bomItems)

      // Filter by product if specified
      if (productFilter) {
        cutListItems = cutListItems.filter(item => item.productName === productFilter)
      }

      // Get original unit count before applying batch size
      const originalUnitCount = cutListItems[0]?.unitCount || 1

      // Apply batch size - this sets quantities to match the specified number of units per batch
      // e.g., if batch=5 and original has 20 units, we show quantities for 5 units at a time
      let batchedCutListItems = cutListItems
      let remainderItems: any[] = []
      let remainder = 0

      if (batchSize >= 1 && productFilter) {
        remainder = originalUnitCount % batchSize

        // Create the batched cut list
        batchedCutListItems = cutListItems.map(item => ({
          ...item,
          unitCount: batchSize,
          totalQty: item.qtyPerUnit * batchSize
        }))

        // Create remainder cut list if needed
        if (remainder > 0) {
          remainderItems = cutListItems.map(item => ({
            ...item,
            unitCount: remainder,
            totalQty: item.qtyPerUnit * remainder
          }))
        }
      }

      const stockOptimization = calculateStockOptimization(batchedCutListItems)

      // Calculate totals
      const totalParts = batchedCutListItems.reduce((sum, item) => sum + item.totalQty, 0)
      const totalUniqueProducts = new Set(batchedCutListItems.map(item => `${item.productName}|${item.sizeKey}`)).size

      // If CSV format requested, return as file download
      if (format === 'csv') {
        const batchInfo = productFilter ? {
          totalUnits: originalUnitCount,
          batchSize: batchSize,
          remainder: remainder,
          remainderItems: remainder > 0 ? remainderItems : undefined
        } : undefined

        const csvContent = cutlistToCSV(project.name, batchedCutListItems, batchInfo)
        const productSuffix = productFilter ? `-${productFilter.replace(/\s+/g, '-')}` : ''
        const batchSuffix = productFilter ? `-${batchSize}units` : ''
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}${productSuffix}${batchSuffix}-cutlist.csv`

        return new NextResponse(csvContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      }

      return NextResponse.json({
        projectId,
        projectName: project.name,
        cutListItems: batchedCutListItems,
        stockOptimization,
        totalParts,
        totalUniqueProducts
      })
    }

    return NextResponse.json({
      projectId,
      projectName: project.name,
      bomItems: bomItems.sort((a, b) => {
        // Sort by opening name, then by part type (Extrusion, Hardware, Glass, Option)
        if (a.openingName !== b.openingName) {
          return a.openingName.localeCompare(b.openingName)
        }

        const typeOrder = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
        const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 5
        const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 5

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
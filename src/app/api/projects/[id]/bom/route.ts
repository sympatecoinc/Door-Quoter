import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  calculateOptimizedStockPieces,
  evaluateFormula,
  aggregateBomItems,
  aggregateCutListItems,
  calculateStockOptimization,
  cutlistToCSV,
  summaryToCSV,
  getFrameDimensions,
  calculateRequiredPartLength,
  findBestStockLengthRule
} from '@/lib/bom-utils'
import { aggregateFromProjectData, createAssemblyListPDF } from '@/lib/assembly-list-pdf-generator'

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
    const assembly = searchParams.get('assembly') === 'true'
    const picklist = searchParams.get('picklist') === 'true'
    const format = searchParams.get('format')
    const productFilter = searchParams.get('product')
    const sizeFilter = searchParams.get('size')  // e.g., "42x108"
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
        customer: {
          select: {
            companyName: true
          }
        },
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: {
                          include: {
                            option: true
                          }
                        },
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

        // For FRAME products, calculate dimensions dynamically from sibling panels
        const isFrameProduct = product.productType === 'FRAME'
        let effectiveWidth = panel.width || 0
        let effectiveHeight = panel.height || 0

        if (isFrameProduct) {
          const frameDimensions = getFrameDimensions(opening.panels, panel.id)
          effectiveWidth = frameDimensions.width
          effectiveHeight = frameDimensions.height
        }

        // Process each BOM item for this component
        for (const bom of product.productBOMs) {
          // Skip option-linked BOMs - these are handled in the options section below
          if (bom.optionId) continue

          const variables = {
            width: effectiveWidth,
            height: effectiveHeight,
            Width: effectiveWidth,    // Support both uppercase and lowercase
            Height: effectiveHeight,  // Support both uppercase and lowercase
            quantity: bom.quantity || 1
          }

          // Calculate cut length if formula exists
          let cutLength: number | null = null
          if (bom.formula && bom.partType === 'Extrusion') {
            cutLength = evaluateFormula(bom.formula, variables)
          }

          // Calculate length for Hardware/Fastener parts with LF or IN units
          // Also populate cutLength so it shows in the Cut Length column
          // Formulas are expected to produce inches - automatically convert to feet for LF units
          let calculatedLength: number | null = null
          if (bom.formula && (bom.partType === 'Hardware' || bom.partType === 'Fastener') && (bom.unit === 'LF' || bom.unit === 'IN')) {
            calculatedLength = evaluateFormula(bom.formula, variables)
            // Convert inches to feet if unit is LF
            if (bom.unit === 'LF' && calculatedLength !== null) {
              calculatedLength = calculatedLength / 12
            }
            cutLength = calculatedLength  // Show in Cut Length column
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

          // Lookup MasterPart for Hardware to get pick list flags
          let includeOnPickList = false
          let includeInJambKit = false
          if (bom.partType === 'Hardware' && bom.partNumber) {
            const masterPart = await prisma.masterPart.findUnique({
              where: { partNumber: bom.partNumber },
              select: { includeOnPickList: true, includeInJambKit: true }
            })
            if (masterPart) {
              includeOnPickList = masterPart.includeOnPickList
              includeInJambKit = masterPart.includeInJambKit
            }
          }

          bomItems.push({
            openingName: opening.name,
            panelId: panel.id,
            productName: product.name,
            panelWidth: effectiveWidth,
            panelHeight: effectiveHeight,
            partNumber: fullPartNumber,
            partName: bom.partName,
            partType: bom.partType,
            quantity: bom.quantity || 1,
            cutLength: cutLength,
            calculatedLength: calculatedLength,
            stockLength: stockLength,
            percentOfStock: percentOfStock,
            unit: bom.unit || '',
            description: bom.description || '',
            color: opening.finishColor || 'N/A',
            includeOnPickList: includeOnPickList,
            includeInJambKit: includeInJambKit
          })
        }

        // Add glass as a separate row if panel has glass and it's not N/A
        if (panel.glassType && panel.glassType !== 'None' && panel.glassType !== 'N/A') {
          // Calculate glass dimensions using product formulas if available
          let glassWidth = effectiveWidth
          let glassHeight = effectiveHeight

          if (product.glassWidthFormula) {
            // If formula doesn't contain 'width' or 'height', assume it's a simple offset from width
            let formula = product.glassWidthFormula
            if (!formula.includes('width') && !formula.includes('height')) {
              formula = `width ${formula.startsWith('-') ? '' : '+'}${formula}`
            }
            glassWidth = evaluateFormula(formula, {
              width: effectiveWidth,
              height: effectiveHeight
            })
          }

          if (product.glassHeightFormula) {
            // If formula doesn't contain 'width' or 'height', assume it's a simple offset from height
            let formula = product.glassHeightFormula
            if (!formula.includes('width') && !formula.includes('height')) {
              formula = `height ${formula.startsWith('-') ? '' : '+'}${formula}`
            }
            glassHeight = evaluateFormula(formula, {
              width: effectiveWidth,
              height: effectiveHeight
            })
          }

          bomItems.push({
            openingName: opening.name,
            panelId: panel.id,
            productName: product.name,
            panelWidth: effectiveWidth,
            panelHeight: effectiveHeight,
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

          // Add glass type parts to BOM (e.g., vinyl frosting by linear feet)
          const dbGlassType = await prisma.glassType.findUnique({
            where: { name: panel.glassType },
            include: {
              parts: {
                include: { masterPart: true }
              }
            }
          })

          if (dbGlassType?.parts && dbGlassType.parts.length > 0) {
            for (const gtp of dbGlassType.parts) {
              const partVariables = {
                width: effectiveWidth,
                height: effectiveHeight,
                glassWidth: glassWidth,
                glassHeight: glassHeight
              }

              // Calculate quantity from formula or use fixed quantity
              let partQuantity = gtp.quantity || 1
              if (gtp.formula) {
                partQuantity = evaluateFormula(gtp.formula, partVariables)
              }

              // Build part number with finish code if applicable (using master part settings)
              let fullPartNumber = gtp.masterPart.partNumber
              if (gtp.masterPart.addFinishToPartNumber && opening.finishColor) {
                const finishCode = await getFinishCode(opening.finishColor)
                if (finishCode) {
                  fullPartNumber = `${fullPartNumber}${finishCode}`
                }
              }

              bomItems.push({
                openingName: opening.name,
                panelId: panel.id,
                productName: product.name,
                panelWidth: effectiveWidth,
                panelHeight: effectiveHeight,
                partNumber: fullPartNumber,
                partName: gtp.masterPart.baseName,
                partType: gtp.masterPart.partType || 'Hardware',
                quantity: Math.round(partQuantity * 100) / 100,
                cutLength: null,
                stockLength: null,
                percentOfStock: null,
                unit: gtp.masterPart.unit || 'EA',
                description: `Glass Type Part: ${panel.glassType}`,
                color: gtp.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A',
                addToPackingList: gtp.masterPart.addToPackingList
              })
            }
          }
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

                  // Check if this option has a ProductBOM entry (for cut list items)
                  const optionBom = standardOption.isCutListItem
                    ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                    : null

                  let cutLength: number | null = null
                  let stockLength: number | null = null
                  let isMillFinish = false
                  let percentOfStock: number | null = null

                  if (optionBom && optionBom.formula) {
                    // Calculate cut length using the formula from ProductBOM
                    cutLength = evaluateFormula(optionBom.formula, {
                      width: effectiveWidth,
                      height: effectiveHeight,
                      Width: effectiveWidth,
                      Height: effectiveHeight
                    })

                    // Look up stock length from MasterPart if partNumber exists
                    if (standardOption.partNumber) {
                      const stockInfo = await findStockLength(
                        standardOption.partNumber,
                        { formula: optionBom.formula, partType: 'Extrusion' },
                        { width: effectiveWidth, height: effectiveHeight }
                      )
                      stockLength = stockInfo.stockLength
                      isMillFinish = stockInfo.isMillFinish

                      // Build full part number with finish code and stock length
                      // For extrusions (cut list items), apply finish code based on isMillFinish only
                      if (opening.finishColor && !isMillFinish) {
                        const finishCode = await getFinishCode(opening.finishColor)
                        if (finishCode) {
                          partNumber = `${partNumber}${finishCode}`
                        }
                      }
                      if (stockLength) {
                        partNumber = `${partNumber}-${stockLength}`
                      }

                      // Calculate percent of stock
                      if (cutLength && stockLength && stockLength > 0) {
                        percentOfStock = (cutLength / stockLength) * 100
                      }
                    }
                  } else {
                    // Apply finish code if addFinishToPartNumber is set (non-cut-list options)
                    if (standardOption.addFinishToPartNumber && opening.finishColor && standardOption.partNumber) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        partNumber = `${partNumber}${finishCode}`
                      }
                    }
                  }

                  // Determine quantity for standard option
                  // For RANGE mode use defaultQuantity, for FIXED use quantity
                  let optionQuantity = 1
                  if (optionBom?.quantityMode === 'RANGE') {
                    optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
                  } else {
                    optionQuantity = optionBom?.quantity || 1
                  }

                  bomItems.push({
                    openingName: opening.name,
                    panelId: panel.id,
                    productName: product.name,
                    panelWidth: effectiveWidth,
                    panelHeight: effectiveHeight,
                    partNumber: partNumber,
                    partName: standardOption.name,
                    partType: optionBom ? 'Extrusion' : 'Option',
                    quantity: optionQuantity,
                    cutLength: cutLength,
                    stockLength: stockLength,
                    percentOfStock: percentOfStock,
                    unit: optionBom ? 'IN' : 'EA',
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

                // Check if this option has a ProductBOM entry (for cut list items)
                const optionBom = individualOption.isCutListItem
                  ? product.productBOMs?.find((bom: any) => bom.optionId === individualOption.id)
                  : null

                let cutLength: number | null = null
                let stockLength: number | null = null
                let isMillFinish = false
                let percentOfStock: number | null = null

                if (optionBom && optionBom.formula) {
                  // Calculate cut length using the formula from ProductBOM
                  cutLength = evaluateFormula(optionBom.formula, {
                    width: effectiveWidth,
                    height: effectiveHeight,
                    Width: effectiveWidth,
                    Height: effectiveHeight
                  })

                  // Look up stock length from MasterPart if partNumber exists
                  if (individualOption.partNumber) {
                    const stockInfo = await findStockLength(
                      individualOption.partNumber,
                      { formula: optionBom.formula, partType: 'Extrusion' },
                      { width: effectiveWidth, height: effectiveHeight }
                    )
                    stockLength = stockInfo.stockLength
                    isMillFinish = stockInfo.isMillFinish

                    // Build full part number with finish code and stock length
                    // For extrusions (cut list items), apply finish code based on isMillFinish only
                    if (opening.finishColor && !isMillFinish) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        partNumber = `${partNumber}${finishCode}`
                      }
                    }
                    if (stockLength) {
                      partNumber = `${partNumber}-${stockLength}`
                    }

                    // Calculate percent of stock
                    if (cutLength && stockLength && stockLength > 0) {
                      percentOfStock = (cutLength / stockLength) * 100
                    }
                  }
                } else {
                  // Apply finish code if addFinishToPartNumber is set (non-cut-list options)
                  if (individualOption.addFinishToPartNumber && opening.finishColor && individualOption.partNumber) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      partNumber = `${partNumber}${finishCode}`
                    }
                  }
                }

                let description = `${productSubOption.category.name}: ${individualOption.name}`
                if (isStandardOption) {
                  description += ' (Standard - Included)'
                } else if (isIncluded) {
                  description += ' (Included)'
                }

                // Determine quantity: check for user selection first (RANGE mode), then BOM quantity
                const quantityKey = `${categoryId}_qty`
                let optionQuantity = 1
                if (selections[quantityKey] !== undefined) {
                  // User-selected quantity (RANGE mode)
                  optionQuantity = Number(selections[quantityKey])
                } else if (optionBom?.quantityMode === 'RANGE') {
                  // RANGE mode but no selection - use default
                  optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
                } else {
                  // FIXED mode - use BOM quantity
                  optionQuantity = optionBom?.quantity || 1
                }

                // Skip if quantity is 0 (user explicitly chose to exclude)
                if (optionQuantity === 0) continue

                bomItems.push({
                  openingName: opening.name,
                  panelId: panel.id,
                  productName: product.name,
                  panelWidth: effectiveWidth,
                  panelHeight: effectiveHeight,
                  partNumber: partNumber,
                  partName: individualOption.name,
                  partType: optionBom ? 'Extrusion' : 'Option',
                  quantity: optionQuantity,
                  cutLength: cutLength,
                  stockLength: stockLength,
                  percentOfStock: percentOfStock,
                  unit: optionBom ? 'IN' : 'EA',
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

              // Check if this option has a ProductBOM entry (for cut list items)
              const optionBom = standardOption.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                : null

              let cutLength: number | null = null
              let stockLength: number | null = null
              let isMillFinish = false
              let percentOfStock: number | null = null

              if (optionBom && optionBom.formula) {
                // Calculate cut length using the formula from ProductBOM
                cutLength = evaluateFormula(optionBom.formula, {
                  width: effectiveWidth,
                  height: effectiveHeight,
                  Width: effectiveWidth,
                  Height: effectiveHeight
                })

                // Look up stock length from MasterPart if partNumber exists
                if (standardOption.partNumber) {
                  const stockInfo = await findStockLength(
                    standardOption.partNumber,
                    { formula: optionBom.formula, partType: 'Extrusion' },
                    { width: effectiveWidth, height: effectiveHeight }
                  )
                  stockLength = stockInfo.stockLength
                  isMillFinish = stockInfo.isMillFinish

                  // Build full part number with finish code and stock length
                  // For extrusions (cut list items), apply finish code based on isMillFinish only
                  if (opening.finishColor && !isMillFinish) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      partNumber = `${partNumber}${finishCode}`
                    }
                  }
                  if (stockLength) {
                    partNumber = `${partNumber}-${stockLength}`
                  }

                  // Calculate percent of stock
                  if (cutLength && stockLength && stockLength > 0) {
                    percentOfStock = (cutLength / stockLength) * 100
                  }
                }
              } else {
                // Apply finish code if addFinishToPartNumber is set (non-cut-list options)
                if (standardOption.addFinishToPartNumber && opening.finishColor && standardOption.partNumber) {
                  const finishCode = await getFinishCode(opening.finishColor)
                  if (finishCode) {
                    partNumber = `${partNumber}${finishCode}`
                  }
                }
              }

              // Determine quantity for standard option not in selections
              // For RANGE mode use defaultQuantity, for FIXED use quantity
              let optionQuantity = 1
              if (optionBom?.quantityMode === 'RANGE') {
                optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
              } else {
                optionQuantity = optionBom?.quantity || 1
              }

              bomItems.push({
                openingName: opening.name,
                panelId: panel.id,
                productName: product.name,
                panelWidth: effectiveWidth,
                panelHeight: effectiveHeight,
                partNumber: partNumber,
                partName: standardOption.name,
                partType: optionBom ? 'Extrusion' : 'Option',
                quantity: optionQuantity,
                cutLength: cutLength,
                stockLength: stockLength,
                percentOfStock: percentOfStock,
                unit: optionBom ? 'IN' : 'EA',
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

      // Note: Starter channels are now handled via category options with RANGE mode
      // The old hardcoded includeStarterChannels logic has been removed
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
        totalOptions: summaryItems.filter(item => item.partType === 'Option').reduce((sum, item) => sum + item.totalQuantity, 0),
        // Total optimized stock pieces to order for all extrusions
        totalStockPiecesToOrder: summaryItems
          .filter(item => item.partType === 'Extrusion' && item.stockPiecesNeeded !== null)
          .reduce((sum, item) => sum + item.stockPiecesNeeded, 0)
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
      // Separate miscellaneous items from regular BOM items
      const regularBomItems = bomItems.filter(item => !item.isMiscellaneous)
      const miscBomItems = bomItems.filter(item => item.isMiscellaneous)

      let cutListItems = aggregateCutListItems(regularBomItems)

      // Create miscellaneous cut list (aggregated by part number and cut length)
      const miscCutListMap: Record<string, any> = {}
      for (const item of miscBomItems) {
        if (item.partType !== 'Extrusion') continue
        const cutLengthKey = item.cutLength ? item.cutLength.toFixed(2) : 'none'
        const key = `${item.partNumber}|${cutLengthKey}`

        if (!miscCutListMap[key]) {
          miscCutListMap[key] = {
            partNumber: item.partNumber,
            partName: item.partName,
            stockLength: item.stockLength,
            cutLength: item.cutLength,
            totalQty: 0,
            color: item.color,
            openings: [] as string[]
          }
        }
        miscCutListMap[key].totalQty += (item.quantity || 1)
        if (!miscCutListMap[key].openings.includes(item.openingName)) {
          miscCutListMap[key].openings.push(item.openingName)
        }
      }
      const miscellaneousCutList = Object.values(miscCutListMap)

      // Filter by product if specified
      if (productFilter) {
        cutListItems = cutListItems.filter(item => item.productName === productFilter)
      }

      // Filter by size if specified (e.g., "42x108")
      if (sizeFilter) {
        cutListItems = cutListItems.filter(item => item.sizeKey === sizeFilter)
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
        const sizeSuffix = sizeFilter ? `-${sizeFilter}` : ''
        const batchSuffix = (productFilter || sizeFilter) ? `-${batchSize}units` : ''
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}${productSuffix}${sizeSuffix}${batchSuffix}-cutlist.csv`

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
        miscellaneousCutList,
        stockOptimization,
        totalParts,
        totalUniqueProducts
      })
    }

    // If assembly mode is requested, return assembly list (PDF only for now)
    if (assembly) {
      // Aggregate from project openings for accurate panel counts
      const assemblyItems = aggregateFromProjectData(project.openings)

      if (format === 'pdf') {
        const pdfData = {
          projectName: project.name,
          items: assemblyItems,
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }

        const pdfBuffer = await createAssemblyListPDF(pdfData)
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-assembly-list.pdf`

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      }

      // Return JSON for non-PDF requests
      return NextResponse.json({
        projectId,
        projectName: project.name,
        assemblyItems,
        totalItems: assemblyItems.reduce((sum, item) => sum + item.quantity, 0)
      })
    }

    // If picklist mode is requested, return pick list data (hardware items with includeOnPickList=true)
    if (picklist) {
      // Filter to only hardware items with includeOnPickList flag
      const pickListItems = bomItems.filter(item =>
        item.partType === 'Hardware' && item.includeOnPickList === true
      )

      // Group by product name
      const groupedByProduct: Record<string, any[]> = {}
      for (const item of pickListItems) {
        const productKey = item.productName
        if (!groupedByProduct[productKey]) {
          groupedByProduct[productKey] = []
        }
        groupedByProduct[productKey].push(item)
      }

      // Aggregate items within each product group by part number
      const aggregatedPickList: any[] = []
      for (const [productName, items] of Object.entries(groupedByProduct)) {
        const aggregatedByPart: Record<string, any> = {}
        for (const item of items) {
          const key = item.partNumber
          if (!aggregatedByPart[key]) {
            aggregatedByPart[key] = {
              productName: productName,
              partNumber: item.partNumber,
              partName: item.partName,
              unit: item.unit,
              includeInJambKit: item.includeInJambKit,
              totalQuantity: 0,
              openings: new Set<string>()
            }
          }
          aggregatedByPart[key].totalQuantity += (item.quantity || 1)
          aggregatedByPart[key].openings.add(item.openingName)
        }

        // Convert Sets to arrays and add to result
        for (const part of Object.values(aggregatedByPart)) {
          aggregatedPickList.push({
            ...part,
            openings: Array.from(part.openings)
          })
        }
      }

      // Sort by product name, then by part number
      aggregatedPickList.sort((a, b) => {
        if (a.productName !== b.productName) {
          return a.productName.localeCompare(b.productName)
        }
        return a.partNumber.localeCompare(b.partNumber)
      })

      // Get unique products for grouping info
      const productGroups = Object.keys(groupedByProduct)

      if (format === 'pdf') {
        // PDF generation will be handled by a separate utility
        const { createPickListPDF } = await import('@/lib/pick-list-pdf-generator')
        const pdfBuffer = await createPickListPDF({
          projectName: project.name,
          customerName: project.customer?.companyName,
          items: aggregatedPickList,
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        })
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-pick-list.pdf`

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      }

      return NextResponse.json({
        projectId,
        projectName: project.name,
        pickListItems: aggregatedPickList,
        productGroups,
        totalItems: aggregatedPickList.reduce((sum, item) => sum + item.totalQuantity, 0)
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
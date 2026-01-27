import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  evaluateFormula,
  aggregateBomItems,
  combinedSummaryToCSV,
  getFrameDimensions,
  calculateRequiredPartLength,
  findBestStockLengthRule,
  applyYieldOptimizationToBomItems,
  type BomItem
} from '@/lib/bom-utils'

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

// Helper function to find stock length for extrusions
async function findStockLength(partNumber: string, bom: any, variables: Record<string, number>): Promise<{
  stockLength: number | null,
  stockLengthOptions: number[],
  isMillFinish: boolean,
  binLocation: string | null
}> {
  try {
    const masterPart = await prisma.masterPart.findUnique({
      where: { partNumber },
      include: {
        stockLengthRules: { where: { isActive: true } },
        binLocationRef: true
      }
    })

    const binLocation = masterPart?.binLocationRef?.code || null

    if (masterPart && (masterPart.partType === 'Extrusion' || masterPart.partType === 'CutStock') && masterPart.stockLengthRules.length > 0) {
      const requiredLength = calculateRequiredPartLength(bom, variables)

      const allStockLengths = [...new Set(
        masterPart.stockLengthRules
          .filter(rule => rule.isActive && rule.stockLength !== null && rule.stockLength >= requiredLength)
          .map(r => r.stockLength)
          .filter((sl): sl is number => sl !== null)
      )].sort((a, b) => a - b)

      const bestRule = findBestStockLengthRule(masterPart.stockLengthRules, requiredLength)

      return {
        stockLength: bestRule?.stockLength || allStockLengths[0] || null,
        stockLengthOptions: allStockLengths,
        isMillFinish: masterPart.isMillFinish || false,
        binLocation
      }
    }

    return { stockLength: null, stockLengthOptions: [], isMillFinish: masterPart?.isMillFinish || false, binLocation }
  } catch (error) {
    console.error(`Error finding stock length for ${partNumber}:`, error)
    return { stockLength: null, stockLengthOptions: [], isMillFinish: false, binLocation: null }
  }
}

// Generate BOM items for a single project (simplified version for summary)
async function generateProjectBomItems(projectId: number): Promise<BomItem[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      customer: {
        select: { companyName: true }
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
                        include: { option: true }
                      },
                      productSubOptions: {
                        include: {
                          category: {
                            include: {
                              individualOptions: {
                                include: {
                                  linkedParts: {
                                    include: {
                                      masterPart: true,
                                      variant: true
                                    }
                                  },
                                  variants: {
                                    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
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
        }
      }
    }
  })

  if (!project) {
    return []
  }

  const bomItems: BomItem[] = []

  // Process each opening
  for (const opening of project.openings) {
    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      const product = panel.componentInstance.product

      // For FRAME products, calculate dimensions dynamically from sibling panels
      const isFrameProduct = product.productType === 'FRAME'
      let effectiveWidth = panel.width || 0
      let effectiveHeight = panel.height || 0

      if (isFrameProduct) {
        const frameDimensions = getFrameDimensions(opening.panels as any, panel.id)
        effectiveWidth = frameDimensions.width
        effectiveHeight = frameDimensions.height
      }

      // Process each BOM item for this component
      for (const bom of product.productBOMs) {
        // Skip option-linked BOMs
        if (bom.optionId) continue

        const variables = {
          width: effectiveWidth,
          height: effectiveHeight,
          Width: effectiveWidth,
          Height: effectiveHeight,
          quantity: bom.quantity || 1
        }

        // Calculate cut length if formula exists
        let cutLength: number | null = null
        if (bom.formula && (bom.partType === 'Extrusion' || bom.partType === 'CutStock')) {
          cutLength = evaluateFormula(bom.formula, variables)
        }

        // Calculate length for Hardware/Fastener parts with LF or IN units
        let calculatedLength: number | null = null
        if (bom.formula && (bom.partType === 'Hardware' || bom.partType === 'Fastener') && (bom.unit === 'LF' || bom.unit === 'IN')) {
          calculatedLength = evaluateFormula(bom.formula, variables)
          if (bom.unit === 'LF' && calculatedLength !== null) {
            calculatedLength = calculatedLength / 12
          }
          cutLength = calculatedLength
        }

        let fullPartNumber = bom.partNumber || ''
        let basePartNumber = bom.partNumber || ''
        let stockLength: number | null = null
        let stockLengthOptions: number[] = []
        let isMillFinish = false

        if ((bom.partType === 'Extrusion' || bom.partType === 'CutStock') && fullPartNumber) {
          if (bom.partNumber) {
            const stockInfo = await findStockLength(bom.partNumber, bom, variables)
            stockLength = stockInfo.stockLength
            stockLengthOptions = stockInfo.stockLengthOptions
            isMillFinish = stockInfo.isMillFinish
          }

          if (bom.partType === 'Extrusion' && opening.finishColor && !isMillFinish) {
            const finishCode = await getFinishCode(opening.finishColor)
            if (finishCode) {
              fullPartNumber = `${fullPartNumber}${finishCode}`
              basePartNumber = fullPartNumber
            }
          }

          if (stockLength) {
            fullPartNumber = `${fullPartNumber}-${stockLength}`
          }
        }

        // Apply finish code for Hardware/CutStock parts with addFinishToPartNumber flag
        if ((bom.partType === 'Hardware' || bom.partType === 'CutStock') && fullPartNumber && bom.addFinishToPartNumber && opening.finishColor) {
          const finishCode = await getFinishCode(opening.finishColor)
          if (finishCode) {
            fullPartNumber = `${fullPartNumber}${finishCode}`
          }
        }

        bomItems.push({
          partNumber: fullPartNumber,
          partName: bom.partName || '',
          partType: bom.partType || '',
          quantity: bom.quantity || 1,
          unit: bom.unit || '',
          stockLength: stockLength,
          cutLength: cutLength,
          calculatedLength: calculatedLength,
          glassWidth: null,
          glassHeight: null,
          glassArea: null,
          isLinkedPart: false,
          isOptionPart: false,
          basePartNumber: (bom.partType === 'Extrusion' || bom.partType === 'CutStock') ? basePartNumber : undefined,
          stockLengthOptions: stockLengthOptions.length > 1 ? stockLengthOptions : undefined
        })
      }

      // Add glass as a separate row
      if (panel.glassType && panel.glassType !== 'None' && panel.glassType !== 'N/A') {
        let glassWidth = effectiveWidth
        let glassHeight = effectiveHeight

        if (product.glassWidthFormula) {
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
          partNumber: `GLASS-${panel.glassType.toUpperCase()}`,
          partName: `${panel.glassType} Glass`,
          partType: 'Glass',
          quantity: 1,
          unit: 'SQ FT',
          stockLength: null,
          cutLength: null,
          calculatedLength: null,
          glassWidth: glassWidth,
          glassHeight: glassHeight,
          glassArea: Math.round((glassWidth * glassHeight / 144) * 100) / 100
        })
      }

      // Process product options (sub-options)
      const processedCategories = new Set<string>()

      if (panel.componentInstance.subOptionSelections) {
        try {
          const selections = JSON.parse(panel.componentInstance.subOptionSelections)
          const includedOptions = JSON.parse(panel.componentInstance.includedOptions || '[]')
          const variantSelections = JSON.parse(panel.componentInstance.variantSelections || '{}')

          for (const [categoryIdStr, optionId] of Object.entries(selections)) {
            processedCategories.add(categoryIdStr)
            const categoryId = parseInt(categoryIdStr)

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
                const optionBom = standardOption.isCutListItem
                  ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
                  : null

                let cutLength: number | null = null
                let stockLength: number | null = null
                let stockLengthOpts: number[] = []
                let optionBasePartNumber = partNumber
                let isMillFinish = false

                if (optionBom && optionBom.formula) {
                  cutLength = evaluateFormula(optionBom.formula, {
                    width: effectiveWidth,
                    height: effectiveHeight,
                    Width: effectiveWidth,
                    Height: effectiveHeight
                  })

                  if (standardOption.partNumber) {
                    const stockInfo = await findStockLength(
                      standardOption.partNumber,
                      { formula: optionBom.formula, partType: 'Extrusion' },
                      { width: effectiveWidth, height: effectiveHeight }
                    )
                    stockLength = stockInfo.stockLength
                    stockLengthOpts = stockInfo.stockLengthOptions
                    isMillFinish = stockInfo.isMillFinish

                    if (opening.finishColor && !isMillFinish) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        partNumber = `${partNumber}${finishCode}`
                        optionBasePartNumber = partNumber
                      }
                    }
                    if (stockLength) {
                      partNumber = `${partNumber}-${stockLength}`
                    }
                  }
                }

                let optionQuantity = 1
                if (optionBom?.quantityMode === 'RANGE') {
                  optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
                } else {
                  optionQuantity = optionBom?.quantity || 1
                }

                bomItems.push({
                  partNumber: partNumber,
                  partName: standardOption.name,
                  partType: optionBom ? 'Extrusion' : 'Option',
                  quantity: optionQuantity,
                  unit: optionBom ? 'IN' : 'EA',
                  stockLength: stockLength,
                  cutLength: cutLength,
                  calculatedLength: null,
                  glassWidth: null,
                  glassHeight: null,
                  glassArea: null,
                  basePartNumber: optionBom ? optionBasePartNumber : undefined,
                  stockLengthOptions: stockLengthOpts.length > 1 ? stockLengthOpts : undefined
                })
              }
              continue
            }

            const individualOption = productSubOption.category.individualOptions?.find(
              (opt: any) => opt.id === Number(optionId)
            )

            if (individualOption) {
              let partNumber = individualOption.partNumber || `OPTION-${individualOption.id}`

              const optionBom = individualOption.isCutListItem
                ? product.productBOMs?.find((bom: any) => bom.optionId === individualOption.id)
                : null

              let cutLength: number | null = null
              let stockLength: number | null = null
              let stockLengthOpts: number[] = []
              let indivBasePartNumber = partNumber
              let isMillFinish = false

              if (optionBom && optionBom.formula) {
                cutLength = evaluateFormula(optionBom.formula, {
                  width: effectiveWidth,
                  height: effectiveHeight,
                  Width: effectiveWidth,
                  Height: effectiveHeight
                })

                if (individualOption.partNumber) {
                  const stockInfo = await findStockLength(
                    individualOption.partNumber,
                    { formula: optionBom.formula, partType: 'Extrusion' },
                    { width: effectiveWidth, height: effectiveHeight }
                  )
                  stockLength = stockInfo.stockLength
                  stockLengthOpts = stockInfo.stockLengthOptions
                  isMillFinish = stockInfo.isMillFinish

                  if (opening.finishColor && !isMillFinish) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      partNumber = `${partNumber}${finishCode}`
                      indivBasePartNumber = partNumber
                    }
                  }
                  if (stockLength) {
                    partNumber = `${partNumber}-${stockLength}`
                  }
                }
              }

              const quantityKey = `${categoryId}_qty`
              let optionQuantity = 1
              if (selections[quantityKey] !== undefined) {
                optionQuantity = Number(selections[quantityKey])
              } else if (optionBom?.quantityMode === 'RANGE') {
                optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
              } else {
                optionQuantity = optionBom?.quantity || 1
              }

              if (optionQuantity === 0) continue

              bomItems.push({
                partNumber: partNumber,
                partName: individualOption.name,
                partType: optionBom ? 'Extrusion' : 'Option',
                quantity: optionQuantity,
                unit: optionBom ? 'IN' : 'EA',
                stockLength: stockLength,
                cutLength: cutLength,
                calculatedLength: null,
                glassWidth: null,
                glassHeight: null,
                glassArea: null,
                basePartNumber: optionBom ? indivBasePartNumber : undefined,
                stockLengthOptions: stockLengthOpts.length > 1 ? stockLengthOpts : undefined
              })

              // Process linked parts for this option
              if (individualOption.linkedParts && individualOption.linkedParts.length > 0) {
                const selectedVariantId = variantSelections[String(individualOption.id)]

                const applicableLinkedParts = individualOption.linkedParts.filter((lp: any) => {
                  if (lp.variantId === null) return true
                  if (!selectedVariantId) {
                    const defaultVariant = individualOption.variants?.find((v: any) => v.isDefault)
                    if (defaultVariant) {
                      return lp.variantId === defaultVariant.id
                    }
                    return false
                  }
                  return lp.variantId === selectedVariantId
                })

                for (const linkedPart of applicableLinkedParts) {
                  const linkedQuantity = (linkedPart.quantity || 1) * optionQuantity
                  const partUnit = linkedPart.masterPart.unit || 'EA'
                  let linkedCalculatedLength: number | null = null
                  let actualLinkedQuantity = linkedQuantity

                  const linkedPartBom = product.productBOMs?.find((bom: any) =>
                    bom.optionId === individualOption.id && bom.partNumber === linkedPart.masterPart.partNumber
                  )

                  if (linkedPartBom && partUnit !== 'LF' && partUnit !== 'IN') {
                    continue
                  }

                  let linkedCutLength: number | null = null
                  let linkedStockLength: number | null = null
                  let linkedStockLengthOpts: number[] = []
                  let linkedIsMillFinish = false

                  if (linkedPartBom?.formula) {
                    linkedCutLength = evaluateFormula(linkedPartBom.formula, {
                      width: effectiveWidth,
                      height: effectiveHeight,
                      Width: effectiveWidth,
                      Height: effectiveHeight
                    })

                    if (partUnit === 'LF' || partUnit === 'IN') {
                      linkedCalculatedLength = linkedCutLength
                      if (partUnit === 'LF' && linkedCalculatedLength !== null) {
                        linkedCalculatedLength = linkedCalculatedLength / 12
                        linkedCutLength = linkedCalculatedLength
                      }
                      actualLinkedQuantity = linkedCalculatedLength !== null
                        ? linkedCalculatedLength * optionQuantity
                        : linkedQuantity
                    }

                    if (linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock') {
                      const stockInfo = await findStockLength(
                        linkedPart.masterPart.partNumber,
                        { formula: linkedPartBom.formula, partType: linkedPart.masterPart.partType },
                        { width: effectiveWidth, height: effectiveHeight }
                      )
                      linkedStockLength = stockInfo.stockLength
                      linkedStockLengthOpts = stockInfo.stockLengthOptions
                      linkedIsMillFinish = stockInfo.isMillFinish
                    }
                  }

                  let linkedPartNumber = linkedPart.masterPart.partNumber
                  let linkedBasePartNumber = linkedPart.masterPart.partNumber

                  // For extrusions only (not CutStock), apply finish code based on isMillFinish
                  if (linkedPart.masterPart.partType === 'Extrusion' && opening.finishColor && !linkedIsMillFinish) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      linkedPartNumber = `${linkedPartNumber}${finishCode}`
                      linkedBasePartNumber = linkedPartNumber
                    }
                  } else if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      linkedPartNumber = `${linkedPartNumber}${finishCode}`
                    }
                  }

                  if (linkedStockLength) {
                    linkedPartNumber = `${linkedPartNumber}-${linkedStockLength}`
                  }

                  const isLinkedExtrusion = linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock'
                  bomItems.push({
                    partNumber: linkedPartNumber,
                    partName: linkedPart.masterPart.baseName,
                    partType: linkedPart.masterPart.partType || 'Hardware',
                    quantity: actualLinkedQuantity,
                    unit: partUnit,
                    stockLength: linkedStockLength,
                    cutLength: linkedCutLength,
                    calculatedLength: linkedCalculatedLength,
                    glassWidth: null,
                    glassHeight: null,
                    glassArea: null,
                    isLinkedPart: true,
                    basePartNumber: isLinkedExtrusion ? linkedBasePartNumber : undefined,
                    stockLengthOptions: linkedStockLengthOpts.length > 1 ? linkedStockLengthOpts : undefined
                  })
                }
              }
            }
          }
        } catch (error) {
          console.error('Error parsing product options:', error)
        }
      }

      // Add standard options for categories not in selections
      for (const productSubOption of product.productSubOptions || []) {
        const categoryId = productSubOption.category.id.toString()
        if (!processedCategories.has(categoryId) && productSubOption.standardOptionId) {
          const standardOption = productSubOption.category.individualOptions?.find(
            (opt: any) => opt.id === productSubOption.standardOptionId
          )
          if (standardOption) {
            let partNumber = standardOption.partNumber || `OPTION-${standardOption.id}`

            const optionBom = standardOption.isCutListItem
              ? product.productBOMs?.find((bom: any) => bom.optionId === standardOption.id)
              : null

            let cutLength: number | null = null
            let stockLength: number | null = null
            let stockLengthOpts: number[] = []
            let stdBasePartNumber = partNumber
            let isMillFinish = false

            if (optionBom && optionBom.formula) {
              cutLength = evaluateFormula(optionBom.formula, {
                width: effectiveWidth,
                height: effectiveHeight,
                Width: effectiveWidth,
                Height: effectiveHeight
              })

              if (standardOption.partNumber) {
                const stockInfo = await findStockLength(
                  standardOption.partNumber,
                  { formula: optionBom.formula, partType: 'Extrusion' },
                  { width: effectiveWidth, height: effectiveHeight }
                )
                stockLength = stockInfo.stockLength
                stockLengthOpts = stockInfo.stockLengthOptions
                isMillFinish = stockInfo.isMillFinish

                if (opening.finishColor && !isMillFinish) {
                  const finishCode = await getFinishCode(opening.finishColor)
                  if (finishCode) {
                    partNumber = `${partNumber}${finishCode}`
                    stdBasePartNumber = partNumber
                  }
                }
                if (stockLength) {
                  partNumber = `${partNumber}-${stockLength}`
                }
              }
            }

            let optionQuantity = 1
            if (optionBom?.quantityMode === 'RANGE') {
              optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
            } else {
              optionQuantity = optionBom?.quantity || 1
            }

            bomItems.push({
              partNumber: partNumber,
              partName: standardOption.name,
              partType: optionBom ? 'Extrusion' : 'Option',
              quantity: optionQuantity,
              unit: optionBom ? 'IN' : 'EA',
              stockLength: stockLength,
              cutLength: cutLength,
              calculatedLength: null,
              glassWidth: null,
              glassHeight: null,
              glassArea: null,
              basePartNumber: optionBom ? stdBasePartNumber : undefined,
              stockLengthOptions: stockLengthOpts.length > 1 ? stockLengthOpts : undefined
            })
          }
        }
      }
    }
  }

  return bomItems
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectIds } = body

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    // Validate input
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'projectIds must be a non-empty array of project IDs' },
        { status: 400 }
      )
    }

    // Validate all IDs are valid numbers
    const validIds = projectIds.filter(id => !isNaN(parseInt(id)))
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid project IDs provided' },
        { status: 400 }
      )
    }

    // Fetch project info for response and CSV header
    const projects = await prisma.project.findMany({
      where: { id: { in: validIds.map(id => parseInt(id)) } },
      select: {
        id: true,
        name: true,
        customer: {
          select: { companyName: true }
        }
      }
    })

    if (projects.length === 0) {
      return NextResponse.json(
        { error: 'No projects found with the provided IDs' },
        { status: 404 }
      )
    }

    // Generate BOM items for each project and combine
    const allBomItems: BomItem[] = []
    const stockLengthOptionsMap: Record<string, number[]> = {}

    for (const project of projects) {
      const projectBomItems = await generateProjectBomItems(project.id)
      allBomItems.push(...projectBomItems)

      // Collect stock length options
      for (const item of projectBomItems) {
        if ((item.partType === 'Extrusion' || item.partType === 'CutStock') &&
            item.basePartNumber && item.stockLengthOptions && item.stockLengthOptions.length > 1) {
          if (!stockLengthOptionsMap[item.basePartNumber]) {
            stockLengthOptionsMap[item.basePartNumber] = []
          }
          for (const sl of item.stockLengthOptions) {
            if (!stockLengthOptionsMap[item.basePartNumber].includes(sl)) {
              stockLengthOptionsMap[item.basePartNumber].push(sl)
            }
          }
        }
      }
    }

    // Apply yield optimization to combined BOM items
    const optimizedBomItems = applyYieldOptimizationToBomItems(allBomItems, stockLengthOptionsMap)

    // Aggregate all BOM items
    const summaryItems = aggregateBomItems(optimizedBomItems, stockLengthOptionsMap)

    // Calculate totals
    const totals = {
      totalParts: summaryItems.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalExtrusions: summaryItems.filter(item => item.partType === 'Extrusion').reduce((sum, item) => sum + item.totalQuantity, 0),
      totalCutStock: summaryItems.filter(item => item.partType === 'CutStock').reduce((sum, item) => sum + item.totalQuantity, 0),
      totalHardware: summaryItems.filter(item => item.partType === 'Hardware').reduce((sum, item) => sum + item.totalQuantity, 0),
      totalGlass: summaryItems.filter(item => item.partType === 'Glass').reduce((sum, item) => sum + item.totalQuantity, 0),
      totalOptions: summaryItems.filter(item => item.partType === 'Option').reduce((sum, item) => sum + item.totalQuantity, 0),
      totalStockPiecesToOrder: summaryItems
        .filter(item => (item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null)
        .reduce((sum, item) => sum + (item.stockPiecesNeeded ?? 0), 0)
    }

    // Format project info for response
    const projectInfo = projects.map(p => ({
      id: p.id,
      name: p.name,
      customerName: p.customer?.companyName || 'Unknown'
    }))

    // If CSV format requested, return as file download
    if (format === 'csv') {
      const projectNames = projects.map(p => p.name)
      const csvContent = combinedSummaryToCSV(projectNames, summaryItems)
      const filename = `combined-purchase-summary-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    return NextResponse.json({
      projects: projectInfo,
      summaryItems,
      totals
    })
  } catch (error) {
    console.error('Error generating combined summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate combined summary' },
      { status: 500 }
    )
  }
}

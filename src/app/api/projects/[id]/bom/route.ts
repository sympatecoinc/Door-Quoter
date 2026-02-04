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
  findBestStockLengthRule,
  applyYieldOptimizationToBomItems
} from '@/lib/bom-utils'
import { aggregateFromProjectData, createAssemblyListPDF } from '@/lib/assembly-list-pdf-generator'
import { createCutListPDF, CutListPdfGroup, CutListPdfItem } from '@/lib/cutlist-pdf-generator'

// Helper function to get company logo from branding settings
async function getCompanyLogo(): Promise<string | null> {
  try {
    const logoSetting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })
    return logoSetting?.value || null
  } catch (error) {
    console.error('Error fetching company logo:', error)
    return null
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

// Helper function to find stock length for extrusions using the new formula-based approach
// Returns the best stock length as well as ALL applicable stock lengths for yield optimization
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
      // Calculate the required part length from the ProductBOM formula
      const requiredLength = calculateRequiredPartLength(bom, variables)

      // For yield optimization: collect ALL stock lengths that can physically fit the cut
      // (stockLength >= requiredLength), regardless of the rule's height constraints.
      // The yield optimizer will decide which is best based on all cuts combined.
      const allStockLengths = [...new Set(
        masterPart.stockLengthRules
          .filter(rule => rule.isActive && rule.stockLength !== null && rule.stockLength >= requiredLength)
          .map(r => r.stockLength)
          .filter((sl): sl is number => sl !== null)
      )].sort((a, b) => a - b)

      // Get the best (most specific) rule for initial assignment based on height constraints
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
    const jambkit = searchParams.get('jambkit') === 'true'
    const boxlist = searchParams.get('boxlist') === 'true'
    const format = searchParams.get('format')
    const productFilter = searchParams.get('product')
    const sizeFilter = searchParams.get('size')  // e.g., "42x108"
    const batchSize = parseInt(searchParams.get('batch') || '1') || 1
    const openingsFilter = searchParams.get('openings')  // comma-separated list of opening names

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
            },
            presetPartInstances: {
              include: {
                presetPart: true
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
          const frameDimensions = getFrameDimensions(opening.panels as any, panel.id)
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
          if (bom.formula && (bom.partType === 'Extrusion' || bom.partType === 'CutStock')) {
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
          let basePartNumber = bom.partNumber || ''  // Part number before stock length suffix
          let stockLength: number | null = null
          let stockLengthOptions: number[] = []
          let isMillFinish = false
          let binLocation: string | null = null

          if ((bom.partType === 'Extrusion' || bom.partType === 'CutStock') && fullPartNumber) {
            // Find stock length and isMillFinish flag from MasterPart
            if (bom.partNumber) {
              const stockInfo = await findStockLength(bom.partNumber, bom, variables)
              stockLength = stockInfo.stockLength
              stockLengthOptions = stockInfo.stockLengthOptions
              isMillFinish = stockInfo.isMillFinish
              binLocation = stockInfo.binLocation
            }

            // Only append finish color code for Extrusions (not CutStock), and only if NOT mill finish
            if (bom.partType === 'Extrusion' && opening.finishColor && !isMillFinish) {
              const finishCode = await getFinishCode(opening.finishColor)
              if (finishCode) {
                fullPartNumber = `${fullPartNumber}${finishCode}`
                basePartNumber = fullPartNumber  // Base includes finish code
              }
            }

            // Always append stock length (regardless of mill finish status)
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

          // Apply direction suffix for Hardware parts with appendDirectionToPartNumber flag
          if (bom.partType === 'Hardware' && fullPartNumber && bom.partNumber) {
            const masterPartForDirection = await prisma.masterPart.findUnique({
              where: { partNumber: bom.partNumber },
              select: { appendDirectionToPartNumber: true }
            })
            if (masterPartForDirection?.appendDirectionToPartNumber) {
              // Get direction from panel's swingDirection or slidingDirection
              // Check for both empty string AND 'None' since sliding doors may have empty swingDirection
              const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
              if (direction && direction !== 'None') {
                // Convert direction to abbreviation (first letter of each word, e.g., "Right Sliding" -> "RS")
                const directionCode = direction
                  .replace(/-/g, ' ')  // Replace hyphens with spaces
                  .split(' ')
                  .filter((word: string) => word.length > 0)
                  .map((word: string) => word.charAt(0).toUpperCase())
                  .join('')
                fullPartNumber = `${fullPartNumber}-${directionCode}`
              }
            }
          }

          // Calculate % of stock used
          let percentOfStock: number | null = null
          if ((bom.partType === 'Extrusion' || bom.partType === 'CutStock') && cutLength && stockLength && stockLength > 0) {
            percentOfStock = (cutLength / stockLength) * 100
          }

          // Lookup MasterPart for Hardware/Extrusion/Fastener to get pick list station and jamb kit flags
          let pickListStation: string | null = null
          let includeInJambKit = false
          if ((bom.partType === 'Hardware' || bom.partType === 'Extrusion' || bom.partType === 'Fastener') && bom.partNumber) {
            const masterPart = await prisma.masterPart.findUnique({
              where: { partNumber: bom.partNumber },
              select: { pickListStation: true, includeInJambKit: true }
            })
            if (masterPart) {
              pickListStation = masterPart.pickListStation
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
            pickListStation: pickListStation,
            includeInJambKit: includeInJambKit,
            isMilled: bom.isMilled !== false, // Default to true if not set
            binLocation: binLocation,
            // For yield-based stock length optimization
            basePartNumber: (bom.partType === 'Extrusion' || bom.partType === 'CutStock') ? basePartNumber : undefined,
            stockLengthOptions: stockLengthOptions.length > 1 ? stockLengthOptions : undefined
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

              // Apply direction suffix if applicable
              if (gtp.masterPart.appendDirectionToPartNumber) {
                const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                if (direction && direction !== 'None') {
                  const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                  fullPartNumber = `${fullPartNumber}-${directionCode}`
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
            const variantSelections = JSON.parse(panel.componentInstance.variantSelections || '{}')

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
                  let stockLengthOpts: number[] = []
                  let optionBasePartNumber = partNumber  // Track base before stock length suffix
                  let isMillFinish = false
                  let percentOfStock: number | null = null
                  let optionBinLocation: string | null = null

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
                      stockLengthOpts = stockInfo.stockLengthOptions
                      isMillFinish = stockInfo.isMillFinish
                      optionBinLocation = stockInfo.binLocation

                      // Build full part number with finish code and stock length
                      // For extrusions (cut list items), apply finish code based on isMillFinish only
                      if (opening.finishColor && !isMillFinish) {
                        const finishCode = await getFinishCode(opening.finishColor)
                        if (finishCode) {
                          partNumber = `${partNumber}${finishCode}`
                          optionBasePartNumber = partNumber  // Base includes finish code
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

                    // Apply direction suffix if MasterPart has appendDirectionToPartNumber set
                    if (standardOption.partNumber) {
                      const masterPartForDir = await prisma.masterPart.findUnique({
                        where: { partNumber: standardOption.partNumber },
                        select: { appendDirectionToPartNumber: true }
                      })
                      if (masterPartForDir?.appendDirectionToPartNumber) {
                        const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                        if (direction && direction !== 'None') {
                          const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                          partNumber = `${partNumber}-${directionCode}`
                        }
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

                  // Look up MasterPart for option's jamb kit and pick list flags
                  let optionPickListStation: string | null = null
                  let optionIncludeInJambKit = false
                  if (standardOption.partNumber) {
                    const optionMasterPart = await prisma.masterPart.findUnique({
                      where: { partNumber: standardOption.partNumber },
                      select: { pickListStation: true, includeInJambKit: true }
                    })
                    if (optionMasterPart) {
                      optionPickListStation = optionMasterPart.pickListStation
                      optionIncludeInJambKit = optionMasterPart.includeInJambKit
                    }
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
                    optionPrice: (standardOption as any).price ?? 0,
                    isMilled: optionBom?.isMilled !== false,
                    binLocation: optionBinLocation,
                    pickListStation: optionPickListStation,
                    includeInJambKit: optionIncludeInJambKit,
                    // For yield-based stock length optimization
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
                let stockLengthOpts: number[] = []
                let indivBasePartNumber = partNumber  // Track base before stock length suffix
                let isMillFinish = false
                let percentOfStock: number | null = null
                let optionBinLocation: string | null = null

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
                    stockLengthOpts = stockInfo.stockLengthOptions
                    isMillFinish = stockInfo.isMillFinish
                    optionBinLocation = stockInfo.binLocation

                    // Build full part number with finish code and stock length
                    // For extrusions (cut list items), apply finish code based on isMillFinish only
                    if (opening.finishColor && !isMillFinish) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        partNumber = `${partNumber}${finishCode}`
                        indivBasePartNumber = partNumber  // Base includes finish code
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

                  // Apply direction suffix if MasterPart has appendDirectionToPartNumber set
                  if (individualOption.partNumber) {
                    const masterPartForDir = await prisma.masterPart.findUnique({
                      where: { partNumber: individualOption.partNumber },
                      select: { appendDirectionToPartNumber: true }
                    })
                    if (masterPartForDir?.appendDirectionToPartNumber) {
                      const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                      if (direction && direction !== 'None') {
                        const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                        partNumber = `${partNumber}-${directionCode}`
                      }
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

                // Look up MasterPart for option's jamb kit and pick list flags
                let indivPickListStation: string | null = null
                let indivIncludeInJambKit = false
                if (individualOption.partNumber) {
                  const indivMasterPart = await prisma.masterPart.findUnique({
                    where: { partNumber: individualOption.partNumber },
                    select: { pickListStation: true, includeInJambKit: true }
                  })
                  if (indivMasterPart) {
                    indivPickListStation = indivMasterPart.pickListStation
                    indivIncludeInJambKit = indivMasterPart.includeInJambKit
                  }
                }

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
                  optionPrice: (individualOption as any).price ?? 0,
                  isMilled: optionBom?.isMilled !== false,
                  binLocation: optionBinLocation,
                  pickListStation: indivPickListStation,
                  includeInJambKit: indivIncludeInJambKit,
                  // For yield-based stock length optimization
                  basePartNumber: optionBom ? indivBasePartNumber : undefined,
                  stockLengthOptions: stockLengthOpts.length > 1 ? stockLengthOpts : undefined
                })

                // Track which part numbers have been processed as linked parts (to avoid duplicates in optionParts)
                const processedLinkedPartNumbers = new Set<string>()

                // Process linked parts for this option
                if (individualOption.linkedParts && individualOption.linkedParts.length > 0) {
                  // Get the selected variant for this option (if any)
                  const selectedVariantId = variantSelections[String(individualOption.id)]

                  // Filter linked parts based on variant selection:
                  // Include parts where variantId is null (applies to all variants) OR matches selected variant
                  const applicableLinkedParts = individualOption.linkedParts.filter((lp: any) => {
                    if (lp.variantId === null) return true // Applies to all variants
                    if (!selectedVariantId) {
                      // No variant selected - use default variant if exists, otherwise only include null-variant parts
                      const defaultVariant = individualOption.variants?.find((v: any) => v.isDefault)
                      if (defaultVariant) {
                        return lp.variantId === defaultVariant.id
                      }
                      return false // No default, only include parts without variant
                    }
                    return lp.variantId === selectedVariantId
                  })

                  for (const linkedPart of applicableLinkedParts) {
                    const linkedQuantity = (linkedPart.quantity || 1) * optionQuantity
                    const partUnit = linkedPart.masterPart.unit || 'EA'
                    let linkedCalculatedLength: number | null = null
                    let actualLinkedQuantity = linkedQuantity  // default to fixed quantity

                    // Look up ProductBOM entry for this linked part to get formula
                    const linkedPartBom = product.productBOMs?.find((bom: any) =>
                      bom.optionId === individualOption.id && bom.partNumber === linkedPart.masterPart.partNumber
                    )

                    // If this part has a ProductBOM entry but is NOT LF/IN, skip it here
                    // It will be handled by the optionParts section below
                    if (linkedPartBom && partUnit !== 'LF' && partUnit !== 'IN') {
                      continue
                    }

                    // Calculate cut length if formula exists
                    let linkedCutLength: number | null = null
                    let linkedStockLength: number | null = null
                    let linkedStockLengthOpts: number[] = []
                    let linkedPercentOfStock: number | null = null
                    let linkedIsMillFinish = false
                    let linkedBinLocation: string | null = null

                    if (linkedPartBom?.formula) {
                      linkedCutLength = evaluateFormula(linkedPartBom.formula, {
                        width: effectiveWidth,
                        height: effectiveHeight,
                        Width: effectiveWidth,
                        Height: effectiveHeight
                      })

                      // Handle LF/IN units - convert and use as quantity
                      if (partUnit === 'LF' || partUnit === 'IN') {
                        linkedCalculatedLength = linkedCutLength
                        // Convert inches to feet if unit is LF
                        if (partUnit === 'LF' && linkedCalculatedLength !== null) {
                          linkedCalculatedLength = linkedCalculatedLength / 12
                          linkedCutLength = linkedCalculatedLength
                        }
                        actualLinkedQuantity = linkedCalculatedLength !== null
                          ? linkedCalculatedLength * optionQuantity
                          : linkedQuantity
                      }

                      // Look up stock length for extrusions/CutStock
                      if (linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock') {
                        const stockInfo = await findStockLength(
                          linkedPart.masterPart.partNumber,
                          { formula: linkedPartBom.formula, partType: linkedPart.masterPart.partType },
                          { width: effectiveWidth, height: effectiveHeight }
                        )
                        linkedStockLength = stockInfo.stockLength
                        linkedStockLengthOpts = stockInfo.stockLengthOptions
                        linkedIsMillFinish = stockInfo.isMillFinish
                        linkedBinLocation = stockInfo.binLocation

                        if (linkedCutLength && linkedStockLength && linkedStockLength > 0) {
                          linkedPercentOfStock = (linkedCutLength / linkedStockLength) * 100
                        }
                      }
                    }

                    // Build part number with finish code if applicable
                    let linkedPartNumber = linkedPart.masterPart.partNumber
                    let linkedBasePartNumber = linkedPart.masterPart.partNumber  // Track base before suffix

                    // For extrusions only (not CutStock), apply finish code based on isMillFinish
                    if (linkedPart.masterPart.partType === 'Extrusion' && opening.finishColor && !linkedIsMillFinish) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        linkedPartNumber = `${linkedPartNumber}${finishCode}`
                        linkedBasePartNumber = linkedPartNumber  // Base includes finish code
                      }
                    } else if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        linkedPartNumber = `${linkedPartNumber}${finishCode}`
                      }
                    }

                    // Append stock length for extrusions
                    if (linkedStockLength) {
                      linkedPartNumber = `${linkedPartNumber}-${linkedStockLength}`
                    }

                    // Apply direction suffix if applicable
                    if (linkedPart.masterPart.appendDirectionToPartNumber) {
                      const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                      if (direction && direction !== 'None') {
                        const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                        linkedPartNumber = `${linkedPartNumber}-${directionCode}`
                      }
                    }

                    const isLinkedExtrusion = linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock'
                    bomItems.push({
                      openingName: opening.name,
                      panelId: panel.id,
                      productName: product.name,
                      panelWidth: effectiveWidth,
                      panelHeight: effectiveHeight,
                      partNumber: linkedPartNumber,
                      partName: linkedPart.masterPart.baseName,
                      partType: linkedPart.masterPart.partType || 'Hardware',
                      quantity: actualLinkedQuantity,
                      cutLength: linkedCutLength,
                      calculatedLength: linkedCalculatedLength,
                      stockLength: linkedStockLength,
                      percentOfStock: linkedPercentOfStock,
                      unit: partUnit,
                      description: `Linked: ${individualOption.name}${linkedPart.variant ? ` (${linkedPart.variant.name})` : ''}`,
                      color: linkedPart.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A',
                      addToPackingList: linkedPart.masterPart.addToPackingList,
                      isLinkedPart: true,
                      pickListStation: linkedPart.masterPart.pickListStation || null,
                      includeInJambKit: linkedPart.masterPart.includeInJambKit || false,
                      isMilled: linkedPartBom?.isMilled !== false,
                      binLocation: linkedBinLocation,
                      // For yield-based stock length optimization
                      basePartNumber: isLinkedExtrusion ? linkedBasePartNumber : undefined,
                      stockLengthOptions: linkedStockLengthOpts.length > 1 ? linkedStockLengthOpts : undefined
                    })

                    // Track this part number to avoid duplicate processing in optionParts
                    processedLinkedPartNumbers.add(linkedPart.masterPart.partNumber)
                  }
                }

                // Process additional ProductBOM entries for this option (parts with formulas at product level)
                // Exclude parts already processed as linked parts to avoid duplicate entries
                const optionParts = product.productBOMs?.filter((bom: any) =>
                  bom.optionId === individualOption.id &&
                  bom.partNumber &&
                  bom.partNumber !== individualOption.partNumber &&
                  !processedLinkedPartNumbers.has(bom.partNumber)
                ) || []

                for (const optionPart of optionParts) {
                  // Get unit from ProductBOM, or look up from MasterPart if not set
                  let partUnit = optionPart.unit
                  if (!partUnit && optionPart.partNumber) {
                    const masterPartForUnit = await prisma.masterPart.findUnique({
                      where: { partNumber: optionPart.partNumber },
                      select: { unit: true }
                    })
                    partUnit = masterPartForUnit?.unit || 'EA'
                  } else {
                    partUnit = partUnit || 'EA'
                  }
                  let partQuantity: number
                  let partCutLength: number | null = null

                  if (optionPart.formula && (partUnit === 'LF' || partUnit === 'IN')) {
                    // Evaluate formula for LF/IN parts
                    const formulaVariables = {
                      width: effectiveWidth,
                      height: effectiveHeight,
                      Width: effectiveWidth,
                      Height: effectiveHeight,
                      quantity: optionQuantity
                    }
                    let calculatedLength = evaluateFormula(optionPart.formula, formulaVariables)

                    // Convert to feet if unit is LF
                    if (partUnit === 'LF') {
                      calculatedLength = calculatedLength / 12
                    }

                    partCutLength = calculatedLength
                    partQuantity = calculatedLength * optionQuantity
                  } else {
                    partQuantity = (optionPart.quantity || 1) * optionQuantity
                  }

                  // Build part number with finish code if applicable
                  let optionPartNumber = optionPart.partNumber
                  if (optionPart.addFinishToPartNumber && opening.finishColor) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      optionPartNumber = `${optionPartNumber}${finishCode}`
                    }
                  }

                  bomItems.push({
                    openingName: opening.name,
                    panelId: panel.id,
                    productName: product.name,
                    panelWidth: effectiveWidth,
                    panelHeight: effectiveHeight,
                    partNumber: optionPartNumber,
                    partName: optionPart.partName,
                    partType: optionPart.partType || 'Hardware',
                    quantity: partQuantity,
                    cutLength: partCutLength,
                    stockLength: null,
                    percentOfStock: null,
                    unit: partUnit,
                    description: `${individualOption.name} - ${optionPart.partName}`,
                    color: optionPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A',
                    addToPackingList: optionPart.addToPackingList,
                    isOptionPart: true,
                    calculatedLength: partCutLength
                  })
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
              let stockLengthOpts2: number[] = []
              let stdBasePartNumber = partNumber  // Track base before stock length suffix
              let isMillFinish = false
              let percentOfStock: number | null = null
              let optionBinLocation: string | null = null

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
                  stockLengthOpts2 = stockInfo.stockLengthOptions
                  isMillFinish = stockInfo.isMillFinish
                  optionBinLocation = stockInfo.binLocation

                  // Build full part number with finish code and stock length
                  // For extrusions (cut list items), apply finish code based on isMillFinish only
                  if (opening.finishColor && !isMillFinish) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      partNumber = `${partNumber}${finishCode}`
                      stdBasePartNumber = partNumber  // Base includes finish code
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

                // Apply direction suffix if MasterPart has appendDirectionToPartNumber set
                if (standardOption.partNumber) {
                  const masterPartForDir = await prisma.masterPart.findUnique({
                    where: { partNumber: standardOption.partNumber },
                    select: { appendDirectionToPartNumber: true }
                  })
                  if (masterPartForDir?.appendDirectionToPartNumber) {
                    const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                    if (direction && direction !== 'None') {
                      const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                      partNumber = `${partNumber}-${directionCode}`
                    }
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

              // Look up MasterPart for option's jamb kit and pick list flags
              let stdPickListStation: string | null = null
              let stdIncludeInJambKit = false
              if (standardOption.partNumber) {
                const stdMasterPart = await prisma.masterPart.findUnique({
                  where: { partNumber: standardOption.partNumber },
                  select: { pickListStation: true, includeInJambKit: true }
                })
                if (stdMasterPart) {
                  stdPickListStation = stdMasterPart.pickListStation
                  stdIncludeInJambKit = stdMasterPart.includeInJambKit
                }
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
                optionPrice: (standardOption as any).price ?? 0,
                isMilled: optionBom?.isMilled !== false,
                binLocation: optionBinLocation,
                pickListStation: stdPickListStation,
                includeInJambKit: stdIncludeInJambKit,
                // For yield-based stock length optimization
                basePartNumber: optionBom ? stdBasePartNumber : undefined,
                stockLengthOptions: stockLengthOpts2.length > 1 ? stockLengthOpts2 : undefined
              })

              // Process linked parts for standard option
              if (standardOption.linkedParts && standardOption.linkedParts.length > 0) {
                // For standard options, use the default variant
                const defaultVariant = standardOption.variants?.find((v: any) => v.isDefault)

                // Filter linked parts based on default variant
                const applicableLinkedParts = standardOption.linkedParts.filter((lp: any) => {
                  if (lp.variantId === null) return true // Applies to all variants
                  if (defaultVariant) {
                    return lp.variantId === defaultVariant.id
                  }
                  return false // No default, only include parts without variant
                })

                for (const linkedPart of applicableLinkedParts) {
                  const linkedQuantity = (linkedPart.quantity || 1) * optionQuantity
                  const partUnit = linkedPart.masterPart.unit || 'EA'
                  let linkedCalculatedLength: number | null = null
                  let actualLinkedQuantity = linkedQuantity  // default to fixed quantity

                  // Look up ProductBOM entry for this linked part to get formula
                  const linkedPartBom = product.productBOMs?.find((bom: any) =>
                    bom.optionId === standardOption.id && bom.partNumber === linkedPart.masterPart.partNumber
                  )

                  // Calculate cut length if formula exists
                  let linkedCutLength: number | null = null
                  let linkedStockLength: number | null = null
                  let linkedStockLengthOpts2: number[] = []
                  let linkedPercentOfStock: number | null = null
                  let linkedIsMillFinish = false
                  let linkedBinLocation: string | null = null

                  if (linkedPartBom?.formula) {
                    linkedCutLength = evaluateFormula(linkedPartBom.formula, {
                      width: effectiveWidth,
                      height: effectiveHeight,
                      Width: effectiveWidth,
                      Height: effectiveHeight
                    })

                    // Handle LF/IN units - convert and use as quantity
                    if (partUnit === 'LF' || partUnit === 'IN') {
                      linkedCalculatedLength = linkedCutLength
                      // Convert inches to feet if unit is LF
                      if (partUnit === 'LF' && linkedCalculatedLength !== null) {
                        linkedCalculatedLength = linkedCalculatedLength / 12
                        linkedCutLength = linkedCalculatedLength
                      }
                      actualLinkedQuantity = linkedCalculatedLength !== null
                        ? linkedCalculatedLength * optionQuantity
                        : linkedQuantity
                    }

                    // Look up stock length for extrusions/CutStock
                    if (linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock') {
                      const stockInfo = await findStockLength(
                        linkedPart.masterPart.partNumber,
                        { formula: linkedPartBom.formula, partType: linkedPart.masterPart.partType },
                        { width: effectiveWidth, height: effectiveHeight }
                      )
                      linkedStockLength = stockInfo.stockLength
                      linkedStockLengthOpts2 = stockInfo.stockLengthOptions
                      linkedIsMillFinish = stockInfo.isMillFinish
                      linkedBinLocation = stockInfo.binLocation

                      if (linkedCutLength && linkedStockLength && linkedStockLength > 0) {
                        linkedPercentOfStock = (linkedCutLength / linkedStockLength) * 100
                      }
                    }
                  }

                  // Build part number with finish code if applicable
                  let linkedPartNumber = linkedPart.masterPart.partNumber
                  let linkedBasePartNumber2 = linkedPart.masterPart.partNumber  // Track base before suffix

                  // For extrusions only (not CutStock), apply finish code based on isMillFinish
                  if (linkedPart.masterPart.partType === 'Extrusion' && opening.finishColor && !linkedIsMillFinish) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      linkedPartNumber = `${linkedPartNumber}${finishCode}`
                      linkedBasePartNumber2 = linkedPartNumber  // Base includes finish code
                    }
                  } else if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      linkedPartNumber = `${linkedPartNumber}${finishCode}`
                    }
                  }

                  // Append stock length for extrusions
                  if (linkedStockLength) {
                    linkedPartNumber = `${linkedPartNumber}-${linkedStockLength}`
                  }

                  // Apply direction suffix if applicable
                  if (linkedPart.masterPart.appendDirectionToPartNumber) {
                    const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                    if (direction && direction !== 'None') {
                      const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                      linkedPartNumber = `${linkedPartNumber}-${directionCode}`
                    }
                  }

                  const isLinkedExtrusion2 = linkedPart.masterPart.partType === 'Extrusion' || linkedPart.masterPart.partType === 'CutStock'
                  bomItems.push({
                    openingName: opening.name,
                    panelId: panel.id,
                    productName: product.name,
                    panelWidth: effectiveWidth,
                    panelHeight: effectiveHeight,
                    partNumber: linkedPartNumber,
                    partName: linkedPart.masterPart.baseName,
                    partType: linkedPart.masterPart.partType || 'Hardware',
                    quantity: actualLinkedQuantity,
                    cutLength: linkedCutLength,
                    calculatedLength: linkedCalculatedLength,
                    stockLength: linkedStockLength,
                    percentOfStock: linkedPercentOfStock,
                    unit: partUnit,
                    description: `Linked: ${standardOption.name}${linkedPart.variant ? ` (${linkedPart.variant.name})` : ''}`,
                    color: linkedPart.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A',
                    addToPackingList: linkedPart.masterPart.addToPackingList,
                    isLinkedPart: true,
                    pickListStation: linkedPart.masterPart.pickListStation || null,
                    includeInJambKit: linkedPart.masterPart.includeInJambKit || false,
                    isMilled: linkedPartBom?.isMilled !== false,
                    binLocation: linkedBinLocation,
                    // For yield-based stock length optimization
                    basePartNumber: isLinkedExtrusion2 ? linkedBasePartNumber2 : undefined,
                    stockLengthOptions: linkedStockLengthOpts2.length > 1 ? linkedStockLengthOpts2 : undefined
                  })
                }
              }
            }
          }
        }
      }

      // Note: Starter channels are now handled via category options with RANGE mode
      // The old hardcoded includeStarterChannels logic has been removed

      // Process preset part instances for this opening
      if (opening.presetPartInstances && opening.presetPartInstances.length > 0) {
        for (const instance of opening.presetPartInstances) {
          const part = instance.presetPart
          if (!part || !part.partName) continue

          // Determine unit based on part type
          const partUnit = part.unit || (part.partType === 'Extrusion' ? 'EA' : 'EA')

          // Find master part if part number is specified
          let masterPart = null
          let stockLength: number | null = null
          let cutLength: number | null = null

          if (part.partNumber) {
            masterPart = await prisma.masterPart.findUnique({
              where: { partNumber: part.partNumber },
              include: {
                stockLengthRules: { where: { isActive: true } }
              }
            })

            if (masterPart && part.partType === 'Extrusion') {
              // Find appropriate stock length
              if (masterPart.stockLengthRules && masterPart.stockLengthRules.length > 0) {
                const defaultRule = masterPart.stockLengthRules.find((r: any) => r.minHeight === null && r.maxHeight === null)
                stockLength = defaultRule?.stockLength || masterPart.stockLengthRules[0]?.stockLength || part.stockLength || null
              } else {
                stockLength = part.stockLength || null
              }

              // If formula produced a cut length (e.g., perimeter calculation), use it
              if (part.formula && instance.calculatedQuantity) {
                cutLength = instance.calculatedQuantity
              }
            }
          }

          // Calculate part number with finish code for extrusions
          let displayPartNumber = part.partNumber || `PRESET-${part.partName.replace(/\s+/g, '-').toUpperCase()}`
          if (part.partType === 'Extrusion' && opening.finishColor && masterPart?.addFinishToPartNumber) {
            const finishCode = await getFinishCode(opening.finishColor)
            displayPartNumber = `${displayPartNumber}${finishCode}`
          }

          bomItems.push({
            openingName: opening.name,
            panelId: 0, // Preset parts are at opening level, not panel level
            productName: 'Preset Parts',
            panelWidth: opening.finishedWidth || opening.roughWidth,
            panelHeight: opening.finishedHeight || opening.roughHeight,
            partNumber: displayPartNumber,
            partName: part.partName,
            partType: part.partType || 'Hardware',
            quantity: part.formula ? 1 : (instance.calculatedQuantity || 1),
            unit: partUnit,
            description: part.description || 'From preset configuration',
            stockLength: stockLength,
            cutLength: cutLength,
            color: (part.partType === 'Extrusion' && opening.finishColor) ? opening.finishColor : 'N/A',
            addToPackingList: masterPart?.addToPackingList ?? true,
            isLinkedPart: false,
            pickListStation: masterPart?.pickListStation || null,
            includeInJambKit: masterPart?.includeInJambKit ?? false,
            isMilled: part.isMilled || false,
            binLocation: masterPart?.binLocationId || null,
            isPresetPart: true
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
          const typeOrder = { 'Extrusion': 1, 'CutStock': 2, 'Hardware': 3, 'Glass': 4, 'Option': 5 }
          const aOrder = typeOrder[a.partType as keyof typeof typeOrder] || 5
          const bOrder = typeOrder[b.partType as keyof typeof typeOrder] || 5

          return aOrder - bOrder
        })
      })
    })

    // Build stock length options map for yield-based optimization
    // This needs to happen BEFORE filtering so all cuts are considered
    const stockLengthOptionsMap: Record<string, number[]> = {}
    for (const item of bomItems) {
      if ((item.partType === 'Extrusion' || item.partType === 'CutStock') &&
          item.basePartNumber && item.stockLengthOptions && item.stockLengthOptions.length > 1) {
        if (!stockLengthOptionsMap[item.basePartNumber]) {
          stockLengthOptionsMap[item.basePartNumber] = []
        }
        // Merge in any new stock length options
        for (const sl of item.stockLengthOptions) {
          if (!stockLengthOptionsMap[item.basePartNumber].includes(sl)) {
            stockLengthOptionsMap[item.basePartNumber].push(sl)
          }
        }
      }
    }

    // Apply yield optimization to BOM items BEFORE filtering
    // This ensures consistent stock lengths across all views (summary, cutlist, etc.)
    const optimizedBomItems = applyYieldOptimizationToBomItems(bomItems, stockLengthOptionsMap)

    // Filter by openings if specified
    let filteredBomItems = optimizedBomItems
    if (openingsFilter) {
      const selectedOpenings = new Set(openingsFilter.split(',').map(o => o.trim()))
      filteredBomItems = optimizedBomItems.filter(item => selectedOpenings.has(item.openingName))
    }

    // If summary mode is requested, return aggregated data
    if (summary) {
      const summaryItems = aggregateBomItems(filteredBomItems, stockLengthOptionsMap)

      // Calculate totals by type
      const totals = {
        totalParts: summaryItems.reduce((sum, item) => sum + item.totalQuantity, 0),
        totalExtrusions: summaryItems.filter(item => item.partType === 'Extrusion').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalCutStock: summaryItems.filter(item => item.partType === 'CutStock').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalHardware: summaryItems.filter(item => item.partType === 'Hardware').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalGlass: summaryItems.filter(item => item.partType === 'Glass').reduce((sum, item) => sum + item.totalQuantity, 0),
        totalOptions: summaryItems.filter(item => item.partType === 'Option').reduce((sum, item) => sum + item.totalQuantity, 0),
        // Total optimized stock pieces to order for all extrusions and CutStock
        totalStockPiecesToOrder: summaryItems
          .filter(item => (item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null)
          .reduce((sum, item) => sum + (item.stockPiecesNeeded ?? 0), 0)
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
      const regularBomItems = filteredBomItems.filter(item => !item.isMiscellaneous)
      const miscBomItems = filteredBomItems.filter(item => item.isMiscellaneous)

      let cutListItems = aggregateCutListItems(regularBomItems)

      // Create miscellaneous cut list (aggregated by part number and cut length)
      const miscCutListMap: Record<string, any> = {}
      for (const item of miscBomItems) {
        if (item.partType !== 'Extrusion') continue
        const cutLengthKey = item.cutLength ? item.cutLength.toFixed(3) : 'none'
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

      // If PDF format requested, return as PDF file download
      if (format === 'pdf') {
        console.log('[CutList PDF] Generating PDF for project:', project.name, 'with', batchedCutListItems.length, 'items')
        const companyLogo = await getCompanyLogo()

        // Group cut list items by product + size for PDF sections
        const groupMap = new Map<string, CutListPdfGroup>()
        for (const item of batchedCutListItems) {
          const key = `${item.productName || ''}|${item.sizeKey}`
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              productName: item.productName || '',
              sizeKey: item.sizeKey,
              unitCount: item.unitCount,
              items: []
            })
          }
          groupMap.get(key)!.items.push({
            partNumber: item.partNumber,
            partName: item.partName || '',
            cutLength: item.cutLength ?? null,
            qtyPerUnit: item.qtyPerUnit,
            totalQty: item.totalQty,
            isMilled: item.isMilled,
            binLocation: item.binLocation ?? null,
            stockLength: item.stockLength ?? null,
            color: item.color
          })
        }

        // Build remainder items for PDF if applicable
        let pdfRemainderItems: CutListPdfItem[] | undefined
        if (remainder > 0 && remainderItems && remainderItems.length > 0) {
          pdfRemainderItems = remainderItems.map(item => ({
            partNumber: item.partNumber,
            partName: item.partName || '',
            cutLength: item.cutLength ?? null,
            qtyPerUnit: item.qtyPerUnit,
            totalQty: item.totalQty,
            isMilled: item.isMilled,
            binLocation: item.binLocation ?? null,
            stockLength: item.stockLength ?? null,
            color: item.color
          }))
        }

        const pdfBuffer = await createCutListPDF({
          projectName: project.name,
          customerName: project.customer?.companyName,
          companyLogo,
          groups: Array.from(groupMap.values()),
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          batchSize: batchSize,
          totalUnits: originalUnitCount || batchedCutListItems[0]?.unitCount || 1,
          remainder: remainder,
          remainderItems: pdfRemainderItems
        })

        const productSuffix = productFilter ? `-${productFilter.replace(/\s+/g, '-')}` : ''
        const sizeSuffix = sizeFilter ? `-${sizeFilter}` : ''
        const batchSuffix = (productFilter || sizeFilter) ? `-${batchSize}units` : ''
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}${productSuffix}${sizeSuffix}${batchSuffix}-cutlist.pdf`

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
        const companyLogo = await getCompanyLogo()
        const pdfData = {
          projectName: project.name,
          customerName: project.customer?.companyName,
          companyLogo,
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

    // If picklist mode is requested, return pick list data (items with pickListStation set)
    if (picklist) {
      // Filter to items with pickListStation set (Hardware, Extrusion, Fastener, or linked parts)
      const pickListItems = filteredBomItems.filter(item =>
        (item.partType === 'Hardware' || item.partType === 'Extrusion' || item.partType === 'Fastener' || item.isLinkedPart === true) &&
        item.pickListStation !== null && item.pickListStation !== undefined
      )

      // Group by station (Jamb Station, Assembly)
      const groupedByStation: Record<string, any[]> = {}
      for (const item of pickListItems) {
        const stationKey = item.pickListStation
        if (!groupedByStation[stationKey]) {
          groupedByStation[stationKey] = []
        }
        groupedByStation[stationKey].push(item)
      }

      // Aggregate items within each station group by part number
      const aggregatedPickList: any[] = []
      for (const [station, items] of Object.entries(groupedByStation)) {
        const aggregatedByPart: Record<string, any> = {}
        for (const item of items) {
          const key = item.partNumber
          if (!aggregatedByPart[key]) {
            aggregatedByPart[key] = {
              station: station,
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

      // Sort by station (Jamb Station first, then Assembly), then by part number
      const stationOrder: Record<string, number> = { 'Jamb Station': 1, 'Assembly': 2 }
      aggregatedPickList.sort((a, b) => {
        const stationA = stationOrder[a.station] || 99
        const stationB = stationOrder[b.station] || 99
        if (stationA !== stationB) {
          return stationA - stationB
        }
        return a.partNumber.localeCompare(b.partNumber)
      })

      // Get unique stations for grouping info (in order: Jamb Station, Assembly)
      const stationGroups = Object.keys(groupedByStation).sort((a, b) => {
        return (stationOrder[a] || 99) - (stationOrder[b] || 99)
      })

      if (format === 'pdf') {
        // PDF generation will be handled by a separate utility
        const { createPickListPDF } = await import('@/lib/pick-list-pdf-generator')
        const companyLogo = await getCompanyLogo()
        const pdfBuffer = await createPickListPDF({
          projectName: project.name,
          customerName: project.customer?.companyName,
          companyLogo,
          items: aggregatedPickList,
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          batchSize: (project as any).batchSize,
          totalUnits: project.openings.length
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
        stationGroups,
        totalItems: aggregatedPickList.reduce((sum, item) => sum + item.totalQuantity, 0)
      })
    }

    // If jambkit mode is requested, return jamb kit items grouped by opening
    if (jambkit) {
      // Filter to items with includeInJambKit flag (Hardware, Extrusion, Fastener, or linked parts)
      const jambKitItems = filteredBomItems.filter(item =>
        (item.partType === 'Hardware' || item.partType === 'Extrusion' || item.partType === 'Fastener' || item.isLinkedPart === true) &&
        item.includeInJambKit === true
      )

      // Group by opening name
      const groupedByOpening: Record<string, any[]> = {}
      for (const item of jambKitItems) {
        const openingKey = item.openingName
        if (!groupedByOpening[openingKey]) {
          groupedByOpening[openingKey] = []
        }
        groupedByOpening[openingKey].push(item)
      }

      // Build the jamb kit list grouped by opening
      const jambKitList: any[] = []
      for (const [openingName, items] of Object.entries(groupedByOpening)) {
        // Aggregate items within each opening by part number
        const aggregatedByPart: Record<string, any> = {}
        for (const item of items) {
          const key = item.partNumber
          if (!aggregatedByPart[key]) {
            aggregatedByPart[key] = {
              partNumber: item.partNumber,
              partName: item.partName,
              unit: item.unit,
              totalQuantity: 0
            }
          }
          aggregatedByPart[key].totalQuantity += (item.quantity || 1)
        }

        jambKitList.push({
          openingName: openingName,
          items: Object.values(aggregatedByPart)
        })
      }

      // Sort openings alphabetically
      jambKitList.sort((a, b) => a.openingName.localeCompare(b.openingName))

      if (format === 'pdf') {
        const { createJambKitPDF } = await import('@/lib/jamb-kit-pdf-generator')
        const companyLogo = await getCompanyLogo()
        const pdfBuffer = await createJambKitPDF({
          projectName: project.name,
          customerName: project.customer?.companyName,
          companyLogo,
          openings: jambKitList,
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        })
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-jamb-kit-list.pdf`

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
        jambKitList,
        totalOpenings: jambKitList.length,
        totalItems: jambKitItems.reduce((sum, item) => sum + (item.quantity || 1), 0)
      })
    }

    // If boxlist mode is requested, return packaging items aggregated
    if (boxlist) {
      // Filter to packaging items only
      const packagingItems = filteredBomItems.filter(item =>
        item.partType === 'Packaging'
      )

      // Aggregate by part number
      const aggregatedBoxList: Record<string, { partNumber: string; partName: string; totalQuantity: number }> = {}
      for (const item of packagingItems) {
        const key = item.partNumber
        if (!aggregatedBoxList[key]) {
          aggregatedBoxList[key] = {
            partNumber: item.partNumber,
            partName: item.partName,
            totalQuantity: 0
          }
        }
        aggregatedBoxList[key].totalQuantity += (item.quantity || 1)
      }

      const boxListItems = Object.values(aggregatedBoxList).sort((a, b) =>
        a.partNumber.localeCompare(b.partNumber)
      )

      if (format === 'pdf') {
        const { createBoxListPDF } = await import('@/lib/box-list-pdf-generator')
        const companyLogo = await getCompanyLogo()
        const pdfBuffer = await createBoxListPDF({
          projectName: project.name,
          customerName: project.customer?.companyName,
          companyLogo,
          items: boxListItems,
          generatedDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        })
        const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-box-cut-list.pdf`

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
        boxListItems,
        totalItems: boxListItems.reduce((sum, item) => sum + item.totalQuantity, 0)
      })
    }

    return NextResponse.json({
      projectId,
      projectName: project.name,
      bomItems: filteredBomItems.sort((a, b) => {
        // Sort by opening name, then by part type (Extrusion, Hardware, Glass, Option)
        if (a.openingName !== b.openingName) {
          return a.openingName.localeCompare(b.openingName)
        }

        const typeOrder = { 'Extrusion': 1, 'CutStock': 2, 'Hardware': 3, 'Glass': 4, 'Option': 5 }
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
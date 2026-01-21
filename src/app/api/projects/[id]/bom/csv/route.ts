import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'

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
  if (bom.partType === 'Extrusion') {
    return Math.max(variables.width || 0, variables.height || 0)
  }

  return bom.quantity || 0
}

// Helper function to find best stock length rule based on calculated part length
function findBestStockLengthRule(rules: any[], requiredLength: number): any | null {
  const applicableRules = rules.filter(rule => {
    const matchesLength = (rule.minHeight === null || requiredLength >= rule.minHeight) &&
                         (rule.maxHeight === null || requiredLength <= rule.maxHeight)

    return rule.isActive && matchesLength
  })

  return applicableRules.sort((a, b) => {
    const aSpecificity = (a.minHeight !== null ? 1 : 0) + (a.maxHeight !== null ? 1 : 0)
    const bSpecificity = (b.minHeight !== null ? 1 : 0) + (b.maxHeight !== null ? 1 : 0)
    return bSpecificity - aSpecificity
  })[0] || null
}

// Helper function to generate a unique hash for a component configuration
function generateComponentHash(panel: any, opening: any): string {
  const componentInstance = panel.componentInstance
  return JSON.stringify({
    productId: componentInstance.product.id,
    width: panel.width,
    height: panel.height,
    glassType: panel.glassType || '',
    finishColor: opening.finishColor || '',
    subOptions: componentInstance.subOptionSelections || '{}',
    variantSelections: componentInstance.variantSelections || '{}'
  })
}

// Helper function to sanitize filename
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)
}

// Helper function to find stock length for extrusions using the formula-based approach
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
    const uniqueOnly = searchParams.get('unique') === 'true'
    const zipFormat = searchParams.get('zip') === 'true'
    const listOnly = searchParams.get('listOnly') === 'true'
    const selectedHashes = searchParams.get('selected')?.split('|').filter(Boolean) || []

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
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Return unique component list for selection UI
    if (listOnly) {
      const uniqueComponents = new Map<string, {
        hash: string,
        productName: string,
        width: number,
        height: number,
        finishColor: string,
        glassType: string,
        quantity: number,
        hardware: string[]
      }>()

      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue
          const hash = generateComponentHash(panel, opening)
          if (!uniqueComponents.has(hash)) {
            // Parse sub-option selections to get hardware names (including variant names)
            const hardware: string[] = []
            try {
              const selections = JSON.parse(panel.componentInstance.subOptionSelections || '{}')
              const variantSelections = JSON.parse(panel.componentInstance.variantSelections || '{}')
              const product = panel.componentInstance.product

              for (const [categoryId, optionId] of Object.entries(selections)) {
                // Find the category and option from productSubOptions
                const subOption = product.productSubOptions?.find(
                  (so: any) => so.category?.id === parseInt(categoryId)
                )
                if (subOption?.category) {
                  const option = subOption.category.individualOptions?.find(
                    (opt: any) => opt.id === optionId
                  )
                  if (option) {
                    let optionName = option.name
                    // Add variant suffix if option has variants
                    if (option.variants && option.variants.length > 0) {
                      const selectedVariantId = variantSelections[String(optionId)]
                      if (selectedVariantId) {
                        const selectedVariant = option.variants.find((v: any) => v.id === selectedVariantId)
                        if (selectedVariant) {
                          optionName += ` (${selectedVariant.name})`
                        }
                      } else {
                        // No explicit selection - show default variant name
                        const defaultVariant = option.variants.find((v: any) => v.isDefault)
                        if (defaultVariant) {
                          optionName += ` (${defaultVariant.name})`
                        }
                      }
                    }
                    hardware.push(optionName)
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors
            }

            uniqueComponents.set(hash, {
              hash,
              productName: panel.componentInstance.product.name,
              width: panel.width,
              height: panel.height,
              finishColor: opening.finishColor || 'Standard',
              glassType: panel.glassType || 'None',
              quantity: 0,
              hardware
            })
          }
          uniqueComponents.get(hash)!.quantity++
        }
      }

      return NextResponse.json({
        uniqueComponents: Array.from(uniqueComponents.values())
      })
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
          // Skip option-linked BOMs - these are handled in the options section below
          if (bom.optionId) continue

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

          // Calculate cut length for Hardware/Fastener parts with LF or IN units
          // This ensures items with same part number but different length formulas are kept separate
          if (bom.formula && (bom.partType === 'Hardware' || bom.partType === 'Fastener') && (bom.unit === 'LF' || bom.unit === 'IN')) {
            let calculatedLength = evaluateFormula(bom.formula, variables)
            // Convert inches to feet if unit is LF (formulas produce inches)
            if (bom.unit === 'LF' && calculatedLength !== null) {
              calculatedLength = calculatedLength / 12
            }
            cutLength = calculatedLength
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

          // Calculate % of stock used
          let percentOfStock: string = ''
          if (bom.partType === 'Extrusion' && cutLength && stockLength && stockLength > 0) {
            const percentage = (cutLength / stockLength) * 100
            percentOfStock = percentage.toFixed(1) + '%'
          }

          // Apply finish code for Hardware parts with addFinishToPartNumber flag
          if (bom.partType === 'Hardware' && fullPartNumber && bom.addFinishToPartNumber && opening.finishColor) {
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
              const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
              if (direction && direction !== 'None') {
                // Convert direction to abbreviation (first letter of each word, e.g., "Right Sliding" -> "RS")
                const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                fullPartNumber = `${fullPartNumber}-${directionCode}`
              }
            }
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
            percentOfStock: percentOfStock,
            isMilled: bom.isMilled !== false, // Default to true if not set
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
            cutLength: `${glassWidth.toFixed(3)} x ${glassHeight.toFixed(3)}`,
            percentOfStock: '',
            isMilled: true, // Glass is not milled, but default to true for consistency
            unit: 'SQ FT',
            description: panel.glassType,
            color: 'N/A'
          })
        }

        // Add product options (sub-options) to BOM - includes handles and other hardware options
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
                  let isMillFinish = false
                  let percentOfStock = ''

                  if (optionBom && optionBom.formula) {
                    // Calculate cut length using the formula from ProductBOM
                    cutLength = evaluateFormula(optionBom.formula, {
                      width: panel.width || 0,
                      height: panel.height || 0,
                      Width: panel.width || 0,
                      Height: panel.height || 0
                    })

                    // Look up stock length from MasterPart if partNumber exists
                    if (standardOption.partNumber) {
                      const stockInfo = await findStockLength(
                        standardOption.partNumber,
                        { formula: optionBom.formula, partType: 'Extrusion' },
                        { width: panel.width || 0, height: panel.height || 0 }
                      )
                      stockLength = stockInfo.stockLength
                      isMillFinish = stockInfo.isMillFinish

                      // Build full part number with finish code and stock length
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
                        percentOfStock = ((cutLength / stockLength) * 100).toFixed(1) + '%'
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

                  // Determine quantity
                  let optionQuantity = 1
                  if (optionBom?.quantityMode === 'RANGE') {
                    optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
                  } else {
                    optionQuantity = optionBom?.quantity || 1
                  }

                  bomItems.push({
                    openingName: opening.name,
                    productName: product.name,
                    panelWidth: panel.width,
                    panelHeight: panel.height,
                    partNumber: partNumber,
                    partName: standardOption.name,
                    partType: optionBom ? 'Extrusion' : 'Option',
                    quantity: optionQuantity,
                    cutLength: cutLength ? cutLength.toFixed(3) : '',
                    percentOfStock: percentOfStock,
                    isMilled: optionBom?.isMilled !== false,
                    unit: optionBom ? 'IN' : 'EA',
                    description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                    color: opening.finishColor || 'N/A'
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

                      // Build part number with finish code if applicable
                      let linkedPartNumber = linkedPart.masterPart.partNumber
                      if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                        const finishCode = await getFinishCode(opening.finishColor)
                        if (finishCode) {
                          linkedPartNumber = `${linkedPartNumber}${finishCode}`
                        }
                      }

                      // Apply direction suffix if applicable
                      if (linkedPart.masterPart.appendDirectionToPartNumber) {
                        const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                        if (direction && direction !== 'None') {
                          const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                          linkedPartNumber = `${linkedPartNumber}-${directionCode}`
                        }
                      }

                      bomItems.push({
                        openingName: opening.name,
                        productName: product.name,
                        panelWidth: panel.width,
                        panelHeight: panel.height,
                        partNumber: linkedPartNumber,
                        partName: linkedPart.masterPart.baseName,
                        partType: linkedPart.masterPart.partType || 'Hardware',
                        quantity: linkedQuantity,
                        cutLength: '',
                        percentOfStock: '',
                        isMilled: true,
                        unit: linkedPart.masterPart.unit || 'EA',
                        description: `Linked: ${standardOption.name}${linkedPart.variant ? ` (${linkedPart.variant.name})` : ''}`,
                        color: linkedPart.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A'
                      })
                    }
                  }
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
                let percentOfStock = ''

                if (optionBom && optionBom.formula) {
                  // Calculate cut length using the formula from ProductBOM
                  cutLength = evaluateFormula(optionBom.formula, {
                    width: panel.width || 0,
                    height: panel.height || 0,
                    Width: panel.width || 0,
                    Height: panel.height || 0
                  })

                  // Look up stock length from MasterPart if partNumber exists
                  if (individualOption.partNumber) {
                    const stockInfo = await findStockLength(
                      individualOption.partNumber,
                      { formula: optionBom.formula, partType: 'Extrusion' },
                      { width: panel.width || 0, height: panel.height || 0 }
                    )
                    stockLength = stockInfo.stockLength
                    isMillFinish = stockInfo.isMillFinish

                    // Build full part number with finish code and stock length
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
                      percentOfStock = ((cutLength / stockLength) * 100).toFixed(1) + '%'
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

                bomItems.push({
                  openingName: opening.name,
                  productName: product.name,
                  panelWidth: panel.width,
                  panelHeight: panel.height,
                  partNumber: partNumber,
                  partName: individualOption.name,
                  partType: optionBom ? 'Extrusion' : 'Option',
                  quantity: optionQuantity,
                  cutLength: cutLength ? cutLength.toFixed(3) : '',
                  percentOfStock: percentOfStock,
                  isMilled: optionBom?.isMilled !== false,
                  unit: optionBom ? 'IN' : 'EA',
                  description: description,
                  color: opening.finishColor || 'N/A'
                })

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

                    // Build part number with finish code if applicable
                    let linkedPartNumber = linkedPart.masterPart.partNumber
                    if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                      const finishCode = await getFinishCode(opening.finishColor)
                      if (finishCode) {
                        linkedPartNumber = `${linkedPartNumber}${finishCode}`
                      }
                    }

                    // Apply direction suffix if applicable
                    if (linkedPart.masterPart.appendDirectionToPartNumber) {
                      const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                      if (direction && direction !== 'None') {
                        const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                        linkedPartNumber = `${linkedPartNumber}-${directionCode}`
                      }
                    }

                    bomItems.push({
                      openingName: opening.name,
                      productName: product.name,
                      panelWidth: panel.width,
                      panelHeight: panel.height,
                      partNumber: linkedPartNumber,
                      partName: linkedPart.masterPart.baseName,
                      partType: linkedPart.masterPart.partType || 'Hardware',
                      quantity: linkedQuantity,
                      cutLength: '',
                      percentOfStock: '',
                      isMilled: true,
                      unit: linkedPart.masterPart.unit || 'EA',
                      description: `Linked: ${individualOption.name}${linkedPart.variant ? ` (${linkedPart.variant.name})` : ''}`,
                      color: linkedPart.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A'
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
              let percentOfStock = ''

              if (optionBom && optionBom.formula) {
                // Calculate cut length using the formula from ProductBOM
                cutLength = evaluateFormula(optionBom.formula, {
                  width: panel.width || 0,
                  height: panel.height || 0,
                  Width: panel.width || 0,
                  Height: panel.height || 0
                })

                // Look up stock length from MasterPart if partNumber exists
                if (standardOption.partNumber) {
                  const stockInfo = await findStockLength(
                    standardOption.partNumber,
                    { formula: optionBom.formula, partType: 'Extrusion' },
                    { width: panel.width || 0, height: panel.height || 0 }
                  )
                  stockLength = stockInfo.stockLength
                  isMillFinish = stockInfo.isMillFinish

                  // Build full part number with finish code and stock length
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
                    percentOfStock = ((cutLength / stockLength) * 100).toFixed(1) + '%'
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
              let optionQuantity = 1
              if (optionBom?.quantityMode === 'RANGE') {
                optionQuantity = optionBom.defaultQuantity || optionBom.minQuantity || 1
              } else {
                optionQuantity = optionBom?.quantity || 1
              }

              bomItems.push({
                openingName: opening.name,
                productName: product.name,
                panelWidth: panel.width,
                panelHeight: panel.height,
                partNumber: partNumber,
                partName: standardOption.name,
                partType: optionBom ? 'Extrusion' : 'Option',
                quantity: optionQuantity,
                cutLength: cutLength ? cutLength.toFixed(3) : '',
                percentOfStock: percentOfStock,
                isMilled: optionBom?.isMilled !== false,
                unit: optionBom ? 'IN' : 'EA',
                description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                color: opening.finishColor || 'N/A'
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

                  // Build part number with finish code if applicable
                  let linkedPartNumber = linkedPart.masterPart.partNumber
                  if (linkedPart.masterPart.addFinishToPartNumber && opening.finishColor) {
                    const finishCode = await getFinishCode(opening.finishColor)
                    if (finishCode) {
                      linkedPartNumber = `${linkedPartNumber}${finishCode}`
                    }
                  }

                  // Apply direction suffix if applicable
                  if (linkedPart.masterPart.appendDirectionToPartNumber) {
                    const direction = (panel.swingDirection && panel.swingDirection !== 'None') ? panel.swingDirection : panel.slidingDirection
                    if (direction && direction !== 'None') {
                      const directionCode = direction.replace(/-/g, ' ').split(' ').filter((w: string) => w.length > 0).map((w: string) => w.charAt(0).toUpperCase()).join('')
                      linkedPartNumber = `${linkedPartNumber}-${directionCode}`
                    }
                  }

                  bomItems.push({
                    openingName: opening.name,
                    productName: product.name,
                    panelWidth: panel.width,
                    panelHeight: panel.height,
                    partNumber: linkedPartNumber,
                    partName: linkedPart.masterPart.baseName,
                    partType: linkedPart.masterPart.partType || 'Hardware',
                    quantity: linkedQuantity,
                    cutLength: '',
                    percentOfStock: '',
                    isMilled: true,
                    unit: linkedPart.masterPart.unit || 'EA',
                    description: `Linked: ${standardOption.name}${linkedPart.variant ? ` (${linkedPart.variant.name})` : ''}`,
                    color: linkedPart.masterPart.addFinishToPartNumber ? (opening.finishColor || 'N/A') : 'N/A'
                  })
                }
              }
            }
          }
        }
      }
    }

    // Sort BOM items
    const sortedBomItems = bomItems.sort((a, b) => {
      if (a.openingName !== b.openingName) {
        return a.openingName.localeCompare(b.openingName)
      }

      const typeOrder: Record<string, number> = { 'Extrusion': 1, 'Hardware': 2, 'Glass': 3, 'Option': 4 }
      const aOrder = typeOrder[a.partType] || 5
      const bOrder = typeOrder[b.partType] || 5

      return aOrder - bOrder
    })

    // Handle ZIP format - generate ZIP with one CSV per component
    if (zipFormat) {
      const zip = new JSZip()

      // Collect all components with their panel info
      const allComponents: { panel: any, opening: any, panelIndex: number }[] = []
      for (const opening of project.openings) {
        opening.panels.forEach((panel: any, idx: number) => {
          if (panel.componentInstance) {
            allComponents.push({ panel, opening, panelIndex: idx })
          }
        })
      }

      if (uniqueOnly) {
        // Group by unique configuration
        const uniqueComponents = new Map<string, {
          panels: { panel: any, opening: any }[],
          productName: string,
          width: number,
          height: number,
          finishColor: string
        }>()

        for (const { panel, opening } of allComponents) {
          const hash = generateComponentHash(panel, opening)
          if (!uniqueComponents.has(hash)) {
            uniqueComponents.set(hash, {
              panels: [],
              productName: panel.componentInstance.product.name,
              width: panel.width,
              height: panel.height,
              finishColor: opening.finishColor || 'Standard'
            })
          }
          uniqueComponents.get(hash)!.panels.push({ panel, opening })
        }

        // Create one CSV per unique component (filtered by selected hashes if provided)
        let fileIndex = 1
        for (const [hash, componentGroup] of uniqueComponents) {
          // Skip if selectedHashes is provided and this hash is not in the list
          if (selectedHashes.length > 0 && !selectedHashes.includes(hash)) {
            continue
          }
          const quantity = componentGroup.panels.length

          // Filter BOM items for this specific component configuration
          // Glass items have color 'N/A' so exclude them from color matching
          const componentBomItems = sortedBomItems.filter(item =>
            item.productName === componentGroup.productName &&
            item.panelWidth === componentGroup.width &&
            item.panelHeight === componentGroup.height &&
            (item.partType === 'Glass' || item.color === (componentGroup.finishColor || 'N/A'))
          )

          // Remove duplicates - include cutLength to distinguish same parts with different cuts
          const seenItems = new Set<string>()
          const uniqueBomItems = componentBomItems.filter(item => {
            const key = `${item.partNumber}-${item.partName}-${item.partType}-${item.cutLength}`
            if (seenItems.has(key)) return false
            seenItems.add(key)
            return true
          })

          const headers = [
            'Product Name',
            'Qty in Project',
            'Part Number',
            'Part Name',
            'Part Type',
            'Quantity',
            'Cut Length',
            '% of Stock',
            'Milled',
            'Unit',
            'Color'
          ]

          const csvRows = [
            headers.join(','),
            ...uniqueBomItems.map(item => [
              `"${(item.productName || '').replace(/"/g, '""')}"`,
              quantity,
              `"${(item.partNumber || '').replace(/"/g, '""')}"`,
              `"${(item.partName || '').replace(/"/g, '""')}"`,
              `"${(item.partType || '').replace(/"/g, '""')}"`,
              item.quantity,
              `"${(item.cutLength || '').replace(/"/g, '""')}"`,
              `"${item.percentOfStock}"`,
              `"${item.isMilled ? 'Yes' : 'No'}"`,
              `"${item.unit}"`,
              `"${(item.color || '').replace(/"/g, '""')}"`
            ].join(','))
          ]

          const csvContent = csvRows.join('\n')
          const filename = `${sanitizeFilename(componentGroup.productName)}-${componentGroup.width}x${componentGroup.height}.csv`
          zip.file(`${String(fileIndex).padStart(2, '0')}-${filename}`, csvContent)
          fileIndex++
        }

        // If only one file, return it directly as CSV instead of ZIP
        const fileCount = fileIndex - 1
        if (fileCount === 1) {
          const singleFile = Object.values(zip.files)[0]
          const csvContent = await singleFile.async('string')
          const filename = singleFile.name.replace(/^\d+-/, '') // Remove leading number prefix
          return new NextResponse(csvContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${filename}"`
            }
          })
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
        const filenamePrefix = selectedHashes.length > 0 ? 'Selected-BOMs' : 'Unique-BOMs'
        return new NextResponse(zipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${project.name}-${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.zip"`
          }
        })
      } else {
        // Generate one CSV per individual component (all components)
        let fileIndex = 1
        for (const { panel, opening } of allComponents) {
          const product = panel.componentInstance.product

          // Filter BOM items for this specific panel
          const panelBomItems = sortedBomItems.filter(item =>
            item.openingName === opening.name &&
            item.productName === product.name &&
            item.panelWidth === panel.width &&
            item.panelHeight === panel.height
          )

          // Remove duplicates within this panel - include cutLength to distinguish same parts with different cuts
          const seenItems = new Set<string>()
          const uniquePanelBomItems = panelBomItems.filter(item => {
            const key = `${item.partNumber}-${item.partName}-${item.partType}-${item.cutLength}`
            if (seenItems.has(key)) return false
            seenItems.add(key)
            return true
          })

          const headers = [
            'Opening',
            'Product Name',
            'Part Number',
            'Part Name',
            'Part Type',
            'Quantity',
            'Cut Length',
            '% of Stock',
            'Milled',
            'Unit',
            'Color'
          ]

          const csvRows = [
            headers.join(','),
            ...uniquePanelBomItems.map(item => [
              `"${(item.openingName || '').replace(/"/g, '""')}"`,
              `"${(item.productName || '').replace(/"/g, '""')}"`,
              `"${(item.partNumber || '').replace(/"/g, '""')}"`,
              `"${(item.partName || '').replace(/"/g, '""')}"`,
              `"${(item.partType || '').replace(/"/g, '""')}"`,
              item.quantity,
              `"${(item.cutLength || '').replace(/"/g, '""')}"`,
              `"${item.percentOfStock}"`,
              `"${item.isMilled ? 'Yes' : 'No'}"`,
              `"${item.unit}"`,
              `"${(item.color || '').replace(/"/g, '""')}"`
            ].join(','))
          ]

          const csvContent = csvRows.join('\n')
          const filename = `${sanitizeFilename(opening.name)}-${sanitizeFilename(product.name)}-${panel.width}x${panel.height}.csv`
          zip.file(`${String(fileIndex).padStart(2, '0')}-${filename}`, csvContent)
          fileIndex++
        }

        // If only one file, return it directly as CSV instead of ZIP
        const fileCount = fileIndex - 1
        if (fileCount === 1) {
          const singleFile = Object.values(zip.files)[0]
          const csvContent = await singleFile.async('string')
          const filename = singleFile.name.replace(/^\d+-/, '') // Remove leading number prefix
          return new NextResponse(csvContent, {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${filename}"`
            }
          })
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
        return new NextResponse(zipBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${project.name}-All-BOMs-${new Date().toISOString().slice(0, 10)}.zip"`
          }
        })
      }
    }

    // Regular mode - generate single CSV with all BOMs
    const headers = [
      'Opening',
      'Product Name',
      'Part Number',
      'Part Name',
      'Part Type',
      'Quantity',
      'Cut Length',
      '% of Stock',
      'Milled',
      'Unit',
      'Color'
    ]

    const csvRows = [
      headers.join(','),
      ...sortedBomItems.map(item => [
        `"${(item.openingName || '').replace(/"/g, '""')}"`,
        `"${(item.productName || '').replace(/"/g, '""')}"`,
        `"${(item.partNumber || '').replace(/"/g, '""')}"`,
        `"${(item.partName || '').replace(/"/g, '""')}"`,
        `"${(item.partType || '').replace(/"/g, '""')}"`,
        item.quantity,
        `"${(item.cutLength || '').replace(/"/g, '""')}"`,
        `"${item.percentOfStock}"`,
        `"${item.isMilled ? 'Yes' : 'No'}"`,
        `"${item.unit}"`,
        `"${(item.color || '').replace(/"/g, '""')}"`
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
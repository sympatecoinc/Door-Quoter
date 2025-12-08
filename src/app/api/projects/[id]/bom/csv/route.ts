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
    subOptions: componentInstance.subOptionSelections || '{}'
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

        // Add product options (sub-options) to BOM - includes handles and other hardware options
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
                    productName: product.name,
                    panelWidth: panel.width,
                    panelHeight: panel.height,
                    partNumber: partNumber,
                    partName: standardOption.name,
                    partType: 'Option',
                    quantity: 1,
                    cutLength: '',
                    percentOfStock: '',
                    unit: 'EA',
                    description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                    color: opening.finishColor || 'N/A'
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
                  productName: product.name,
                  panelWidth: panel.width,
                  panelHeight: panel.height,
                  partNumber: partNumber,
                  partName: individualOption.name,
                  partType: 'Option',
                  quantity: 1,
                  cutLength: '',
                  percentOfStock: '',
                  unit: 'EA',
                  description: description,
                  color: opening.finishColor || 'N/A'
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
                productName: product.name,
                panelWidth: panel.width,
                panelHeight: panel.height,
                partNumber: partNumber,
                partName: standardOption.name,
                partType: 'Option',
                quantity: 1,
                cutLength: '',
                percentOfStock: '',
                unit: 'EA',
                description: `${productSubOption.category.name}: ${standardOption.name} (Standard - Included)`,
                color: opening.finishColor || 'N/A'
              })
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

    // Handle unique BOMs mode - generate ZIP with one CSV per unique component
    if (uniqueOnly) {
      // Group panels by unique configuration
      const uniqueComponents = new Map<string, {
        panels: { panel: any, opening: any }[],
        productName: string,
        width: number,
        height: number,
        finishColor: string
      }>()

      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

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
      }

      // Create ZIP with one CSV per unique component
      const zip = new JSZip()
      let componentIndex = 1

      for (const [hash, componentGroup] of uniqueComponents) {
        const quantity = componentGroup.panels.length
        const { panel: representativePanel, opening: representativeOpening } = componentGroup.panels[0]

        // Filter BOM items for this specific component configuration
        const componentBomItems = sortedBomItems.filter(item =>
          item.productName === componentGroup.productName &&
          item.panelWidth === componentGroup.width &&
          item.panelHeight === componentGroup.height &&
          item.color === (componentGroup.finishColor || 'N/A')
        )

        // Remove duplicates (take first occurrence per opening)
        const seenItems = new Set<string>()
        const uniqueBomItems = componentBomItems.filter(item => {
          const key = `${item.partNumber}-${item.partName}-${item.partType}`
          if (seenItems.has(key)) return false
          seenItems.add(key)
          return true
        })

        // Generate CSV headers with Qty in Project column
        const headers = [
          'Product Name',
          'Component Size',
          'Qty in Project',
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
          ...uniqueBomItems.map(item => [
            `"${item.productName}"`,
            `"${item.panelWidth || 0}" × ${item.panelHeight || 0}""`,
            quantity,
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
        const filename = `${sanitizeFilename(componentGroup.productName)}-${componentGroup.width}x${componentGroup.height}.csv`
        zip.file(filename, csvContent)
        componentIndex++
      }

      // Generate ZIP file
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${project.name}-Unique-BOMs-${new Date().toISOString().slice(0, 10)}.zip"`
        }
      })
    }

    // Regular mode - generate single CSV with all BOMs
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
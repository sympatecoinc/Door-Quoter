import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createQuotePDF, QuoteData } from '@/lib/quote-pdf-generator'

// Helper to get panel direction display name
// Returns the exact direction name the user selected, or empty for corners
function getDirectionDisplayName(direction: string, panelType: string): string {
  // Skip corner directions entirely
  if (panelType === 'CORNER_90') {
    return ''
  }

  // For swing and sliding doors, return the exact direction name
  if (direction === 'None' || direction === 'N/A' || !direction) {
    return ''
  }

  return direction
}

// Helper function to calculate price with category-specific markup (copied from quote route)
function calculateMarkupPrice(
  baseCost: number,
  partType: string,
  pricingMode: any,
  globalMultiplier: number
): number {
  if (!pricingMode) return baseCost * globalMultiplier

  // Determine which markup to apply based on part type
  let categoryMarkup = 0

  if (partType === 'Extrusion' && pricingMode.extrusionMarkup > 0) {
    categoryMarkup = pricingMode.extrusionMarkup
  } else if (partType === 'Hardware' && pricingMode.hardwareMarkup > 0) {
    categoryMarkup = pricingMode.hardwareMarkup
  } else if (partType === 'Glass' && pricingMode.glassMarkup > 0) {
    categoryMarkup = pricingMode.glassMarkup
  } else if (partType === 'Packaging' && pricingMode.packagingMarkup > 0) {
    categoryMarkup = pricingMode.packagingMarkup
  } else if (pricingMode.markup > 0) {
    // Fallback to global markup if category-specific markup is not set
    categoryMarkup = pricingMode.markup
  }

  // Apply category markup
  let price = baseCost * (1 + categoryMarkup / 100)

  // Apply discount if set
  if (pricingMode.discount > 0) {
    price *= (1 - pricingMode.discount / 100)
  }

  return price
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Fetch project data with all related openings and components
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pricingMode: true,
        quoteAttachments: {
          orderBy: { displayOrder: 'asc' }
        },
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              orderBy: { displayOrder: 'asc' },
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: true
                              }
                            }
                          }
                        },
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

    // Store pricing mode for later use
    const pricingMode = project.pricingMode

    // Calculate global pricing multiplier
    let globalPricingMultiplier = 1.0
    if (pricingMode) {
      if (pricingMode.markup > 0) {
        globalPricingMultiplier += (pricingMode.markup / 100)
      }
      if (pricingMode.discount > 0) {
        globalPricingMultiplier *= (1 - (pricingMode.discount / 100))
      }
    }

    // Generate quote data for each opening (same logic as quote route)
    const quoteItems = await Promise.all(
      project.openings.map(async (opening) => {
        // Get all product elevation images from all panels
        const elevationImages: string[] = []
        for (const panel of opening.panels) {
          if (panel.componentInstance?.product?.elevationImageData) {
            elevationImages.push(panel.componentInstance.product.elevationImageData)
          }
        }

        // Calculate opening dimensions
        const totalWidth = opening.panels.reduce((sum, panel) => sum + panel.width, 0)
        const maxHeight = Math.max(...opening.panels.map(panel => panel.height), 0)

        // Get hardware and glass types
        const hardwareItems: Array<{name: string, price: number, isIncluded: boolean, isStandard: boolean}> = []
        const glassTypes = new Set<string>()
        let totalHardwarePrice = 0

        // Use stored cost breakdown from calculate-price API (accurate tracking by part type)
        const extrusionCost = (opening as any).extrusionCost || 0
        const hardwareCost = (opening as any).hardwareCost || 0
        const glassCost = (opening as any).glassCost || 0
        const packagingCost = (opening as any).packagingCost || 0
        const otherCost = (opening as any).otherCost || 0

        // Get standard option cost and HYBRID remaining cost (should NOT be marked up)
        const standardOptionCost = opening.standardOptionCost || 0
        const hybridRemainingCost = opening.hybridRemainingCost || 0

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Track glass types
          if (panel.glassType && panel.glassType !== 'N/A') {
            glassTypes.add(panel.glassType)
          }

          // Extract hardware from component options for display
          if (panel.componentInstance?.subOptionSelections) {
            try {
              const selections = JSON.parse(panel.componentInstance.subOptionSelections)
              const includedOptions = JSON.parse(panel.componentInstance.includedOptions || '[]')

              for (const [categoryId, optionId] of Object.entries(selections)) {
                if (optionId) {
                  for (const pso of product.productSubOptions || []) {
                    if (String(pso.category.id) === String(categoryId)) {
                      const categoryName = pso.category.name.toLowerCase()
                      if (categoryName.includes('hardware') || categoryName.includes('handle') ||
                          categoryName.includes('lock') || categoryName.includes('hinge')) {
                        for (const option of pso.category.individualOptions) {
                          if (option.id === optionId) {
                            const isIncluded = includedOptions.includes(Number(optionId))
                            const isStandardOption = pso.standardOptionId === option.id
                            // Display price for non-standard options
                            const optionPrice = isIncluded ? 0 : (isStandardOption ? 0 : (option.price || 0))
                            hardwareItems.push({
                              name: `${pso.category.name}: ${option.name}`,
                              price: optionPrice,
                              isIncluded: isIncluded,
                              isStandard: isStandardOption
                            })
                            if (!isStandardOption) {
                              totalHardwarePrice += optionPrice
                            }
                            break
                          }
                        }
                      }
                      break
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error parsing hardware options:', error)
            }
          }
        }

        // Apply category-specific markups to each cost component
        // IMPORTANT: For HYBRID pricing, subtract hybridRemainingCost from extrusion before markup
        // The hybridRemainingCost is part of extrusionCost but should NOT receive markup
        const extrusionCostForMarkup = extrusionCost - hybridRemainingCost
        const markedUpExtrusionCost = calculateMarkupPrice(extrusionCostForMarkup, 'Extrusion', pricingMode, globalPricingMultiplier)
        const markedUpHardwareCost = calculateMarkupPrice(hardwareCost, 'Hardware', pricingMode, globalPricingMultiplier)
        const markedUpGlassCost = calculateMarkupPrice(glassCost, 'Glass', pricingMode, globalPricingMultiplier)
        const markedUpPackagingCost = calculateMarkupPrice(packagingCost, 'Packaging', pricingMode, globalPricingMultiplier)
        const markedUpOtherCost = calculateMarkupPrice(otherCost, 'Other', pricingMode, globalPricingMultiplier)

        // Add back standard option costs and HYBRID remaining costs WITHOUT markup
        const markedUpPrice = markedUpExtrusionCost + markedUpHardwareCost + markedUpGlassCost + markedUpPackagingCost + markedUpOtherCost + standardOptionCost + hybridRemainingCost

        // Generate description
        const panelTypes = opening.panels
          .filter(p => p.componentInstance)
          .map(p => p.componentInstance!.product.productType)

        const typeCount = panelTypes.reduce((acc, type) => {
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const description = Object.entries(typeCount)
          .map(([type, count]) => {
            const displayType = type === 'SWING_DOOR' ? 'Swing Door' :
                              type === 'SLIDING_DOOR' ? 'Sliding Door' :
                              type === 'FIXED_PANEL' ? 'Fixed Panel' :
                              type === 'CORNER_90' ? '90° Corner' : type
            return count > 1 ? `${count} ${displayType}s` : `${count} ${displayType}`
          })
          .join(', ')

        // Extract opening directions from panels
        const openingDirections: string[] = []
        for (const panel of opening.panels) {
          if (panel.componentInstance) {
            const productType = panel.componentInstance.product.productType

            let direction = ''
            if (productType === 'SWING_DOOR' && panel.swingDirection) {
              direction = panel.swingDirection
            } else if (productType === 'SLIDING_DOOR' && panel.slidingDirection) {
              direction = panel.slidingDirection
            } else if (productType === 'CORNER_90' && panel.cornerDirection) {
              direction = panel.cornerDirection
            }

            if (direction && direction !== 'None' && direction !== 'N/A') {
              const displayName = getDirectionDisplayName(direction, productType)
              if (displayName) {
                openingDirections.push(displayName)
              }
            }
          }
        }

        return {
          openingId: opening.id,
          name: opening.name,
          openingDirections: openingDirections,
          description: description || 'Custom Opening',
          dimensions: `${totalWidth}" W × ${maxHeight}" H`,
          color: opening.finishColor || 'Standard',
          hardware: hardwareItems.length > 0 ? hardwareItems.map(item =>
            item.isStandard
              ? `${item.name} | STANDARD`
              : `${item.name} | +$${item.price.toLocaleString()}${item.isIncluded ? ' | INCLUDED' : ''}`
          ).join(' • ') : 'Standard',
          hardwarePrice: totalHardwarePrice,
          glassType: Array.from(glassTypes).join(', ') || 'Clear',
          costPrice: opening.price,
          price: markedUpPrice,
          elevationImages: elevationImages
        }
      })
    )

    // Calculate totals
    const subtotal = quoteItems.reduce((sum, item) => sum + item.costPrice, 0)
    const adjustedSubtotal = quoteItems.reduce((sum, item) => sum + item.price, 0)
    const markupAmount = adjustedSubtotal - subtotal

    let discountAmount = 0
    if (project.pricingMode && project.pricingMode.discount > 0) {
      const subtotalBeforeDiscount = adjustedSubtotal / (1 - (project.pricingMode.discount / 100))
      discountAmount = subtotalBeforeDiscount - adjustedSubtotal
    }

    // Calculate installation cost based on method
    let installationCost = 0

    if (project.installationMethod === 'MANUAL') {
      // Manual mode: use manually entered cost
      installationCost = project.manualInstallationCost || 0
    } else if (project.installationMethod === 'PER_PRODUCT_TOTAL') {
      // Per Product Total: sum all product installation prices
      const complexityMultipliers: Record<string, number> = {
        'SIMPLE': 0.9,
        'STANDARD': 1.0,
        'COMPLEX': 1.2,
        'VERY_COMPLEX': 1.5
      }

      const multiplier = complexityMultipliers[project.installationComplexity] || 1.0

      // Sum installation prices from all openings' products
      let productInstallationSum = 0

      for (const opening of project.openings) {
        for (const panel of opening.panels) {
          if (panel.componentInstance?.product?.installationPrice) {
            productInstallationSum += panel.componentInstance.product.installationPrice
          }
        }
      }

      installationCost = productInstallationSum * multiplier
    }

    const subtotalWithInstallation = adjustedSubtotal + installationCost

    // Apply tax to subtotal including installation
    const taxRate = project.taxRate || 0
    const taxAmount = subtotalWithInstallation * taxRate
    const totalPrice = subtotalWithInstallation + taxAmount

    // Build QuoteData object
    const quoteData: QuoteData = {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        pricingMode: project.pricingMode ? {
          name: project.pricingMode.name,
          markup: project.pricingMode.markup,
          discount: project.pricingMode.discount
        } : null
      },
      quoteItems,
      subtotal,
      markupAmount,
      discountAmount,
      adjustedSubtotal,
      installationCost,
      taxRate,
      taxAmount,
      totalPrice
    }

    // Fetch persistent quote documents
    // 1. Get all global documents
    const globalDocuments = await prisma.quoteDocument.findMany({
      where: { isGlobal: true },
      orderBy: { displayOrder: 'asc' }
    })

    // 2. Get all unique products used in this quote
    const productIds = new Set<number>()
    for (const opening of project.openings) {
      for (const panel of opening.panels) {
        if (panel.componentInstance?.productId) {
          productIds.add(panel.componentInstance.productId)
        }
      }
    }

    // 3. Get product-specific documents for those products
    const productSpecificDocuments = await prisma.quoteDocument.findMany({
      where: {
        productDocuments: {
          some: {
            productId: { in: Array.from(productIds) }
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    })

    // 4. Combine and deduplicate documents
    const documentMap = new Map()

    // Add global documents first
    for (const doc of globalDocuments) {
      documentMap.set(doc.id, {
        id: doc.id,
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        type: doc.category,
        displayOrder: doc.displayOrder,
        description: doc.description,
        isGlobal: true
      })
    }

    // Add product-specific documents (won't overwrite if already added as global)
    for (const doc of productSpecificDocuments) {
      if (!documentMap.has(doc.id)) {
        documentMap.set(doc.id, {
          id: doc.id,
          filename: doc.filename,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          type: doc.category,
          displayOrder: doc.displayOrder,
          description: doc.description,
          isGlobal: false
        })
      }
    }

    // 5. Convert to array and sort by displayOrder
    const persistentDocuments = Array.from(documentMap.values()).sort((a, b) => a.displayOrder - b.displayOrder)

    // 6. Combine and order attachments with proper positioning
    // The order should be:
    // 1. Beginning attachments (position='beginning' or legacy 'before')
    // 2. Quote page(s) with grand total (handled by createQuotePDF)
    // 3. After-quote attachments (position='after_quote' or legacy 'after' or no position)
    // 4. Persistent documents (global + product-specific)
    // 5. End attachments (position='end')

    const beginningAttachments = project.quoteAttachments
      .filter(a => a.position === 'beginning' || a.position === 'before')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const afterQuoteAttachments = project.quoteAttachments
      .filter(a => a.position === 'after_quote' || a.position === 'after' || !a.position)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const endAttachments = project.quoteAttachments
      .filter(a => a.position === 'end')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    // Combine in the correct order for PDF generation
    // Note: The PDF generator will handle the ordering based on position values
    const allAttachments = [
      ...beginningAttachments.map(a => ({ ...a, position: 'beginning' })),
      ...afterQuoteAttachments.map(a => ({ ...a, position: 'after_quote' })),
      ...persistentDocuments.map(doc => ({
        ...doc,
        isPersistent: true,
        position: 'persistent' // Special position for persistent docs (between after_quote and end)
      })),
      ...endAttachments.map(a => ({ ...a, position: 'end' }))
    ]

    // Generate PDF with all attachments (now returns Buffer directly)
    const pdfBuffer = await createQuotePDF(quoteData, allAttachments as any)

    const filename = `Quote_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error generating quote PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote PDF' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createQuotePDF, QuoteData } from '@/lib/quote-pdf-generator'

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
        const hardwareItems: Array<{name: string, price: number, isIncluded: boolean}> = []
        const glassTypes = new Set<string>()
        let totalHardwarePrice = 0

        // Calculate cost breakdown
        let extrusionCost = 0
        let hardwareCost = 0
        let glassCost = 0
        let otherCost = 0

        const bomCounts = { Extrusion: 0, Hardware: 0, Glass: 0, Other: 0 }

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Count BOMs by type
          for (const bom of product.productBOMs || []) {
            if (bom.partType === 'Extrusion') {
              bomCounts.Extrusion++
            } else if (bom.partType === 'Hardware') {
              bomCounts.Hardware++
            } else if (bom.partType === 'Glass') {
              bomCounts.Glass++
            } else {
              bomCounts.Other++
            }
          }

          // Track glass types
          if (panel.glassType && panel.glassType !== 'N/A') {
            glassTypes.add(panel.glassType)
          }

          // Extract hardware from component options
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
                            hardwareItems.push({
                              name: `${pso.category.name}: ${option.name}`,
                              price: option.price || 0,
                              isIncluded: isIncluded
                            })
                            totalHardwarePrice += option.price || 0
                            hardwareCost += option.price || 0
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

        // Distribute the opening base cost based on BOM counts
        const totalBOMCount = bomCounts.Extrusion + bomCounts.Hardware + bomCounts.Glass + bomCounts.Other
        const remainingCost = opening.price - hardwareCost

        if (totalBOMCount > 0 && remainingCost > 0) {
          extrusionCost += (remainingCost * bomCounts.Extrusion) / totalBOMCount
          hardwareCost += (remainingCost * bomCounts.Hardware) / totalBOMCount
          glassCost += (remainingCost * bomCounts.Glass) / totalBOMCount
          otherCost += (remainingCost * bomCounts.Other) / totalBOMCount
        }

        // Apply category-specific markups
        const markedUpExtrusionCost = calculateMarkupPrice(extrusionCost, 'Extrusion', pricingMode, globalPricingMultiplier)
        const markedUpHardwareCost = calculateMarkupPrice(hardwareCost, 'Hardware', pricingMode, globalPricingMultiplier)
        const markedUpGlassCost = calculateMarkupPrice(glassCost, 'Glass', pricingMode, globalPricingMultiplier)
        const markedUpOtherCost = calculateMarkupPrice(otherCost, 'Other', pricingMode, globalPricingMultiplier)

        const markedUpPrice = markedUpExtrusionCost + markedUpHardwareCost + markedUpGlassCost + markedUpOtherCost

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

        return {
          openingId: opening.id,
          name: opening.name,
          description: description || 'Custom Opening',
          dimensions: `${totalWidth}" W × ${maxHeight}" H`,
          color: opening.finishColor || 'Standard',
          hardware: hardwareItems.length > 0 ? hardwareItems.map(item => `${item.name} | +$${item.price.toLocaleString()}${item.isIncluded ? ' | STANDARD' : ''}`).join(' • ') : 'Standard',
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
    // 1. Quote page(s) with grand total (handled by createQuotePDF)
    // 2. Custom attachments with position='before'
    // 3. Custom attachments with position='after' (default for existing records)
    // 4. Persistent documents (global + product-specific)

    const beforeAttachments = project.quoteAttachments
      .filter(a => a.position === 'before')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const afterAttachments = project.quoteAttachments
      .filter(a => a.position !== 'before') // Default to 'after' for existing records
      .sort((a, b) => a.displayOrder - b.displayOrder)

    // Combine in the correct order for PDF generation
    const allAttachments = [
      ...beforeAttachments,
      ...afterAttachments,
      ...persistentDocuments.map(doc => ({
        ...doc,
        isPersistent: true
      }))
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

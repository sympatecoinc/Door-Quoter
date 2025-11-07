import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to calculate price with category-specific markup
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
        pricingMode: true, // Include pricing mode
        openings: {
          include: {
            panels: {
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
                        productBOMs: true // Include BOMs to calculate cost breakdown by part type
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

    // Store pricing mode for later use in component-specific markup calculations
    const pricingMode = project.pricingMode

    // Calculate global pricing multiplier (used only if category-specific markups are not set)
    let globalPricingMultiplier = 1.0
    if (pricingMode) {
      // Apply markup percentage (e.g., 20% markup = multiply by 1.20)
      if (pricingMode.markup > 0) {
        globalPricingMultiplier += (pricingMode.markup / 100)
      }
      // Apply discount percentage (e.g., 10% discount after markup)
      if (pricingMode.discount > 0) {
        globalPricingMultiplier *= (1 - (pricingMode.discount / 100))
      }
    }

    // Generate quote data for each opening
    const quoteItems = await Promise.all(
      project.openings.map(async (opening) => {
        // Get all product elevation images from all panels
        const elevationImages: string[] = []
        for (const panel of opening.panels) {
          if (panel.componentInstance?.product?.elevationImageData) {
            elevationImages.push(panel.componentInstance.product.elevationImageData)
          }
        }

        // Calculate opening dimensions (sum of panel widths, max height)
        const totalWidth = opening.panels.reduce((sum, panel) => sum + panel.width, 0)
        const maxHeight = Math.max(...opening.panels.map(panel => panel.height), 0)

        // Get hardware and glass types
        const hardwareItems: Array<{name: string, price: number}> = []
        const glassTypes = new Set<string>()
        let totalHardwarePrice = 0

        // Calculate cost breakdown by component type for category-specific markup
        // We need to analyze the BOMs to determine cost by part type
        let extrusionCost = 0
        let hardwareCost = 0
        let glassCost = 0
        let otherCost = 0

        // Track BOM counts by type to create a weighted distribution
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

          // Extract hardware from component options and calculate their costs
          if (panel.componentInstance?.subOptionSelections) {
            try {
              const selections = JSON.parse(panel.componentInstance.subOptionSelections)

              // Resolve hardware options
              for (const [categoryId, optionId] of Object.entries(selections)) {
                if (optionId) {
                  for (const pso of product.productSubOptions || []) {
                    if (String(pso.category.id) === String(categoryId)) {
                      const categoryName = pso.category.name.toLowerCase()
                      if (categoryName.includes('hardware') || categoryName.includes('handle') ||
                          categoryName.includes('lock') || categoryName.includes('hinge')) {
                        for (const option of pso.category.individualOptions) {
                          if (option.id === optionId) {
                            hardwareItems.push({
                              name: `${pso.category.name}: ${option.name}`,
                              price: option.price || 0
                            })
                            totalHardwarePrice += option.price || 0
                            hardwareCost += option.price || 0 // Track option costs separately
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
        // This is an approximation - ideally we'd recalculate exact costs per component
        const totalBOMCount = bomCounts.Extrusion + bomCounts.Hardware + bomCounts.Glass + bomCounts.Other
        const remainingCost = opening.price - hardwareCost // Subtract already-counted hardware options

        if (totalBOMCount > 0 && remainingCost > 0) {
          extrusionCost += (remainingCost * bomCounts.Extrusion) / totalBOMCount
          hardwareCost += (remainingCost * bomCounts.Hardware) / totalBOMCount
          glassCost += (remainingCost * bomCounts.Glass) / totalBOMCount
          otherCost += (remainingCost * bomCounts.Other) / totalBOMCount
        }

        // Apply category-specific markups to each cost component
        const markedUpExtrusionCost = calculateMarkupPrice(extrusionCost, 'Extrusion', pricingMode, globalPricingMultiplier)
        const markedUpHardwareCost = calculateMarkupPrice(hardwareCost, 'Hardware', pricingMode, globalPricingMultiplier)
        const markedUpGlassCost = calculateMarkupPrice(glassCost, 'Glass', pricingMode, globalPricingMultiplier)
        const markedUpOtherCost = calculateMarkupPrice(otherCost, 'Other', pricingMode, globalPricingMultiplier)

        // Total marked-up price with category-specific markups
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
          hardware: hardwareItems.length > 0 ? hardwareItems.map(item => `${item.name} | +$${item.price.toLocaleString()}`).join(' • ') : 'Standard',
          hardwarePrice: totalHardwarePrice,
          glassType: Array.from(glassTypes).join(', ') || 'Clear',
          costPrice: opening.price, // Internal cost (not shown to customer)
          price: markedUpPrice, // Customer-facing price with category-specific markups
          elevationImages: elevationImages,
          // Include cost breakdown for debugging/transparency (optional)
          costBreakdown: {
            extrusion: { base: extrusionCost, markedUp: markedUpExtrusionCost },
            hardware: { base: hardwareCost, markedUp: markedUpHardwareCost },
            glass: { base: glassCost, markedUp: markedUpGlassCost },
            other: { base: otherCost, markedUp: markedUpOtherCost }
          }
        }
      })
    )

    // Calculate subtotal from all marked-up opening prices
    const subtotal = quoteItems.reduce((sum, item) => sum + item.costPrice, 0)
    const adjustedSubtotal = quoteItems.reduce((sum, item) => sum + item.price, 0)

    // Calculate markup and discount amounts for display
    // With category-specific markups, the total markup is the difference between adjusted and base
    const markupAmount = adjustedSubtotal - subtotal

    // Calculate discount amount (discount is already applied in category markups)
    let discountAmount = 0
    if (project.pricingMode && project.pricingMode.discount > 0) {
      // This is approximate - the discount was applied to each category after markup
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

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        installationMethod: project.installationMethod,
        installationComplexity: project.installationComplexity,
        manualInstallationCost: project.manualInstallationCost,
        pricingMode: project.pricingMode ? {
          name: project.pricingMode.name,
          markup: project.pricingMode.markup,
          extrusionMarkup: project.pricingMode.extrusionMarkup,
          hardwareMarkup: project.pricingMode.hardwareMarkup,
          glassMarkup: project.pricingMode.glassMarkup,
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
    })
    
  } catch (error) {
    console.error('Error generating quote:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote' },
      { status: 500 }
    )
  }
}
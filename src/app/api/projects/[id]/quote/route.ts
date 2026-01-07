import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Statuses where pricing should be recalculated on quote load
// These are "pre-quote-sent" statuses where changes can still be made
const RECALCULATE_PRICING_STATUSES = ['STAGING', 'APPROVED', 'REVISE']

// Helper to convert panel directions to abbreviations
function convertDirectionToAbbreviation(direction: string, panelType: string): string {
  // Swing door directions
  if (panelType === 'SWING_DOOR') {
    const swingAbbreviations: Record<string, string> = {
      // Full names
      'Left In': 'ILH',
      'Right In': 'IRH',
      'Left Out': 'LH',
      'Right Out': 'RH',
      // Already abbreviated (from legacy data or plan views)
      'ILH': 'ILH',
      'IRH': 'IRH',
      'LH': 'LH',
      'RH': 'RH',
      'None': '',
      'N/A': ''
    }
    // Return match or the original direction as fallback (for custom plan view names)
    return swingAbbreviations[direction] ?? direction
  }

  // Sliding door directions
  if (panelType === 'SLIDING_DOOR') {
    const slidingAbbreviations: Record<string, string> = {
      // Full names
      'Left': 'SL',
      'Right': 'SR',
      // Already abbreviated
      'SL': 'SL',
      'SR': 'SR',
      'None': '',
      'N/A': ''
    }
    return slidingAbbreviations[direction] ?? direction
  }

  // Corner directions
  if (panelType === 'CORNER_90') {
    const cornerAbbreviations: Record<string, string> = {
      'Up': 'CU',
      'Down': 'CD',
      'CU': 'CU',
      'CD': 'CD',
      'None': '',
      'N/A': ''
    }
    return cornerAbbreviations[direction] ?? direction
  }

  return direction || ''
}

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

    // Fetch all available pricing modes for the dropdown
    const availablePricingModes = await prisma.pricingMode.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    // Fetch project data with all related openings and components
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pricingMode: true, // Include pricing mode
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

    // Recalculate pricing for all openings if project is in a pre-quote-sent status
    // This ensures pricing rules changes are reflected when viewing the quote
    if (RECALCULATE_PRICING_STATUSES.includes(project.status)) {
      // Get the base URL for internal API calls
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const host = request.headers.get('host') || 'localhost:3000'
      const baseUrl = `${protocol}://${host}`

      // Forward cookies from the original request for authentication
      const cookieHeader = request.headers.get('cookie') || ''

      // Recalculate price for each opening
      const recalculationPromises = project.openings.map(async (opening) => {
        try {
          const response = await fetch(`${baseUrl}/api/openings/${opening.id}/calculate-price`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieHeader
            }
          })
          if (response.ok) {
            const data = await response.json()
            // Update the opening object with the new price and cost breakdown for use in this request
            ;(opening as any).price = data.calculatedPrice
            ;(opening as any).standardOptionCost = data.breakdown?.totalStandardOptionCost || 0
            ;(opening as any).hybridRemainingCost = data.breakdown?.totalHybridRemainingCost || 0
            ;(opening as any).extrusionCost = data.breakdown?.totalExtrusionCost || 0
            ;(opening as any).hardwareCost = data.breakdown?.totalHardwareCost || 0
            ;(opening as any).glassCost = data.breakdown?.totalGlassCost || 0
            ;(opening as any).packagingCost = data.breakdown?.totalPackagingCost || 0
            ;(opening as any).otherCost = data.breakdown?.totalOtherCost || 0
          } else {
            console.error(`Failed to recalculate price for opening ${opening.id}: ${response.status}`)
          }
        } catch (error) {
          console.error(`Error recalculating price for opening ${opening.id}:`, error)
        }
      })

      await Promise.all(recalculationPromises)
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
        const hardwareItems: Array<{name: string, price: number, isIncluded: boolean, isStandard: boolean}> = []
        const glassTypes = new Set<string>()
        let totalHardwarePrice = 0

        // Use stored cost breakdown from calculate-price API (accurate tracking by part type)
        // These values are stored in the database after each price recalculation
        const extrusionCost = (opening as any).extrusionCost || 0
        const hardwareCost = (opening as any).hardwareCost || 0
        const glassCost = (opening as any).glassCost || 0
        const packagingCost = (opening as any).packagingCost || 0
        const otherCost = (opening as any).otherCost || 0

        // Get standard option cost for this opening (should NOT be marked up)
        const standardOptionCost = opening.standardOptionCost || 0
        // Get HYBRID remaining cost (extrusion portion at cost, no markup)
        const hybridRemainingCost = opening.hybridRemainingCost || 0

        for (const panel of opening.panels) {
          if (!panel.componentInstance) continue

          const product = panel.componentInstance.product

          // Track glass types for display
          if (panel.glassType && panel.glassType !== 'N/A') {
            glassTypes.add(panel.glassType)
          }

          // Extract hardware from component options for display (costs already in stored hardwareCost)
          if (panel.componentInstance?.subOptionSelections) {
            try {
              const selections = JSON.parse(panel.componentInstance.subOptionSelections)
              const includedOptions = JSON.parse(panel.componentInstance.includedOptions || '[]')

              // Resolve hardware options for display
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

                            // Calculate upgrade/downgrade price from standard for sale price display
                            let optionPrice = 0
                            if (!isIncluded && !isStandardOption) {
                              // Look up selected option cost from MasterPart
                              let selectedCost = 0
                              if (option.partNumber) {
                                const selectedMasterPart = await prisma.masterPart.findUnique({
                                  where: { partNumber: option.partNumber },
                                  select: { cost: true }
                                })
                                selectedCost = selectedMasterPart?.cost ?? 0
                              }

                              // Look up standard option cost from MasterPart
                              let standardCost = 0
                              const standardOption = pso.category.individualOptions.find(
                                (io: any) => io.id === pso.standardOptionId
                              )
                              if (standardOption?.partNumber) {
                                const standardMasterPart = await prisma.masterPart.findUnique({
                                  where: { partNumber: standardOption.partNumber },
                                  select: { cost: true }
                                })
                                standardCost = standardMasterPart?.cost ?? 0
                              }

                              // Sale price = difference from standard (upgrade/downgrade)
                              optionPrice = selectedCost - standardCost
                            }

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
        // IMPORTANT: Standard hardware costs should NOT be marked up - subtract before markup
        // standardOptionCost is included in hardwareCost but should be added at cost only
        const hardwareCostForMarkup = hardwareCost - standardOptionCost
        const markedUpExtrusionCost = calculateMarkupPrice(extrusionCostForMarkup, 'Extrusion', pricingMode, globalPricingMultiplier)
        const markedUpHardwareCost = calculateMarkupPrice(hardwareCostForMarkup, 'Hardware', pricingMode, globalPricingMultiplier)
        const markedUpGlassCost = calculateMarkupPrice(glassCost, 'Glass', pricingMode, globalPricingMultiplier)
        const markedUpPackagingCost = calculateMarkupPrice(packagingCost, 'Packaging', pricingMode, globalPricingMultiplier)
        const markedUpOtherCost = calculateMarkupPrice(otherCost, 'Other', pricingMode, globalPricingMultiplier)

        // Total marked-up price with category-specific markups
        // HYBRID remaining costs are added back WITHOUT markup (at cost)
        // Standard hardware costs are added back WITHOUT markup (at cost)
        const markedUpPrice = markedUpExtrusionCost + markedUpHardwareCost + markedUpGlassCost + markedUpPackagingCost + markedUpOtherCost + hybridRemainingCost + standardOptionCost

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

            // Get the appropriate direction based on panel type
            let direction = ''
            if (productType === 'SWING_DOOR' && panel.swingDirection) {
              direction = panel.swingDirection
            } else if (productType === 'SLIDING_DOOR' && panel.slidingDirection) {
              direction = panel.slidingDirection
            } else if (productType === 'CORNER_90' && panel.cornerDirection) {
              direction = panel.cornerDirection
            }

            // Convert to abbreviation if direction exists and is not None/N/A
            if (direction && direction !== 'None' && direction !== 'N/A') {
              const abbreviated = convertDirectionToAbbreviation(direction, productType)
              if (abbreviated) {
                openingDirections.push(abbreviated)
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
          costPrice: opening.price, // Internal cost (not shown to customer)
          price: markedUpPrice, // Customer-facing price with category-specific markups
          elevationImages: elevationImages,
          // Include cost breakdown for debugging/transparency (optional)
          costBreakdown: {
            extrusion: { base: extrusionCostForMarkup, markedUp: markedUpExtrusionCost }, // Base excludes hybrid remaining
            hardware: { base: hardwareCostForMarkup, markedUp: markedUpHardwareCost }, // Base excludes standard options
            glass: { base: glassCost, markedUp: markedUpGlassCost },
            packaging: { base: packagingCost, markedUp: markedUpPackagingCost },
            other: { base: otherCost, markedUp: markedUpOtherCost },
            standardOptions: { base: standardOptionCost, markedUp: standardOptionCost }, // No markup on standard options
            hybridRemaining: { base: hybridRemainingCost, markedUp: hybridRemainingCost } // HYBRID remaining at cost (no markup)
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
        extrusionCostingMethod: project.pricingMode?.extrusionCostingMethod || project.extrusionCostingMethod,
        excludedPartNumbers: project.excludedPartNumbers,
        pricingModeId: project.pricingModeId,
        pricingMode: project.pricingMode ? {
          id: project.pricingMode.id,
          name: project.pricingMode.name,
          markup: project.pricingMode.markup,
          extrusionMarkup: project.pricingMode.extrusionMarkup,
          hardwareMarkup: project.pricingMode.hardwareMarkup,
          glassMarkup: project.pricingMode.glassMarkup,
          discount: project.pricingMode.discount,
          extrusionCostingMethod: project.pricingMode.extrusionCostingMethod
        } : null
      },
      availablePricingModes: availablePricingModes.map(mode => ({
        id: mode.id,
        name: mode.name,
        description: mode.description,
        isDefault: mode.isDefault,
        extrusionCostingMethod: mode.extrusionCostingMethod
      })),
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
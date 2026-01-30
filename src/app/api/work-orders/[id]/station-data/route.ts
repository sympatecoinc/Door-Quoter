import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WorkOrderStage } from '@prisma/client'

// GET /api/work-orders/[id]/station-data - Get station-specific data for a work order
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workOrderId } = await context.params
    const { searchParams } = new URL(request.url)
    const station = searchParams.get('station')?.toUpperCase() as WorkOrderStage | undefined

    // Get work order with full details
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            productionColor: true,
            customer: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                phone: true
              }
            },
            shippingAddress: true,
            shippingCity: true,
            shippingState: true,
            shippingZipCode: true,
            shipDate: true,
            dueDate: true
          }
        },
        items: {
          include: {
            completedBy: {
              select: { id: true, name: true }
            },
            receivedBy: {
              select: { id: true, name: true }
            },
            startedBy: {
              select: { id: true, name: true }
            }
          }
        },
        stageHistory: {
          orderBy: { enteredAt: 'desc' },
          include: {
            enteredBy: {
              select: { id: true, name: true }
            },
            exitedBy: {
              select: { id: true, name: true }
            },
            startedBy: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Get current stage history (active one)
    const currentStageHistory = workOrder.stageHistory.find(h => !h.exitedAt)

    // Calculate item progress
    const totalItems = workOrder.items.length
    const completedItems = workOrder.items.filter(i => i.isCompleted).length
    const receivedItems = workOrder.items.filter(i => i.isReceived).length

    // Group items by type for station-specific views
    const itemsByType = workOrder.items.reduce((acc, item) => {
      const type = item.partType || 'Other'
      if (!acc[type]) acc[type] = []
      acc[type].push(item)
      return acc
    }, {} as Record<string, typeof workOrder.items>)

    // Group items by opening
    const itemsByOpening = workOrder.items.reduce((acc, item) => {
      const opening = item.openingName || 'Unassigned'
      if (!acc[opening]) acc[opening] = []
      acc[opening].push(item)
      return acc
    }, {} as Record<string, typeof workOrder.items>)

    // Station-specific data
    let stationData: Record<string, any> = {}

    switch (station) {
      case 'STAGED':
        // Staging station: Material verification data
        // Only show extrusions, aggregated by partNumber + stockLength + finishColor
        const extrusionItems = workOrder.items.filter(i => i.partType === 'Extrusion')

        // Get unique part numbers for inventory and stock length lookup
        const partNumbers = [...new Set(extrusionItems.map(i => i.partNumber))]

        // Also get base part numbers (without finish suffix) for stock length lookup
        const basePartNumbers = [...new Set(extrusionItems.map(i => {
          // Strip finish suffix like -MF, -BL, -C2 from end
          return i.partNumber.replace(/-[A-Z][A-Z0-9]{0,2}$/, '')
        }))]
        const allPartNumbers = [...new Set([...partNumbers, ...basePartNumbers])]

        // Fetch inventory data and stock length rules for parts
        const masterParts = await prisma.masterPart.findMany({
          where: {
            partNumber: { in: allPartNumbers }
          },
          select: {
            partNumber: true,
            qtyOnHand: true,
            binLocationRef: {
              select: { code: true, name: true }
            },
            binLocationLegacy: true,
            stockLengthRules: {
              where: { isActive: true },
              select: { stockLength: true },
              orderBy: { stockLength: 'desc' },
              take: 1
            }
          }
        })

        const masterPartMap = new Map(masterParts.map(mp => [mp.partNumber, mp]))

        // Fetch opening finish colors for the project
        const openings = await prisma.opening.findMany({
          where: { projectId: workOrder.project.id },
          select: { name: true, finishColor: true }
        })
        const openingFinishMap = new Map(openings.map(o => [o.name, o.finishColor]))

        // Helper to get short color code from finish color string
        // e.g., "Black (Powder Coated)" -> "BLK", "Clear (Anodized)" -> "CLR"
        const getColorCode = (finishColor: string | null): string | null => {
          if (!finishColor) return null
          const lower = finishColor.toLowerCase()
          if (lower.includes('black')) return 'BLK'
          if (lower.includes('clear') || lower.includes('mill')) return 'CLR'
          if (lower.includes('bronze')) return 'BRZ'
          if (lower.includes('white')) return 'WHT'
          if (lower.includes('champagne')) return 'CHP'
          if (lower.includes('dark bronze')) return 'DBZ'
          // Return first 3 chars uppercase as fallback
          return finishColor.substring(0, 3).toUpperCase()
        }

        // Aggregate extrusions by partNumber + stockLength + colorCode
        interface AggregatedExtrusionItem {
          partNumber: string
          partName: string
          stockLength: number | null
          colorCode: string | null
          totalQuantity: number
          binLocation: string | null
        }

        const aggregatedExtrusions: Record<string, AggregatedExtrusionItem> = {}

        for (const item of extrusionItems) {
          // Get stock length: first from item, then from master part rules
          let stockLength = item.stockLength
          if (!stockLength) {
            // Try exact part number first
            let masterPart = masterPartMap.get(item.partNumber)
            if (!masterPart) {
              // Try base part number (without finish suffix)
              const basePartNumber = item.partNumber.replace(/-[A-Z][A-Z0-9]{0,2}$/, '')
              masterPart = masterPartMap.get(basePartNumber)
            }
            if (masterPart?.stockLengthRules?.[0]?.stockLength) {
              stockLength = masterPart.stockLengthRules[0].stockLength
            }
          }

          // Get color code: first from part number suffix, then from opening finishColor
          let colorCode: string | null = null
          const colorMatch = item.partNumber.match(/-([A-Z][A-Z0-9]{0,2})$/)
          if (colorMatch) {
            colorCode = colorMatch[1]
          } else if (item.openingName) {
            const finishColor = openingFinishMap.get(item.openingName)
            colorCode = getColorCode(finishColor || null)
          }

          const key = `${item.partNumber}|${stockLength ?? 'null'}|${colorCode ?? 'null'}`

          if (!aggregatedExtrusions[key]) {
            aggregatedExtrusions[key] = {
              partNumber: item.partNumber,
              partName: item.partName,
              stockLength,
              colorCode,
              totalQuantity: 0,
              binLocation: item.binLocation
            }
          }
          aggregatedExtrusions[key].totalQuantity += item.quantity
        }

        const aggregatedExtrusionList = Object.values(aggregatedExtrusions)
          .sort((a, b) => a.partNumber.localeCompare(b.partNumber))

        const inventoryMap = new Map(masterParts.map(mp => [mp.partNumber, mp]))

        stationData = {
          aggregatedExtrusions: aggregatedExtrusionList,
          inventory: Object.fromEntries(inventoryMap),
          extrusionCount: aggregatedExtrusionList.length
        }
        break

      case 'MILLING':
        // Milling station: Filter to items where metadata.isMilled === true
        const millingItems = workOrder.items.filter(i => {
          const meta = i.metadata as Record<string, any> | null
          return meta?.isMilled === true
        })

        // Fetch opening finish colors for program name generation
        const millingOpenings = await prisma.opening.findMany({
          where: { projectId: workOrder.project.id },
          select: { name: true, finishColor: true }
        })
        const millingFinishMap = new Map(millingOpenings.map(o => [o.name, o.finishColor]))

        // Helper to extract color code from part number suffix or opening finish color
        const extractColorCode = (partNumber: string, openingName: string | null): string => {
          // First check part number suffix (e.g., -BL, -MF, -C2)
          const colorMatch = partNumber.match(/-([A-Z][A-Z0-9]{0,2})$/)
          if (colorMatch) {
            return colorMatch[1]
          }
          // Fall back to opening finish color
          if (openingName) {
            const finishColor = millingFinishMap.get(openingName)
            if (finishColor) {
              const lower = finishColor.toLowerCase()
              if (lower.includes('black')) return 'BL'
              if (lower.includes('mill') || lower.includes('clear')) return 'MF'
              if (lower.includes('bronze')) return 'BRZ'
              if (lower.includes('white')) return 'WHT'
              if (lower.includes('champagne')) return 'CHP'
            }
          }
          return 'NA'
        }

        // Generate program name: [project-name]-[partnumber]-[color]-[cutlength]
        const generateProgramName = (projectName: string, partNumber: string, cutLength: number | null, openingName: string | null): string => {
          const sanitizedProject = projectName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
          const cutLengthStr = cutLength ? cutLength.toFixed(3) : '0.000'
          const colorCode = extractColorCode(partNumber, openingName)
          return `${sanitizedProject}-${partNumber}-${colorCode}-${cutLengthStr}`
        }

        // Add program name to each milling item
        const millingItemsWithProgram = millingItems.map(item => ({
          ...item,
          programName: generateProgramName(
            workOrder.project.name,
            item.partNumber,
            item.cutLength,
            item.openingName
          )
        }))

        // Group by stock length for organization
        const millingByStockLength = millingItemsWithProgram.reduce((acc, item) => {
          const stockLength = item.stockLength?.toString() || 'Unknown'
          if (!acc[stockLength]) acc[stockLength] = []
          acc[stockLength].push(item)
          return acc
        }, {} as Record<string, typeof millingItemsWithProgram>)

        stationData = {
          millingItems: millingItemsWithProgram,
          itemsByStockLength: millingByStockLength,
          totalParts: millingItemsWithProgram.reduce((sum, i) => sum + i.quantity, 0),
          completedParts: millingItemsWithProgram.filter(i => i.isCompleted).reduce((sum, i) => sum + i.quantity, 0)
        }
        break

      case 'CUTTING':
        // Cutting station: Cut list data with color info
        const cutListItems = workOrder.items.filter(i => i.partType === 'Extrusion')

        // Fetch opening finish colors for color display
        const cuttingOpenings = await prisma.opening.findMany({
          where: { projectId: workOrder.project.id },
          select: { name: true, finishColor: true }
        })
        const cuttingFinishMap = new Map(cuttingOpenings.map(o => [o.name, o.finishColor]))

        // Helper to get display color name from finish color or part number suffix
        const getDisplayColor = (partNumber: string, openingName: string | null): string | null => {
          // First check part number suffix
          const colorMatch = partNumber.match(/-([A-Z][A-Z0-9]{0,2})$/)
          if (colorMatch) {
            const code = colorMatch[1]
            // Map common codes to display names
            if (code === 'BL' || code === 'BLK') return 'Black'
            if (code === 'MF' || code === 'CLR') return 'Mill'
            if (code === 'BRZ') return 'Bronze'
            if (code === 'WHT') return 'White'
            if (code === 'CHP') return 'Champagne'
            if (code === 'DBZ') return 'Dark Bronze'
            return code // Return code if no mapping
          }
          // Fall back to opening finish color
          if (openingName) {
            const finishColor = cuttingFinishMap.get(openingName)
            if (finishColor) {
              // Extract color name (e.g., "Black (Powder Coated)" -> "Black")
              const match = finishColor.match(/^([^(]+)/)
              return match ? match[1].trim() : finishColor
            }
          }
          return null
        }

        // Add color to each item
        const cutListItemsWithColor = cutListItems.map(item => ({
          ...item,
          color: getDisplayColor(item.partNumber, item.openingName)
        }))

        // Group by stock length for bundling
        const itemsByStockLength = cutListItemsWithColor.reduce((acc, item) => {
          const stockLength = item.stockLength?.toString() || 'Unknown'
          if (!acc[stockLength]) acc[stockLength] = []
          acc[stockLength].push(item)
          return acc
        }, {} as Record<string, typeof cutListItemsWithColor>)

        stationData = {
          cutListItems: cutListItemsWithColor,
          itemsByStockLength,
          itemsByOpening,
          totalCuts: cutListItemsWithColor.reduce((sum, i) => sum + i.quantity, 0),
          completedCuts: cutListItemsWithColor.filter(i => i.isCompleted).reduce((sum, i) => sum + i.quantity, 0)
        }
        break

      case 'ASSEMBLY':
        // Assembly station: Receiving verification + hardware pick list
        const assemblyExtrusionItems = workOrder.items.filter(i => i.partType === 'Extrusion')
        const hardwareItems = workOrder.items.filter(i => i.partType === 'Hardware')

        // Get pick list items from master parts
        const hardwarePartNumbers = [...new Set(hardwareItems.map(i => i.partNumber))]
        const pickListParts = await prisma.masterPart.findMany({
          where: {
            partNumber: { in: hardwarePartNumbers },
            pickListStation: 'Assembly'
          },
          select: {
            partNumber: true,
            baseName: true,
            binLocationRef: {
              select: { code: true, name: true }
            }
          }
        })

        const pickListPartNumbers = new Set(pickListParts.map(p => p.partNumber))
        const assemblyPickList = hardwareItems.filter(i => pickListPartNumbers.has(i.partNumber))

        stationData = {
          receiving: {
            items: assemblyExtrusionItems,
            totalItems: assemblyExtrusionItems.length,
            receivedItems: assemblyExtrusionItems.filter(i => i.isReceived).length,
            allReceived: assemblyExtrusionItems.every(i => i.isReceived)
          },
          assembly: {
            pickList: assemblyPickList,
            itemsByOpening
          }
        }
        break

      case 'QC':
        // QC station: Fetch packing list style data for verification
        // Get openings with their assembled products, hardware, and jamb kits
        const qcOpeningNames = [...new Set(workOrder.items.map(i => i.openingName).filter(Boolean))] as string[]

        const qcOpenings = await prisma.opening.findMany({
          where: {
            projectId: workOrder.project.id,
            name: { in: qcOpeningNames }
          },
          include: {
            panels: {
              where: { parentPanelId: null }, // Exclude paired/hidden panels
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: {
                          where: {
                            addToPackingList: true
                          },
                          select: {
                            partName: true,
                            partNumber: true,
                            quantity: true,
                            partType: true
                          }
                        },
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: {
                                  where: { addToPackingList: true },
                                  select: { id: true, name: true, partNumber: true }
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
              orderBy: { displayOrder: 'asc' }
            }
          },
          orderBy: { name: 'asc' }
        })

        // Format for packing list verification - include components, hardware, and jamb kits
        const packingListItems = await Promise.all(qcOpenings.map(async (opening) => {
          const components: Array<{
            type: 'component' | 'hardware' | 'jambkit'
            name: string
            partNumber?: string | null
            dimensions?: string
            quantity?: number
          }> = []

          let hasJambKit = false

          for (const panel of opening.panels) {
            // Add main component (panel)
            const productName = panel.componentInstance?.product?.name || panel.type
            components.push({
              type: 'component',
              name: productName,
              dimensions: `${panel.width}" × ${panel.height}"`
            })

            if (!panel.componentInstance?.product) continue

            // Check for jamb kit items
            const allBoms = await prisma.productBOM.findMany({
              where: { productId: panel.componentInstance.product.id },
              select: { partNumber: true }
            })
            for (const bom of allBoms) {
              if (bom.partNumber) {
                const masterPart = await prisma.masterPart.findUnique({
                  where: { partNumber: bom.partNumber },
                  select: { includeInJambKit: true }
                })
                if (masterPart?.includeInJambKit) {
                  hasJambKit = true
                  break
                }
              }
            }

            // Add hardware from productBOMs (items marked for packing list)
            for (const bom of panel.componentInstance.product.productBOMs || []) {
              components.push({
                type: 'hardware',
                name: bom.partName,
                partNumber: bom.partNumber,
                quantity: bom.quantity || 1
              })
            }

            // Add selected options that are marked for packing list
            if (panel.componentInstance.subOptionSelections) {
              try {
                const selections = JSON.parse(panel.componentInstance.subOptionSelections)
                for (const [categoryIdStr, optionId] of Object.entries(selections)) {
                  if (!optionId) continue
                  const categoryId = parseInt(categoryIdStr)
                  const productSubOption = panel.componentInstance.product.productSubOptions?.find(
                    (pso: any) => pso.category.id === categoryId
                  )
                  if (!productSubOption) continue
                  const selectedOption = productSubOption.category.individualOptions?.find(
                    (opt: any) => opt.id === Number(optionId)
                  )
                  if (selectedOption) {
                    components.push({
                      type: 'hardware',
                      name: selectedOption.name,
                      partNumber: selectedOption.partNumber
                    })
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }

          // Add jamb kit as single line item if present
          if (hasJambKit) {
            components.push({
              type: 'jambkit',
              name: 'Jamb Kit'
            })
          }

          return {
            openingId: opening.id,
            openingName: opening.name,
            width: opening.finishedWidth ?? opening.roughWidth,
            height: opening.finishedHeight ?? opening.roughHeight,
            components
          }
        }))

        stationData = {
          packingListItems
        }
        break

      case 'SHIP':
        // Shipping station: Packing list and hardware pick list
        const shipOpeningNames = [...new Set(workOrder.items.map(i => i.openingName).filter(Boolean))] as string[]

        const shipOpenings = await prisma.opening.findMany({
          where: {
            projectId: workOrder.project.id,
            name: { in: shipOpeningNames }
          },
          include: {
            panels: {
              where: { parentPanelId: null },
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: {
                          where: { addToPackingList: true },
                          select: { partName: true, partNumber: true, quantity: true, partType: true }
                        },
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: {
                                  where: { addToPackingList: true },
                                  select: { id: true, name: true, partNumber: true }
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
              orderBy: { displayOrder: 'asc' }
            }
          },
          orderBy: { name: 'asc' }
        })

        // Build packing list and hardware pick list
        const shipPackingList: Array<{
          openingId: number
          openingName: string
          components: Array<{ type: string; name: string; dimensions?: string }>
        }> = []

        const hardwarePickList: Array<{
          partNumber: string | null
          partName: string
          openingName: string
          quantity: number
        }> = []

        for (const opening of shipOpenings) {
          const openingComponents: Array<{ type: string; name: string; dimensions?: string }> = []

          for (const panel of opening.panels) {
            const productName = panel.componentInstance?.product?.name || panel.type
            openingComponents.push({
              type: 'component',
              name: productName,
              dimensions: `${panel.width}" × ${panel.height}"`
            })

            if (!panel.componentInstance?.product) continue

            // Add hardware from productBOMs to both lists
            for (const bom of panel.componentInstance.product.productBOMs || []) {
              openingComponents.push({
                type: 'hardware',
                name: bom.partName
              })
              hardwarePickList.push({
                partNumber: bom.partNumber,
                partName: bom.partName,
                openingName: opening.name,
                quantity: bom.quantity || 1
              })
            }

            // Add selected options
            if (panel.componentInstance.subOptionSelections) {
              try {
                const selections = JSON.parse(panel.componentInstance.subOptionSelections)
                for (const [categoryIdStr, optionId] of Object.entries(selections)) {
                  if (!optionId) continue
                  const categoryId = parseInt(categoryIdStr)
                  const productSubOption = panel.componentInstance.product.productSubOptions?.find(
                    (pso: any) => pso.category.id === categoryId
                  )
                  if (!productSubOption) continue
                  const selectedOption = productSubOption.category.individualOptions?.find(
                    (opt: any) => opt.id === Number(optionId)
                  )
                  if (selectedOption) {
                    openingComponents.push({
                      type: 'hardware',
                      name: selectedOption.name
                    })
                    hardwarePickList.push({
                      partNumber: selectedOption.partNumber,
                      partName: selectedOption.name,
                      openingName: opening.name,
                      quantity: 1
                    })
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }

            // Check for jamb kit
            const allBoms = await prisma.productBOM.findMany({
              where: { productId: panel.componentInstance.product.id },
              select: { partNumber: true }
            })
            for (const bom of allBoms) {
              if (bom.partNumber) {
                const masterPart = await prisma.masterPart.findUnique({
                  where: { partNumber: bom.partNumber },
                  select: { includeInJambKit: true }
                })
                if (masterPart?.includeInJambKit) {
                  openingComponents.push({ type: 'jambkit', name: 'Jamb Kit' })
                  break
                }
              }
            }
          }

          shipPackingList.push({
            openingId: opening.id,
            openingName: opening.name,
            components: openingComponents
          })
        }

        // Aggregate hardware pick list by part number
        const aggregatedPickList = Object.values(
          hardwarePickList.reduce((acc, item) => {
            const key = `${item.partNumber || item.partName}`
            if (!acc[key]) {
              acc[key] = { ...item, quantity: 0, openings: [] as string[] }
            }
            acc[key].quantity += item.quantity
            if (!acc[key].openings.includes(item.openingName)) {
              acc[key].openings.push(item.openingName)
            }
            return acc
          }, {} as Record<string, any>)
        )

        stationData = {
          shippingInfo: {
            address: workOrder.project.shippingAddress,
            city: workOrder.project.shippingCity,
            state: workOrder.project.shippingState,
            zipCode: workOrder.project.shippingZipCode,
            shipDate: workOrder.project.shipDate,
            dueDate: workOrder.project.dueDate
          },
          customer: workOrder.project.customer,
          packingList: shipPackingList,
          hardwarePickList: aggregatedPickList
        }
        break
    }

    // For CUTTING station, use items with color; otherwise use original items
    const responseItems = station === 'CUTTING' && stationData.cutListItems
      ? stationData.cutListItems
      : workOrder.items

    return NextResponse.json({
      workOrder: {
        id: workOrder.id,
        batchNumber: workOrder.batchNumber,
        currentStage: workOrder.currentStage,
        priority: workOrder.priority,
        notes: workOrder.notes,
        createdAt: workOrder.createdAt,
        project: workOrder.project
      },
      currentStageHistory,
      items: responseItems,
      progress: {
        total: totalItems,
        completed: completedItems,
        received: receivedItems,
        completionPercent: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        receivingPercent: totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0
      },
      itemsByType,
      itemsByOpening,
      stageHistory: workOrder.stageHistory,
      stationData
    })
  } catch (error) {
    console.error('Error fetching station data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch station data' },
      { status: 500 }
    )
  }
}

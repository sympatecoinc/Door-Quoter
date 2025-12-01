import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Get all openings for this project with their panels and component instances
    const openings = await prisma.opening.findMany({
      where: { projectId },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: {
                  include: {
                    productBOMs: {
                      where: {
                        partType: 'Hardware',
                        addToPackingList: true
                      }
                    },
                    productSubOptions: {
                      include: {
                        category: {
                          include: {
                            individualOptions: {
                              where: {
                                addToPackingList: true
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
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Build packing list grouped by opening
    const packingList = await Promise.all(openings.map(async (opening) => {
      const components = opening.panels.map(panel => ({
        panelType: panel.type,
        width: panel.width,
        height: panel.height,
        glassType: panel.glassType,
        productName: panel.componentInstance?.product?.name || 'Unknown'
      }))

      // Get the finish code for this opening if it has a finish color
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''

      // Collect all hardware items from all panels in this opening
      // Use a Map to aggregate quantities for duplicate parts (keyed by final part number with finish)
      const hardwareMap = new Map<string, {
        partName: string
        partNumber: string | null
        description: string | null
        quantity: number
        unit: string | null
      }>()

      for (const panel of opening.panels) {
        if (!panel.componentInstance?.product) continue

        // Add hardware from productBOMs
        if (panel.componentInstance.product.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            // Apply finish code if addFinishToPartNumber is set
            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            const key = partNumber || bom.partName
            const existing = hardwareMap.get(key)

            if (existing) {
              existing.quantity += (bom.quantity || 0)
            } else {
              hardwareMap.set(key, {
                partName: bom.partName,
                partNumber: partNumber,
                description: bom.description,
                quantity: bom.quantity || 0,
                unit: bom.unit
              })
            }
          }
        }

        // Add options from IndividualOptions that have addToPackingList
        const componentInstance = panel.componentInstance
        if (componentInstance.subOptionSelections && componentInstance.product.productSubOptions) {
          try {
            const selections = JSON.parse(componentInstance.subOptionSelections)

            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              if (!optionId) continue

              const categoryId = parseInt(categoryIdStr)
              const productSubOption = componentInstance.product.productSubOptions.find(
                (pso: any) => pso.category.id === categoryId
              )

              if (!productSubOption) continue

              // Find the selected option (only if it has addToPackingList)
              const selectedOption = productSubOption.category.individualOptions?.find(
                (opt: any) => opt.id === Number(optionId) && opt.addToPackingList
              )

              if (selectedOption && selectedOption.partNumber) {
                // Apply finish code if addFinishToPartNumber is set
                let partNumber = selectedOption.partNumber
                if (selectedOption.addFinishToPartNumber && finishCode && partNumber) {
                  partNumber = `${partNumber}${finishCode}`
                }

                const key = partNumber
                const existing = hardwareMap.get(key)

                if (existing) {
                  existing.quantity += 1
                } else {
                  hardwareMap.set(key, {
                    partName: selectedOption.name,
                    partNumber: partNumber,
                    description: selectedOption.description,
                    quantity: 1,
                    unit: 'EA'
                  })
                }
              }
            }
          } catch (error) {
            console.error('Error parsing sub-option selections:', error)
          }
        }
      }

      return {
        openingId: opening.id,
        openingName: opening.name,
        components,
        hardware: Array.from(hardwareMap.values())
      }
    }))

    return NextResponse.json({ packingList })
  } catch (error) {
    console.error('Error generating packing list:', error)
    return NextResponse.json(
      { error: 'Failed to generate packing list' },
      { status: 500 }
    )
  }
}

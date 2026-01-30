import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Natural sort comparison for opening names (handles "2" before "10", "Office 1" before "Office 10")
function naturalSortCompare(a: string, b: string): number {
  const aParts = a.split(/(\d+)/)
  const bParts = b.split(/(\d+)/)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''

    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
  }
  return 0
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Get all SalesOrderParts for this project to check packed status
    const salesOrderParts = await prisma.salesOrderPart.findMany({
      where: {
        salesOrder: { projectId }
      },
      select: {
        productName: true, // Stores qrData for exact matching
        status: true,
        packedAt: true
      }
    })

    // Create a map of QR data -> packed status
    const packedStatusMap = new Map<string, { status: string; packedAt: Date | null }>()
    for (const part of salesOrderParts) {
      if (part.productName) {
        packedStatusMap.set(part.productName, {
          status: part.status,
          packedAt: part.packedAt
        })
      }
    }

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

    // Track jamb kit items per opening
    const jambKitsMap = new Map<number, { openingId: number, openingName: string, itemCount: number }>()

    // Sort openings by name using natural sort (so "2" comes before "10")
    const sortedOpenings = [...openings].sort((a, b) => naturalSortCompare(a.name || '', b.name || ''))

    // Build packing list grouped by opening
    let stickerNumber = 0
    const packingList = await Promise.all(sortedOpenings.map(async (opening) => {
      const components: Array<{
        panelType: string
        width: number
        height: number
        glassType: string | null
        productName: string
        stickerNumber: number
        status: 'pending' | 'packed'
        packedAt: string | null
      }> = []

      // Get the finish code for this opening if it has a finish color
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''

      // Track jamb kit item count for this opening
      let jambKitItemCount = 0

      // Collect all hardware items from all panels in this opening
      // Track individual items with sticker numbers for status checking
      const hardwareItems: Array<{
        partName: string
        partNumber: string | null
        description: string | null
        stickerNumber: number
        status: 'pending' | 'packed'
        packedAt: string | null
      }> = []

      for (const panel of opening.panels) {
        // Add component item with sticker number
        stickerNumber++
        const productName = panel.componentInstance?.product?.name || panel.type || 'Unknown'
        const qrData = `P${projectId}|S${stickerNumber}|${opening.name}|${productName}`
        const packedInfo = packedStatusMap.get(qrData)

        components.push({
          panelType: panel.type,
          width: panel.width,
          height: panel.height,
          glassType: panel.glassType,
          productName,
          stickerNumber,
          status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
          packedAt: packedInfo?.packedAt?.toISOString() || null
        })

        if (!panel.componentInstance?.product) continue

        // Check ALL BOM items (not just hardware) for jamb kit inclusion
        const allBoms = await prisma.productBOM.findMany({
          where: { productId: panel.componentInstance.product.id },
          select: { partNumber: true, quantity: true }
        })

        for (const bom of allBoms) {
          if (bom.partNumber) {
            const masterPart = await prisma.masterPart.findUnique({
              where: { partNumber: bom.partNumber },
              select: { includeInJambKit: true }
            })
            if (masterPart?.includeInJambKit) {
              jambKitItemCount += (bom.quantity || 1)
            }
          }
        }

        // Add hardware from productBOMs (only Hardware type with addToPackingList)
        if (panel.componentInstance.product.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            // Apply finish code if addFinishToPartNumber is set
            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            // Add individual items for each quantity (for sticker tracking)
            const quantity = bom.quantity || 1
            for (let i = 0; i < quantity; i++) {
              stickerNumber++
              const qrData = [`P${projectId}`, `S${stickerNumber}`, partNumber || '', opening.name, bom.partName]
                .filter(Boolean)
                .join('|')
              const packedInfo = packedStatusMap.get(qrData)

              hardwareItems.push({
                partName: bom.partName,
                partNumber: partNumber,
                description: bom.description,
                stickerNumber,
                status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
                packedAt: packedInfo?.packedAt?.toISOString() || null
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

                stickerNumber++
                const qrData = [`P${projectId}`, `S${stickerNumber}`, partNumber, opening.name, selectedOption.name]
                  .filter(Boolean)
                  .join('|')
                const packedInfo = packedStatusMap.get(qrData)

                hardwareItems.push({
                  partName: selectedOption.name,
                  partNumber: partNumber,
                  description: selectedOption.description,
                  stickerNumber,
                  status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
                  packedAt: packedInfo?.packedAt?.toISOString() || null
                })
              }
            }
          } catch (error) {
            console.error('Error parsing sub-option selections:', error)
          }
        }
      }

      // Track jamb kit for this opening if it has any jamb kit items
      let jambKit: {
        stickerNumber: number
        itemCount: number
        status: 'pending' | 'packed'
        packedAt: string | null
      } | null = null

      if (jambKitItemCount > 0) {
        stickerNumber++
        const qrData = `P${projectId}|S${stickerNumber}|JAMB-KIT|${opening.name}`
        const packedInfo = packedStatusMap.get(qrData)

        jambKit = {
          stickerNumber,
          itemCount: jambKitItemCount,
          status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
          packedAt: packedInfo?.packedAt?.toISOString() || null
        }

        jambKitsMap.set(opening.id, {
          openingId: opening.id,
          openingName: opening.name,
          itemCount: jambKitItemCount
        })
      }

      return {
        openingId: opening.id,
        openingName: opening.name,
        components,
        hardware: hardwareItems,
        jambKit
      }
    }))

    // Convert jamb kits map to array
    const jambKits = Array.from(jambKitsMap.values())

    return NextResponse.json({ packingList, jambKits })
  } catch (error) {
    console.error('Error generating packing list:', error)
    return NextResponse.json(
      { error: 'Failed to generate packing list' },
      { status: 500 }
    )
  }
}

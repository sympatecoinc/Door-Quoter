import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface PackingItem {
  id: number
  openingName: string
  itemType: 'component' | 'hardware' | 'jambkit'
  itemName: string
  partNumber: string | null
  dimensions?: string
  qrData: string
  status: 'pending' | 'packed'
  stickerNumber: number
  packedAt?: string | null
}

export interface PackingListResponse {
  project: {
    id: number
    name: string
    customerName: string | null
  }
  items: PackingItem[]
  stats: {
    total: number
    packed: number
    remaining: number
  }
}

// Helper function to get finish code from database
async function getFinishCode(finishType: string): Promise<string> {
  try {
    const finish = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })
    return finish?.finishCode ? `-${finish.finishCode}` : ''
  } catch {
    return ''
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find project by packing access token
    const project = await prisma.project.findUnique({
      where: { packingAccessToken: token },
      include: {
        customer: {
          select: { companyName: true }
        },
        openings: {
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
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Packing list not found or link expired' },
        { status: 404 }
      )
    }

    // Get all SalesOrderParts for this project to check packed status
    const salesOrderParts = await prisma.salesOrderPart.findMany({
      where: {
        salesOrder: { projectId: project.id }
      },
      select: {
        id: true,
        partNumber: true,
        partName: true,
        openingName: true,
        status: true,
        packedAt: true
      }
    })

    // Create a map of QR data -> packed status
    const packedStatusMap = new Map<string, { status: string; packedAt: Date | null }>()
    for (const part of salesOrderParts) {
      // Build QR data key matching the sticker format
      const qrKey = [part.partNumber || '', part.openingName || '', part.partName || '']
        .filter(Boolean)
        .join('|')
      packedStatusMap.set(qrKey, {
        status: part.status,
        packedAt: part.packedAt
      })
    }

    // Build packing list items (same logic as packing-list PDF route)
    const items: PackingItem[] = []
    let stickerNumber = 0

    for (const opening of project.openings) {
      const finishCode = opening.finishColor ? await getFinishCode(opening.finishColor) : ''
      let jambKitItemCount = 0

      // 1. Add component items (one per panel)
      for (const panel of opening.panels) {
        stickerNumber++
        const productName = panel.componentInstance?.product?.name || panel.type || 'Unknown'
        const qrData = [null, opening.name, productName].filter(Boolean).join('|')
        const packedInfo = packedStatusMap.get(qrData)

        items.push({
          id: stickerNumber,
          openingName: opening.name,
          itemType: 'component',
          itemName: productName,
          partNumber: null,
          dimensions: `${panel.width}" x ${panel.height}"`,
          qrData,
          status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
          stickerNumber,
          packedAt: packedInfo?.packedAt?.toISOString() || null
        })

        // Check for jamb kit items
        if (panel.componentInstance?.product) {
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
        }

        // 2. Process hardware from productBOMs
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (!bom.addToPackingList) continue

            let partNumber = bom.partNumber
            if (bom.addFinishToPartNumber && finishCode && partNumber) {
              partNumber = `${partNumber}${finishCode}`
            }

            const quantity = bom.quantity || 1
            for (let i = 0; i < quantity; i++) {
              stickerNumber++
              const qrData = [partNumber || '', opening.name, bom.partName]
                .filter(Boolean)
                .join('|')
              const packedInfo = packedStatusMap.get(qrData)

              items.push({
                id: stickerNumber,
                openingName: opening.name,
                itemType: 'hardware',
                itemName: bom.partName,
                partNumber,
                qrData,
                status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
                stickerNumber,
                packedAt: packedInfo?.packedAt?.toISOString() || null
              })
            }
          }
        }

        // 3. Process hardware from IndividualOptions
        const componentInstance = panel.componentInstance
        if (componentInstance?.subOptionSelections && componentInstance.product?.productSubOptions) {
          try {
            const selections = JSON.parse(componentInstance.subOptionSelections)

            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              if (!optionId) continue

              const categoryId = parseInt(categoryIdStr)
              const productSubOption = componentInstance.product.productSubOptions.find(
                (pso: { category: { id: number } }) => pso.category.id === categoryId
              )

              if (!productSubOption) continue

              const selectedOption = productSubOption.category.individualOptions?.find(
                (opt: { id: number; addToPackingList: boolean }) =>
                  opt.id === Number(optionId) && opt.addToPackingList
              )

              if (selectedOption && selectedOption.partNumber) {
                stickerNumber++
                let partNumber = selectedOption.partNumber
                if (selectedOption.addFinishToPartNumber && finishCode && partNumber) {
                  partNumber = `${partNumber}${finishCode}`
                }

                const qrData = [partNumber, opening.name, selectedOption.name]
                  .filter(Boolean)
                  .join('|')
                const packedInfo = packedStatusMap.get(qrData)

                items.push({
                  id: stickerNumber,
                  openingName: opening.name,
                  itemType: 'hardware',
                  itemName: selectedOption.name,
                  partNumber,
                  qrData,
                  status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
                  stickerNumber,
                  packedAt: packedInfo?.packedAt?.toISOString() || null
                })
              }
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }

      // 4. Add jamb kit for this opening
      if (jambKitItemCount > 0) {
        stickerNumber++
        const qrData = `JAMB-KIT|${opening.name}`
        const packedInfo = packedStatusMap.get(qrData)

        items.push({
          id: stickerNumber,
          openingName: opening.name,
          itemType: 'jambkit',
          itemName: `Jamb Kit (${jambKitItemCount} items)`,
          partNumber: null,
          qrData,
          status: packedInfo?.status === 'PACKED' ? 'packed' : 'pending',
          stickerNumber,
          packedAt: packedInfo?.packedAt?.toISOString() || null
        })
      }
    }

    const packedCount = items.filter(i => i.status === 'packed').length

    const response: PackingListResponse = {
      project: {
        id: project.id,
        name: project.name,
        customerName: project.customer?.companyName || null
      },
      items,
      stats: {
        total: items.length,
        packed: packedCount,
        remaining: items.length - packedCount
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching packing list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch packing list' },
      { status: 500 }
    )
  }
}

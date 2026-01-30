import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { qrData } = await request.json()

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR data', success: false },
        { status: 400 }
      )
    }

    // Find project by packing access token
    const project = await prisma.project.findUnique({
      where: { packingAccessToken: token },
      select: { id: true, name: true, customerId: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Packing list not found or link expired', success: false },
        { status: 404 }
      )
    }

    // Parse QR data - format:
    // P{projectId}|S{stickerIndex}|... where each sticker has a unique index
    // - Component: "P{projectId}|S{stickerIndex}|{openingName}|{itemName}" (4 parts)
    // - Hardware: "P{projectId}|S{stickerIndex}|{partNumber}|{openingName}|{itemName}" (5 parts)
    // - Jamb kit: "P{projectId}|S{stickerIndex}|JAMB-KIT|{openingName}" (4 parts)
    const parts = qrData.split('|')
    let partNumber: string | null = null
    let openingName: string | null = null
    let itemName: string | null = null
    let itemType: 'component' | 'hardware' | 'jambkit' = 'hardware'

    // Validate format: must start with P{number}|S{number}
    const projectIdMatch = parts[0]?.match(/^P(\d+)$/)
    const stickerIndexMatch = parts[1]?.match(/^S(\d+)$/)

    if (!projectIdMatch || !stickerIndexMatch) {
      return NextResponse.json(
        {
          error: 'Invalid QR code format - please reprint stickers with the new format.',
          success: false,
          scannedData: qrData
        },
        { status: 400 }
      )
    }

    const qrProjectId = parseInt(projectIdMatch[1])

    // Validate project ID matches - if not, look up the actual project name
    if (qrProjectId !== project.id) {
      const actualProject = await prisma.project.findUnique({
        where: { id: qrProjectId },
        select: { name: true }
      })
      const projectName = actualProject?.name || `Project #${qrProjectId}`

      return NextResponse.json(
        {
          error: `This sticker belongs to "${projectName}" - not the current project.`,
          success: false,
          wrongProject: true,
          wrongProjectName: projectName,
          wrongProjectId: qrProjectId,
          scannedData: qrData
        },
        { status: 400 }
      )
    }

    // Parse item details based on format
    if (parts[2] === 'JAMB-KIT') {
      // Jamb kit: P{projectId}|S{stickerIndex}|JAMB-KIT|{openingName}
      itemType = 'jambkit'
      openingName = parts[3] || null
      itemName = 'Jamb Kit'
      partNumber = 'JAMB-KIT'
    } else if (parts.length === 4) {
      // Component: P{projectId}|S{stickerIndex}|{openingName}|{itemName}
      itemType = 'component'
      partNumber = null
      openingName = parts[2] || null
      itemName = parts[3] || null
    } else if (parts.length >= 5) {
      // Hardware: P{projectId}|S{stickerIndex}|{partNumber}|{openingName}|{itemName}
      itemType = 'hardware'
      partNumber = parts[2] || null
      openingName = parts[3] || null
      itemName = parts[4] || null
    }

    if (!openingName) {
      return NextResponse.json(
        {
          error: 'Invalid QR code format - missing opening name',
          success: false,
          scannedData: qrData
        },
        { status: 400 }
      )
    }

    // Find or create a SalesOrder for this project
    let salesOrder = await prisma.salesOrder.findFirst({
      where: { projectId: project.id }
    })

    if (!salesOrder) {
      const orderNumber = `SO-PACK-${project.id}-${Date.now()}`
      salesOrder = await prisma.salesOrder.create({
        data: {
          orderNumber,
          customerId: project.customerId,
          projectId: project.id,
          status: 'IN_PROGRESS'
        }
      })
    }

    // Check if this item was already packed using qrData as the key (stored in productName)
    const existingPart = await prisma.salesOrderPart.findFirst({
      where: {
        salesOrderId: salesOrder.id,
        productName: qrData  // Use full qrData as the unique key
      }
    })

    // Display name for responses
    const displayName = itemType === 'jambkit' ? 'Jamb Kit' : (itemName || 'Unknown')

    if (existingPart) {
      if (existingPart.status === 'PACKED') {
        const stats = await getPackingStats(project.id, salesOrder.id)
        return NextResponse.json({
          success: false,
          alreadyPacked: true,
          message: 'Item already packed',
          item: {
            partNumber: existingPart.partNumber,
            itemName: displayName,
            openingName: existingPart.openingName,
            packedAt: existingPart.packedAt?.toISOString()
          },
          stats
        })
      }

      // Update existing part to packed
      const updatedPart = await prisma.salesOrderPart.update({
        where: { id: existingPart.id },
        data: {
          status: 'PACKED',
          packedAt: new Date(),
          qtyPacked: existingPart.quantity
        }
      })

      const stats = await getPackingStats(project.id, salesOrder.id)
      return NextResponse.json({
        success: true,
        message: 'Item packed successfully',
        item: {
          id: updatedPart.id,
          partNumber: updatedPart.partNumber,
          itemName: displayName,
          openingName: updatedPart.openingName,
          status: 'packed',
          packedAt: updatedPart.packedAt?.toISOString()
        },
        stats
      })
    }

    // Create new SalesOrderPart and mark as packed
    // Store qrData in productName for exact lookup matching
    const newPart = await prisma.salesOrderPart.create({
      data: {
        salesOrderId: salesOrder.id,
        partNumber: partNumber || '',
        partName: itemName || '',
        partType: itemType === 'jambkit' ? 'Jamb Kit' : (itemType === 'component' ? 'Component' : 'Hardware'),
        openingName: openingName,
        productName: qrData,  // Store full qrData for exact matching
        quantity: 1,
        unit: 'EA',
        status: 'PACKED',
        packedAt: new Date(),
        qtyPacked: 1
      }
    })

    const stats = await getPackingStats(project.id, salesOrder.id)

    return NextResponse.json({
      success: true,
      message: 'Item packed successfully',
      item: {
        id: newPart.id,
        partNumber: newPart.partNumber,
        itemName: displayName,
        openingName: newPart.openingName,
        status: 'packed',
        packedAt: newPart.packedAt?.toISOString()
      },
      stats
    })

  } catch (error) {
    console.error('Error scanning item:', error)
    return NextResponse.json(
      { error: 'Failed to process scan', success: false },
      { status: 500 }
    )
  }
}

async function getPackingStats(projectId: number, salesOrderId: number) {
  const packedParts = await prisma.salesOrderPart.findMany({
    where: { salesOrderId },
    select: { status: true }
  })

  const packed = packedParts.filter(p => p.status === 'PACKED').length

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
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
                                where: { addToPackingList: true }
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

  let total = 0
  if (project) {
    for (const opening of project.openings) {
      let hasJambKitItems = false

      for (const panel of opening.panels) {
        total++

        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (bom.addToPackingList) {
              total += bom.quantity || 1
            }
          }
        }

        if (panel.componentInstance?.subOptionSelections && panel.componentInstance.product?.productSubOptions) {
          try {
            const selections = JSON.parse(panel.componentInstance.subOptionSelections)
            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              if (!optionId) continue
              const categoryId = parseInt(categoryIdStr)
              const productSubOption = panel.componentInstance.product.productSubOptions.find(
                (pso: { category: { id: number } }) => pso.category.id === categoryId
              )
              if (productSubOption) {
                const selectedOption = productSubOption.category.individualOptions?.find(
                  (opt: { id: number; addToPackingList: boolean; partNumber: string | null }) =>
                    opt.id === Number(optionId) && opt.addToPackingList && opt.partNumber
                )
                if (selectedOption) {
                  total++
                }
              }
            }
          } catch {
            // Ignore parsing errors
          }
        }

        if (panel.componentInstance?.product) {
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
                hasJambKitItems = true
                break
              }
            }
          }
        }
      }

      if (hasJambKitItems) {
        total++
      }
    }
  }

  return {
    total,
    packed,
    remaining: total - packed
  }
}

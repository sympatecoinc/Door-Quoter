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

    // Parse QR data - new format includes project ID:
    // - Component: "P{projectId}|{openingName}|{itemName}" (3 parts, starts with P)
    // - Hardware: "P{projectId}|{partNumber}|{openingName}|{itemName}" (4 parts)
    // - Jamb kit: "P{projectId}|JAMB-KIT|{openingName}" (3 parts)
    // Also support legacy format without project ID for backwards compatibility
    const parts = qrData.split('|')
    let qrProjectId: number | null = null
    let partNumber: string | null = null
    let openingName: string | null = null
    let itemName: string | null = null
    let itemType: 'component' | 'hardware' | 'jambkit' = 'hardware'

    // Check if first part is a project ID (starts with 'P' followed by number)
    const projectIdMatch = parts[0]?.match(/^P(\d+)$/)

    if (projectIdMatch) {
      // New format with project ID
      qrProjectId = parseInt(projectIdMatch[1])

      // Validate project ID matches
      if (qrProjectId !== project.id) {
        return NextResponse.json(
          {
            error: `This sticker belongs to a different project.`,
            success: false,
            wrongProject: true,
            scannedData: qrData
          },
          { status: 400 }
        )
      }

      if (parts[1] === 'JAMB-KIT') {
        // Jamb kit: P{projectId}|JAMB-KIT|{openingName}
        itemType = 'jambkit'
        openingName = parts[2] || null
        itemName = 'Jamb Kit'
        partNumber = 'JAMB-KIT'
      } else if (parts.length === 3) {
        // Component: P{projectId}|{openingName}|{itemName}
        itemType = 'component'
        partNumber = null
        openingName = parts[1] || null
        itemName = parts[2] || null
      } else if (parts.length >= 4) {
        // Hardware: P{projectId}|{partNumber}|{openingName}|{itemName}
        itemType = 'hardware'
        partNumber = parts[1] || null
        openingName = parts[2] || null
        itemName = parts[3] || null
      }
    } else {
      // Legacy format without project ID - validate by opening name
      if (parts[0] === 'JAMB-KIT') {
        itemType = 'jambkit'
        openingName = parts[1] || null
        itemName = 'Jamb Kit'
        partNumber = 'JAMB-KIT'
      } else if (parts.length === 2) {
        itemType = 'component'
        partNumber = null
        openingName = parts[0] || null
        itemName = parts[1] || null
      } else if (parts.length >= 3) {
        itemType = 'hardware'
        partNumber = parts[0] || null
        openingName = parts[1] || null
        itemName = parts[2] || null
      }

      // For legacy format, validate opening exists in this project
      if (openingName) {
        const opening = await prisma.opening.findFirst({
          where: {
            projectId: project.id,
            name: openingName
          }
        })

        if (!opening) {
          return NextResponse.json(
            {
              error: `This item belongs to a different project. Opening "${openingName}" not found in "${project.name}".`,
              success: false,
              wrongProject: true,
              scannedData: qrData
            },
            { status: 400 }
          )
        }
      }
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

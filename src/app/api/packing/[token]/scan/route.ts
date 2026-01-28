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

    // Parse QR data based on format:
    // - Jamb kit: "JAMB-KIT|openingName" (2 parts, starts with JAMB-KIT)
    // - Component (no partNumber): "openingName|itemName" (2 parts)
    // - Hardware (with partNumber): "partNumber|openingName|itemName" (3 parts)
    const parts = qrData.split('|')
    let partNumber: string | null = null
    let openingName: string | null = null
    let itemName: string | null = null
    let itemType: 'component' | 'hardware' | 'jambkit' = 'hardware'

    if (parts[0] === 'JAMB-KIT') {
      // Jamb kit format: JAMB-KIT|openingName
      // Store with JAMB-KIT as partNumber so lookup key matches: JAMB-KIT|openingName
      itemType = 'jambkit'
      openingName = parts[1] || null
      itemName = '' // Empty so lookup key is just JAMB-KIT|openingName
      partNumber = 'JAMB-KIT'
    } else if (parts.length === 2) {
      // Component format (no partNumber): openingName|itemName
      itemType = 'component'
      partNumber = null
      openingName = parts[0] || null
      itemName = parts[1] || null
    } else if (parts.length >= 3) {
      // Hardware format: partNumber|openingName|itemName
      itemType = 'hardware'
      partNumber = parts[0] || null
      openingName = parts[1] || null
      itemName = parts[2] || null
    } else {
      return NextResponse.json(
        {
          error: 'Invalid QR code format',
          success: false,
          scannedData: qrData
        },
        { status: 400 }
      )
    }

    // Jamb kits don't have itemName, others require it
    if (!openingName || (itemType !== 'jambkit' && !itemName)) {
      return NextResponse.json(
        {
          error: 'Invalid QR code format - missing opening or item name',
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
      // Create a minimal sales order for tracking packing
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

    // Check if this item was already packed
    // Match using the same fields that will be used to build the lookup key
    // partNumber is required in schema, so use empty string for components
    const storedPartNumber = partNumber || ''
    const existingPart = await prisma.salesOrderPart.findFirst({
      where: {
        salesOrderId: salesOrder.id,
        openingName: openingName,
        partName: itemName,
        partNumber: storedPartNumber
      }
    })

    // Display name for responses (use 'Jamb Kit' for jamb kits since itemName is empty for matching)
    const displayName = itemType === 'jambkit' ? 'Jamb Kit' : itemName

    if (existingPart) {
      if (existingPart.status === 'PACKED') {
        // Already packed
        const stats = await getPackingStats(project.id, salesOrder.id)
        return NextResponse.json({
          success: false,
          alreadyPacked: true,
          message: 'Item already packed',
          item: {
            partNumber: existingPart.partNumber,
            itemName: existingPart.partName || displayName,
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
          itemName: updatedPart.partName || displayName,
          openingName: updatedPart.openingName,
          status: 'packed',
          packedAt: updatedPart.packedAt?.toISOString()
        },
        stats
      })
    }

    // Create new SalesOrderPart and mark as packed
    // Store with the exact values so the lookup in GET route will match
    // partName stores the matching key (empty for jamb kits), productName stores display name
    const newPart = await prisma.salesOrderPart.create({
      data: {
        salesOrderId: salesOrder.id,
        partNumber: storedPartNumber, // 'JAMB-KIT' for jamb kits, empty for components, value for hardware
        partName: itemName || '', // Empty for jamb kits (for matching), actual name for others
        partType: itemType === 'jambkit' ? 'Jamb Kit' : (itemType === 'component' ? 'Component' : 'Hardware'),
        openingName: openingName,
        productName: displayName, // Display name (Jamb Kit for jamb kits)
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
        itemName: newPart.productName || displayName,
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
  // Get count of packed items from SalesOrderParts
  const packedParts = await prisma.salesOrderPart.findMany({
    where: { salesOrderId },
    select: { status: true }
  })

  const packed = packedParts.filter(p => p.status === 'PACKED').length

  // Get total expected items by counting from project openings/BOMs
  // This matches the logic in the packing list route
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
        // Count component
        total++

        // Count hardware from BOMs
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (bom.addToPackingList) {
              total += bom.quantity || 1
            }
          }
        }

        // Count hardware from individual options
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

        // Check for jamb kit items
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

      // Count jamb kit as one item per opening
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

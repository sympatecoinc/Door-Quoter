import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'

// POST - Record receiving against a purchase order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const poId = parseInt(id, 10)

    if (isNaN(poId)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      receivedById,
      receivedDate,
      notes,
      qualityNotes,
      lines // Array of { purchaseOrderLineId, quantityReceived, quantityDamaged, quantityRejected, notes }
    } = body

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'At least one receiving line is required' },
        { status: 400 }
      )
    }

    // Get the PO with lines
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        lines: true
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Validate status - can only receive against Sent, Acknowledged, or Partial POs
    const validStatuses: POStatus[] = ['SENT', 'ACKNOWLEDGED', 'PARTIAL']
    if (!validStatuses.includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: `Cannot receive against a PO with status "${purchaseOrder.status}". Valid statuses are: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate line IDs and quantities
    const lineMap = new Map(purchaseOrder.lines.map(l => [l.id, l]))
    for (const line of lines) {
      const poLine = lineMap.get(line.purchaseOrderLineId)
      if (!poLine) {
        return NextResponse.json(
          { error: `Line item ${line.purchaseOrderLineId} not found in this purchase order` },
          { status: 400 }
        )
      }

      const qtyReceived = line.quantityReceived || 0
      const qtyDamaged = line.quantityDamaged || 0
      const qtyRejected = line.quantityRejected || 0
      const remaining = poLine.quantity - poLine.quantityReceived

      if (qtyReceived > remaining) {
        return NextResponse.json(
          { error: `Received quantity (${qtyReceived}) exceeds remaining quantity (${remaining}) for line ${poLine.description || poLine.id}` },
          { status: 400 }
        )
      }
      if (qtyDamaged + qtyRejected > qtyReceived) {
        return NextResponse.json(
          { error: `Damaged (${qtyDamaged}) + Rejected (${qtyRejected}) cannot exceed Received (${qtyReceived}) for line ${poLine.description || poLine.id}` },
          { status: 400 }
        )
      }
    }

    // Create the receiving record
    const receiving = await prisma.pOReceiving.create({
      data: {
        purchaseOrderId: poId,
        receivedById: receivedById || null,
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        notes: notes || null,
        qualityNotes: qualityNotes || null,
        lines: {
          create: lines.map((line: any) => ({
            purchaseOrderLineId: line.purchaseOrderLineId,
            quantityReceived: line.quantityReceived || 0,
            quantityDamaged: line.quantityDamaged || 0,
            quantityRejected: line.quantityRejected || 0,
            notes: line.notes || null
          }))
        }
      },
      include: {
        receivedBy: {
          select: { id: true, name: true }
        },
        lines: {
          include: {
            purchaseOrderLine: true
          }
        }
      }
    })

    // Update PO line quantities and track inventory updates
    const inventoryUpdates: { masterPartId: number; partNumber: string; quantityReceived: number }[] = []

    for (const line of lines) {
      const poLine = lineMap.get(line.purchaseOrderLineId)!
      const totalPhysicalReceipt = line.quantityReceived || 0
      const newReceived = poLine.quantityReceived + totalPhysicalReceipt
      const newRemaining = poLine.quantity - newReceived

      await prisma.purchaseOrderLine.update({
        where: { id: line.purchaseOrderLineId },
        data: {
          quantityReceived: newReceived,
          quantityRemaining: newRemaining
        }
      })

      // Update inventory - only good items (received minus damaged/rejected)
      const goodQty = totalPhysicalReceipt - (line.quantityDamaged || 0) - (line.quantityRejected || 0)
      if (goodQty > 0) {
        // Get the PO line with QuickBooksItem and MasterPart
        const poLineWithItem = await prisma.purchaseOrderLine.findUnique({
          where: { id: line.purchaseOrderLineId },
          include: {
            quickbooksItem: {
              include: {
                masterPart: true
              }
            }
          }
        })

        let masterPart = poLineWithItem?.quickbooksItem?.masterPart

        // If no direct link, try to find MasterPart by matching description or itemRefName
        if (!masterPart && poLineWithItem) {
          const searchTerm = poLineWithItem.description || poLineWithItem.itemRefName
          if (searchTerm) {
            const beforeDash = searchTerm.split(' - ')[0]?.trim()
            const afterDash = searchTerm.split(' - ')[1]?.trim()
            // Extract part number from after ' - ' (e.g., "48445-BLA-99" → "48445")
            const extractedPartNum = afterDash?.split('-')[0]?.trim()

            masterPart = await prisma.masterPart.findFirst({
              where: {
                OR: [
                  { baseName: searchTerm },
                  { partNumber: searchTerm },
                  { partNumber: beforeDash },
                  { baseName: beforeDash },
                  // Extract part number from extrusion format: "BaseName - partNum-finish-length"
                  ...(extractedPartNum ? [{ partNumber: extractedPartNum }] : [])
                ]
              }
            })
          }
        }

        if (masterPart) {
          const isExtrusion = masterPart.partType?.toLowerCase() === 'extrusion'

          if (isExtrusion) {
            // For extrusions, update ExtrusionVariant.qtyOnHand
            let variant = null

            // Parse variant info from description (format: "BaseName - partNum-finishCode-stockLength")
            const desc = poLineWithItem?.description || poLineWithItem?.itemRefName || ''
            const afterDash = desc.split(' - ')[1]?.trim()
            if (afterDash) {
              // e.g., "48445-BLA-99" → segments = ["48445", "BLA", "99"]
              const segments = afterDash.split('-')
              const lastSegment = segments[segments.length - 1]
              const parsedStockLength = parseFloat(lastSegment)

              if (!isNaN(parsedStockLength) && parsedStockLength > 0) {
                variant = await prisma.extrusionVariant.findFirst({
                  where: {
                    masterPartId: masterPart.id,
                    stockLength: parsedStockLength,
                    isActive: true
                  }
                })
              }
            }

            // Fallback: find any active variant for this master part
            if (!variant) {
              variant = await prisma.extrusionVariant.findFirst({
                where: {
                  masterPartId: masterPart.id,
                  isActive: true
                },
                orderBy: { stockLength: 'desc' }
              })
            }

            if (variant) {
              await prisma.extrusionVariant.update({
                where: { id: variant.id },
                data: {
                  qtyOnHand: {
                    increment: goodQty
                  }
                }
              })

              inventoryUpdates.push({
                masterPartId: masterPart.id,
                partNumber: masterPart.partNumber,
                quantityReceived: goodQty
              })
            }
          } else {
            // Non-extrusion: update MasterPart.qtyOnHand
            await prisma.masterPart.update({
              where: { id: masterPart.id },
              data: {
                qtyOnHand: {
                  increment: goodQty
                }
              }
            })

            inventoryUpdates.push({
              masterPartId: masterPart.id,
              partNumber: masterPart.partNumber,
              quantityReceived: goodQty
            })
          }
        }
      }
    }

    // Create inventory notification if any inventory was updated
    if (inventoryUpdates.length > 0) {
      const totalGoodQty = inventoryUpdates.reduce((sum, u) => sum + u.quantityReceived, 0)
      const totalDamagedRejected = lines.reduce((sum: number, l: any) => sum + (l.quantityDamaged || 0) + (l.quantityRejected || 0), 0)
      const partsText = inventoryUpdates.length === 1
        ? `${inventoryUpdates[0].partNumber} (${inventoryUpdates[0].quantityReceived})`
        : `${inventoryUpdates.length} parts`
      const qualityNote = totalDamagedRejected > 0 ? ` (${totalDamagedRejected} damaged/rejected)` : ''

      await prisma.inventoryNotification.create({
        data: {
          type: 'items_received',
          message: `Received ${totalGoodQty} good items from PO #${purchaseOrder.poNumber || poId}: ${partsText}${qualityNote}`,
          masterPartId: inventoryUpdates.length === 1 ? inventoryUpdates[0].masterPartId : null,
          actionType: null
        }
      })
    }

    // Determine new PO status
    const updatedLines = await prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: poId }
    })

    let allComplete = true
    let anyReceived = false
    for (const line of updatedLines) {
      if (line.quantityReceived > 0) anyReceived = true
      if (line.quantityRemaining > 0) allComplete = false
    }

    let newStatus: POStatus = purchaseOrder.status
    if (allComplete) {
      newStatus = 'COMPLETE'
    } else if (anyReceived) {
      newStatus = 'PARTIAL'
    }

    // Update PO status if changed
    if (newStatus !== purchaseOrder.status) {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: newStatus,
          statusHistory: {
            create: {
              fromStatus: purchaseOrder.status,
              toStatus: newStatus,
              changedById: receivedById || null,
              notes: `Status changed due to receiving (${newStatus === 'COMPLETE' ? 'all items received' : 'partial receipt'})`
            }
          }
        }
      })
    }

    // Return the updated PO
    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        vendor: true,
        lines: {
          include: {
            quickbooksItem: true
          },
          orderBy: { lineNum: 'asc' }
        },
        receivings: {
          include: {
            receivedBy: true,
            lines: true
          },
          orderBy: { receivedDate: 'desc' }
        }
      }
    })

    return NextResponse.json({
      message: 'Receiving recorded successfully',
      receiving,
      purchaseOrder: updatedPO,
      statusChanged: newStatus !== purchaseOrder.status,
      newStatus
    })
  } catch (error) {
    console.error('Error recording receiving:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to record receiving' },
      { status: 500 }
    )
  }
}

// GET - Get receiving history for a PO
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const poId = parseInt(id, 10)

    if (isNaN(poId)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      )
    }

    const receivings = await prisma.pOReceiving.findMany({
      where: { purchaseOrderId: poId },
      include: {
        receivedBy: {
          select: { id: true, name: true }
        },
        lines: {
          include: {
            purchaseOrderLine: {
              include: {
                quickbooksItem: {
                  select: {
                    id: true,
                    name: true,
                    sku: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { receivedDate: 'desc' }
    })

    return NextResponse.json({ receivings })
  } catch (error) {
    console.error('Error fetching receiving history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch receiving history' },
      { status: 500 }
    )
  }
}

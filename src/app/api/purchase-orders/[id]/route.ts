import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import {
  getStoredRealmId,
  fetchQBPurchaseOrder,
  updateQBPurchaseOrder,
  deleteQBPurchaseOrder,
  localPOToQB,
  localPOLineToQB,
  QBPOLine
} from '@/lib/quickbooks'

// GET - Get single purchase order with all details
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

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        vendor: {
          select: {
            id: true,
            displayName: true,
            companyName: true,
            primaryEmail: true,
            primaryPhone: true,
            quickbooksId: true,
            billAddressLine1: true,
            billAddressLine2: true,
            billAddressCity: true,
            billAddressState: true,
            billAddressZip: true,
            billAddressCountry: true
          }
        },
        lines: {
          include: {
            quickbooksItem: {
              select: {
                id: true,
                quickbooksId: true,
                name: true,
                sku: true,
                description: true,
                purchaseCost: true
              }
            },
            receivingLines: true
          },
          orderBy: { lineNum: 'asc' }
        },
        receivings: {
          include: {
            receivedBy: {
              select: {
                id: true,
                name: true
              }
            },
            lines: {
              include: {
                purchaseOrderLine: true
              }
            }
          },
          orderBy: { receivedDate: 'desc' }
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { changedAt: 'desc' }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ purchaseOrder })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

// PUT - Update purchase order
export async function PUT(
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
      status,
      txnDate,
      expectedDate,
      dueDate,
      memo,
      privateNote,
      shipAddrLine1,
      shipAddrLine2,
      shipAddrCity,
      shipAddrState,
      shipAddrPostalCode,
      shipAddrCountry,
      lines,
      pushToQuickBooks = true,
      changedById
    } = body

    // Get current PO
    const currentPO = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        vendor: true,
        lines: true
      }
    })

    if (!currentPO) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (txnDate !== undefined) updateData.txnDate = new Date(txnDate)
    if (expectedDate !== undefined) updateData.expectedDate = expectedDate ? new Date(expectedDate) : null
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (memo !== undefined) updateData.memo = memo
    if (privateNote !== undefined) updateData.privateNote = privateNote
    if (shipAddrLine1 !== undefined) updateData.shipAddrLine1 = shipAddrLine1
    if (shipAddrLine2 !== undefined) updateData.shipAddrLine2 = shipAddrLine2
    if (shipAddrCity !== undefined) updateData.shipAddrCity = shipAddrCity
    if (shipAddrState !== undefined) updateData.shipAddrState = shipAddrState
    if (shipAddrPostalCode !== undefined) updateData.shipAddrPostalCode = shipAddrPostalCode
    if (shipAddrCountry !== undefined) updateData.shipAddrCountry = shipAddrCountry

    // Handle status change
    if (status && status !== currentPO.status) {
      updateData.status = status as POStatus

      // Create status history entry
      await prisma.pOStatusHistory.create({
        data: {
          purchaseOrderId: poId,
          fromStatus: currentPO.status,
          toStatus: status as POStatus,
          changedById: changedById || null,
          notes: `Status changed from ${currentPO.status} to ${status}`
        }
      })
    }

    // Handle line updates
    if (lines && Array.isArray(lines)) {
      // Delete existing lines and create new ones
      await prisma.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: poId }
      })

      let subtotal = 0
      const processedLines = lines.map((line: any, index: number) => {
        const amount = (line.quantity || 1) * (line.unitPrice || 0)
        subtotal += amount
        return {
          purchaseOrderId: poId,
          lineNum: index + 1,
          quickbooksItemId: line.quickbooksItemId || null,
          itemRefId: line.itemRefId || null,
          itemRefName: line.itemRefName || null,
          description: line.description || null,
          quantity: line.quantity || 1,
          unitPrice: line.unitPrice || 0,
          amount,
          quantityReceived: line.quantityReceived || 0,
          quantityRemaining: (line.quantity || 1) - (line.quantityReceived || 0),
          notes: line.notes || null
        }
      })

      await prisma.purchaseOrderLine.createMany({
        data: processedLines
      })

      updateData.subtotal = subtotal
      updateData.totalAmount = subtotal + (currentPO.taxAmount || 0) + (currentPO.shippingAmount || 0)
    }

    // Update the PO
    let purchaseOrder = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: updateData,
      include: {
        vendor: true,
        lines: {
          include: {
            quickbooksItem: true
          },
          orderBy: { lineNum: 'asc' }
        },
        createdBy: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5
        }
      }
    })

    // Sync to QuickBooks if requested
    if (pushToQuickBooks && currentPO.quickbooksId && currentPO.vendor.quickbooksId) {
      const realmId = await getStoredRealmId()
      if (realmId) {
        try {
          // Get current QB PO for SyncToken
          const currentQBPO = await fetchQBPurchaseOrder(realmId, currentPO.quickbooksId)

          // Convert lines to QB format
          const qbLines: QBPOLine[] = purchaseOrder.lines.map(line => {
            return localPOLineToQB({
              itemRefId: line.quickbooksItem?.quickbooksId || line.itemRefId,
              itemRefName: line.quickbooksItem?.name || line.itemRefName,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: line.amount
            })
          })

          // Build QB PO update
          const qbPO = localPOToQB(purchaseOrder, currentPO.vendor.quickbooksId, qbLines)
          qbPO.Id = currentPO.quickbooksId
          qbPO.SyncToken = currentQBPO.SyncToken
          qbPO.sparse = true

          const updatedQBPO = await updateQBPurchaseOrder(realmId, qbPO)

          // Update local with new sync token
          purchaseOrder = await prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
              syncToken: updatedQBPO.SyncToken,
              lastSyncedAt: new Date()
            },
            include: {
              vendor: true,
              lines: {
                include: {
                  quickbooksItem: true
                },
                orderBy: { lineNum: 'asc' }
              },
              createdBy: true,
              statusHistory: {
                orderBy: { changedAt: 'desc' },
                take: 5
              }
            }
          })
        } catch (qbError) {
          console.error('Failed to update PO in QuickBooks:', qbError)
          return NextResponse.json({
            purchaseOrder,
            warning: `Purchase order updated locally but failed to sync to QuickBooks: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
          })
        }
      }
    }

    return NextResponse.json({ purchaseOrder })
  } catch (error) {
    console.error('Error updating purchase order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update purchase order' },
      { status: 500 }
    )
  }
}

// DELETE - Delete/Cancel purchase order
export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { receivings: true }
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Don't allow deletion if there are receivings
    if (purchaseOrder.receivings.length > 0 && permanent) {
      return NextResponse.json(
        { error: 'Cannot permanently delete a purchase order with receiving records. Cancel it instead.' },
        { status: 400 }
      )
    }

    if (permanent) {
      // Delete from QuickBooks if it exists there
      if (purchaseOrder.quickbooksId && purchaseOrder.syncToken) {
        const realmId = await getStoredRealmId()
        if (realmId) {
          try {
            await deleteQBPurchaseOrder(realmId, purchaseOrder.quickbooksId, purchaseOrder.syncToken)
          } catch (qbError) {
            console.error('Failed to delete PO from QuickBooks:', qbError)
            // Continue with local deletion
          }
        }
      }

      // Delete locally (cascade will handle lines, history, etc.)
      await prisma.purchaseOrder.delete({
        where: { id: poId }
      })

      return NextResponse.json({ message: 'Purchase order deleted permanently' })
    } else {
      // Just cancel the PO
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'CANCELLED',
          statusHistory: {
            create: {
              fromStatus: purchaseOrder.status,
              toStatus: 'CANCELLED',
              notes: 'Purchase order cancelled'
            }
          }
        }
      })

      return NextResponse.json({
        message: 'Purchase order cancelled',
        purchaseOrder: updatedPO
      })
    }
  } catch (error) {
    console.error('Error deleting purchase order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete purchase order' },
      { status: 500 }
    )
  }
}

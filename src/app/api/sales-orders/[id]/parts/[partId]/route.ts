import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deductInventory, markPartPacked, markPartShipped } from '@/lib/sales-order-parts'

/**
 * PATCH /api/sales-orders/[id]/parts/[partId]
 * Update individual part status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  try {
    const resolvedParams = await params
    const soId = parseInt(resolvedParams.id)
    const partId = parseInt(resolvedParams.partId)

    if (isNaN(soId) || isNaN(partId)) {
      return NextResponse.json(
        { error: 'Invalid sales order or part ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, quantity, userId } = body

    // Verify the part belongs to this sales order
    const part = await prisma.salesOrderPart.findFirst({
      where: {
        id: partId,
        salesOrderId: soId
      },
      include: {
        masterPart: {
          include: { binLocationRef: true }
        }
      }
    })

    if (!part) {
      return NextResponse.json(
        { error: 'Part not found or does not belong to this sales order' },
        { status: 404 }
      )
    }

    // Handle status transitions
    const qtyToUpdate = quantity ?? part.quantity

    switch (status) {
      case 'PICKED':
        // Deduct inventory and mark as picked
        if (part.masterPartId) {
          await deductInventory(partId, qtyToUpdate, userId)
        } else {
          // No master part, just update status
          await prisma.salesOrderPart.update({
            where: { id: partId },
            data: {
              qtyPicked: { increment: qtyToUpdate },
              status: 'PICKED',
              pickedAt: new Date(),
              pickedById: userId
            }
          })
        }
        break

      case 'PACKED':
        await markPartPacked(partId, qtyToUpdate)
        break

      case 'SHIPPED':
        await markPartShipped(partId, qtyToUpdate)
        break

      case 'CANCELLED':
        // If part was reserved, release the reservation
        if (part.status === 'RESERVED' && part.masterPartId) {
          await prisma.masterPart.update({
            where: { id: part.masterPartId },
            data: { qtyReserved: { decrement: part.quantity } }
          })
        }
        await prisma.salesOrderPart.update({
          where: { id: partId },
          data: { status: 'CANCELLED' }
        })
        break

      default:
        // Generic status update
        await prisma.salesOrderPart.update({
          where: { id: partId },
          data: { status }
        })
    }

    // Fetch updated part
    const updatedPart = await prisma.salesOrderPart.findUnique({
      where: { id: partId },
      include: {
        masterPart: {
          include: { binLocationRef: true }
        },
        pickedBy: {
          select: { id: true, name: true }
        }
      }
    })

    // Calculate availability
    const onHand = updatedPart?.masterPart?.qtyOnHand ?? 0
    const reserved = updatedPart?.masterPart?.qtyReserved ?? 0
    const available = Math.max(0, onHand - reserved)

    return NextResponse.json({
      ...updatedPart,
      availability: {
        onHand,
        reserved,
        available,
        binLocation: updatedPart?.masterPart?.binLocationRef?.code ?? null
      }
    })
  } catch (error) {
    console.error('Error updating part status:', error)
    return NextResponse.json(
      { error: 'Failed to update part status' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sales-orders/[id]/parts/[partId]
 * Get a single part with availability info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partId: string }> }
) {
  try {
    const resolvedParams = await params
    const soId = parseInt(resolvedParams.id)
    const partId = parseInt(resolvedParams.partId)

    if (isNaN(soId) || isNaN(partId)) {
      return NextResponse.json(
        { error: 'Invalid sales order or part ID' },
        { status: 400 }
      )
    }

    const part = await prisma.salesOrderPart.findFirst({
      where: {
        id: partId,
        salesOrderId: soId
      },
      include: {
        masterPart: {
          include: { binLocationRef: true }
        },
        pickedBy: {
          select: { id: true, name: true }
        }
      }
    })

    if (!part) {
      return NextResponse.json(
        { error: 'Part not found' },
        { status: 404 }
      )
    }

    // Calculate availability
    const onHand = part.masterPart?.qtyOnHand ?? 0
    const reserved = part.masterPart?.qtyReserved ?? 0
    const available = Math.max(0, onHand - reserved)

    return NextResponse.json({
      ...part,
      availability: {
        onHand,
        reserved,
        available,
        binLocation: part.masterPart?.binLocationRef?.code ?? null
      }
    })
  } catch (error) {
    console.error('Error fetching part:', error)
    return NextResponse.json(
      { error: 'Failed to fetch part' },
      { status: 500 }
    )
  }
}

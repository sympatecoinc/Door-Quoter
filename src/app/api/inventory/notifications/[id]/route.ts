import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// DELETE /api/inventory/notifications/[id] - Dismiss a notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Check if notification exists
    const notification = await prisma.inventoryNotification.findUnique({
      where: { id }
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Mark as dismissed (soft delete)
    await prisma.inventoryNotification.update({
      where: { id },
      data: { isDismissed: true }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error dismissing notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

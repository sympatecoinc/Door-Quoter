import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/inventory/notifications/count - Get count of non-dismissed notifications
export async function GET() {
  try {
    const count = await prisma.inventoryNotification.count({
      where: {
        isDismissed: false
      }
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching notification count:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

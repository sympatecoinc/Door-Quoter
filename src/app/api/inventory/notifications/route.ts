import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/inventory/notifications - List non-dismissed notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dismissed = searchParams.get('dismissed') === 'true'

    const notifications = await prisma.inventoryNotification.findMany({
      where: {
        isDismissed: dismissed
      },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            partType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Error fetching inventory notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

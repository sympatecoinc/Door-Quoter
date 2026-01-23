import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'

// GET - Return count of POs awaiting receiving for sidebar badge
export async function GET() {
  try {
    const validStatuses: POStatus[] = ['SENT', 'ACKNOWLEDGED', 'PARTIAL']

    const count = await prisma.purchaseOrder.count({
      where: {
        status: { in: validStatuses }
      }
    })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching receiving count:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch receiving count' },
      { status: 500 }
    )
  }
}

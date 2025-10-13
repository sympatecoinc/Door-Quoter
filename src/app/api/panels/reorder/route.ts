import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { panelOrders } = await request.json()

    if (!Array.isArray(panelOrders) || panelOrders.length === 0) {
      return NextResponse.json(
        { error: 'panelOrders must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate that all items have required fields
    for (const item of panelOrders) {
      if (typeof item.id !== 'number' || typeof item.displayOrder !== 'number') {
        return NextResponse.json(
          { error: 'Each item must have id and displayOrder' },
          { status: 400 }
        )
      }
    }

    // Update all panels in a transaction
    await prisma.$transaction(
      panelOrders.map(({ id, displayOrder }) =>
        prisma.panel.update({
          where: { id },
          data: { displayOrder }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering panels:', error)
    return NextResponse.json(
      { error: 'Failed to reorder panels' },
      { status: 500 }
    )
  }
}

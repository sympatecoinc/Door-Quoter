import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT - Update finish pricing entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { finishType, finishCode, costPerSqFt, isActive } = body

    const finishPricing = await prisma.extrusionFinishPricing.update({
      where: { id },
      data: {
        ...(finishType !== undefined && { finishType }),
        ...(finishCode !== undefined && { finishCode: finishCode || null }),
        ...(costPerSqFt !== undefined && { costPerSqFt }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json(finishPricing)
  } catch (error) {
    console.error('Error updating finish pricing:', error)
    return NextResponse.json(
      { error: 'Failed to update finish pricing' },
      { status: 500 }
    )
  }
}

// DELETE - Delete finish pricing entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const id = parseInt(resolvedParams.id)

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      )
    }

    await prisma.extrusionFinishPricing.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting finish pricing:', error)
    return NextResponse.json(
      { error: 'Failed to delete finish pricing' },
      { status: 500 }
    )
  }
}

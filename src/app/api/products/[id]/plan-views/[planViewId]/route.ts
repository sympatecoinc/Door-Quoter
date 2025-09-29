import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT update a plan view
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planViewId: string }> }
) {
  try {
    const { planViewId } = await params
    const planViewIdInt = parseInt(planViewId)
    const { name, imageData, fileName, displayOrder } = await request.json()

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (imageData !== undefined) updateData.imageData = imageData
    if (fileName !== undefined) updateData.fileName = fileName
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder

    const planView = await prisma.productPlanView.update({
      where: { id: planViewIdInt },
      data: updateData
    })

    return NextResponse.json(planView)
  } catch (error) {
    console.error('Error updating plan view:', error)
    return NextResponse.json(
      { error: 'Failed to update plan view' },
      { status: 500 }
    )
  }
}

// DELETE a plan view
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planViewId: string }> }
) {
  try {
    const { planViewId } = await params
    const planViewIdInt = parseInt(planViewId)

    await prisma.productPlanView.delete({
      where: { id: planViewIdInt }
    })

    return NextResponse.json({ message: 'Plan view deleted successfully' })
  } catch (error) {
    console.error('Error deleting plan view:', error)
    return NextResponse.json(
      { error: 'Failed to delete plan view' },
      { status: 500 }
    )
  }
}
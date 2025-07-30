import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const instanceId = parseInt(id)
    
    const componentInstance = await prisma.componentInstance.findUnique({
      where: { id: instanceId },
      include: {
        product: true,
        panel: true
      }
    })

    if (!componentInstance) {
      return NextResponse.json(
        { error: 'Component instance not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(componentInstance)
  } catch (error) {
    console.error('Error fetching component instance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component instance' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const instanceId = parseInt(id)
    const { productId, subOptionSelections } = await request.json()

    const updateData: any = {}
    
    if (productId !== undefined) {
      updateData.productId = parseInt(productId)
    }
    
    if (subOptionSelections !== undefined) {
      updateData.subOptionSelections = JSON.stringify(subOptionSelections)
    }

    const componentInstance = await prisma.componentInstance.update({
      where: { id: instanceId },
      data: updateData,
      include: {
        product: true,
        panel: true
      }
    })

    return NextResponse.json(componentInstance)
  } catch (error) {
    console.error('Error updating component instance:', error)
    return NextResponse.json(
      { error: 'Failed to update component instance' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const instanceId = parseInt(id)

    // First check if component instance exists
    const componentInstance = await prisma.componentInstance.findUnique({
      where: { id: instanceId }
    })

    if (!componentInstance) {
      return NextResponse.json(
        { error: 'Component instance not found' },
        { status: 404 }
      )
    }

    // Delete the component instance
    await prisma.componentInstance.delete({
      where: { id: instanceId }
    })

    return NextResponse.json({ message: 'Component instance deleted successfully' })
  } catch (error) {
    console.error('Error deleting component instance:', error)
    return NextResponse.json(
      { error: 'Failed to delete component instance' },
      { status: 500 }
    )
  }
}
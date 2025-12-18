import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)
    
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId },
      include: {
        category: true
      }
    })

    if (!option) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 })
    }

    return NextResponse.json(option)
  } catch (error) {
    console.error('Error fetching option:', error)
    return NextResponse.json(
      { error: 'Failed to fetch option' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)
    const {
      name,
      description,
      price,
      partNumber,
      addToPackingList,
      addFinishToPartNumber,
      isCutListItem
    } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Option name is required' },
        { status: 400 }
      )
    }

    const option = await prisma.individualOption.update({
      where: { id: optionId },
      data: {
        name,
        description,
        price: parseFloat(price) || 0,
        partNumber: partNumber || null,
        addToPackingList: addToPackingList !== undefined ? Boolean(addToPackingList) : undefined,
        addFinishToPartNumber: addFinishToPartNumber !== undefined ? Boolean(addFinishToPartNumber) : undefined,
        isCutListItem: isCutListItem !== undefined ? Boolean(isCutListItem) : undefined
      },
      include: {
        category: true
      }
    })

    return NextResponse.json(option)
  } catch (error) {
    console.error('Error updating option:', error)
    return NextResponse.json(
      { error: 'Failed to update option' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)

    // Delete the option
    await prisma.individualOption.delete({
      where: { id: optionId }
    })

    return NextResponse.json({ message: 'Option deleted successfully' })
  } catch (error) {
    console.error('Error deleting option:', error)
    return NextResponse.json(
      { error: 'Failed to delete option' },
      { status: 500 }
    )
  }
}
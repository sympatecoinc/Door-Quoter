import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const componentId = parseInt(id)
    
    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid component ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { subOptionSelections, includedOptions } = body

    if (!subOptionSelections || typeof subOptionSelections !== 'object') {
      return NextResponse.json(
        { error: 'Invalid subOptionSelections data' },
        { status: 400 }
      )
    }

    // Build update data object
    const updateData: any = {
      subOptionSelections: JSON.stringify(subOptionSelections)
    }

    // Add includedOptions if provided
    if (includedOptions !== undefined) {
      updateData.includedOptions = JSON.stringify(includedOptions)
    }

    // Update the component instance with the new option selections
    const updatedComponent = await prisma.componentInstance.update({
      where: { id: componentId },
      data: updateData
    })

    return NextResponse.json(updatedComponent)
  } catch (error) {
    console.error('Error updating component:', error)
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    )
  }
}
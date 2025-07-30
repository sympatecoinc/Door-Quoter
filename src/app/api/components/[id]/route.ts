import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const componentId = parseInt(params.id)
    
    if (isNaN(componentId)) {
      return NextResponse.json(
        { error: 'Invalid component ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { subOptionSelections } = body

    if (!subOptionSelections || typeof subOptionSelections !== 'object') {
      return NextResponse.json(
        { error: 'Invalid subOptionSelections data' },
        { status: 400 }
      )
    }

    // Update the component instance with the new option selections
    const updatedComponent = await prisma.componentInstance.update({
      where: { id: componentId },
      data: {
        subOptionSelections: JSON.stringify(subOptionSelections)
      }
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
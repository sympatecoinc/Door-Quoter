import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const body = await request.json()
    const { 
      name, 
      description, 
      basePrice, 
      formula, 
      minQuantity, 
      maxQuantity, 
      partType, 
      category, 
      isActive,
      masterPartId
    } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Name is required' 
      }, { status: 400 })
    }

    const updatedRule = await prisma.pricingRule.update({
      where: { id: parseInt(resolvedParams.id) },
      data: {
        name,
        description,
        basePrice: basePrice ? parseFloat(basePrice) : null,
        formula,
        minQuantity: minQuantity ? parseFloat(minQuantity) : null,
        maxQuantity: maxQuantity ? parseFloat(maxQuantity) : null,
        partType: partType || 'Hardware',
        category,
        isActive: isActive !== false,
        masterPartId: parseInt(masterPartId)
      },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true
          }
        }
      }
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating pricing rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    await prisma.pricingRule.delete({
      where: { id: parseInt(resolvedParams.id) }
    })

    return NextResponse.json({ message: 'Pricing rule deleted successfully' })
  } catch (error) {
    console.error('Error deleting pricing rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
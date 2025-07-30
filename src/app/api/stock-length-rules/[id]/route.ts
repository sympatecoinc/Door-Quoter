import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const rule = await prisma.stockLengthRule.findUnique({
      where: { id },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            unit: true
          }
        }
      }
    })

    if (!rule) {
      return NextResponse.json({ error: 'Stock length rule not found' }, { status: 404 })
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error fetching stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)
    const body = await request.json()
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const { 
      name, 
      minHeight, 
      maxHeight, 
      minWidth,
      maxWidth,
      stockLength,
      appliesTo, 
      partType, 
      isActive,
      basePrice,
      masterPartId
    } = body

    if (!name) {
      return NextResponse.json({ 
        error: 'Name is required' 
      }, { status: 400 })
    }

    // Validate that stockLength is provided
    if (!stockLength) {
      return NextResponse.json({ 
        error: 'Stock length is required' 
      }, { status: 400 })
    }

    const updatedRule = await prisma.stockLengthRule.update({
      where: { id },
      data: {
        name,
        minHeight: minHeight ? Number(minHeight) : null,
        maxHeight: maxHeight ? Number(maxHeight) : null,
        minWidth: minWidth ? Number(minWidth) : null,
        maxWidth: maxWidth ? Number(maxWidth) : null,
        stockLength: stockLength ? Number(stockLength) : null,
        appliesTo: appliesTo || 'height',
        partType: partType || 'Extrusion',
        isActive: isActive !== false,
        basePrice: basePrice ? Number(basePrice) : null,
        masterPartId: Number(masterPartId)
      },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            unit: true
          }
        }
      }
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    console.error('Error updating stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.stockLengthRule.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Stock length rule deleted successfully' })
  } catch (error) {
    console.error('Error deleting stock length rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
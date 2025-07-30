import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const panelId = searchParams.get('panelId')

    const where = panelId ? { panelId: parseInt(panelId) } : {}

    const componentInstances = await prisma.componentInstance.findMany({
      where,
      include: {
        product: true,
        panel: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(componentInstances)
  } catch (error) {
    console.error('Error fetching component instances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component instances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      panelId, 
      productId, 
      subOptionSelections = {} 
    } = await request.json()

    if (!panelId || !productId) {
      return NextResponse.json(
        { error: 'Panel ID and Product ID are required' },
        { status: 400 }
      )
    }

    // Check if panel exists
    const panel = await prisma.panel.findUnique({
      where: { id: parseInt(panelId) }
    })

    if (!panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      )
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if component instance already exists for this panel
    const existingInstance = await prisma.componentInstance.findUnique({
      where: { panelId: parseInt(panelId) }
    })

    if (existingInstance) {
      return NextResponse.json(
        { error: 'Panel already has a product assigned' },
        { status: 400 }
      )
    }

    const componentInstance = await prisma.componentInstance.create({
      data: {
        panelId: parseInt(panelId),
        productId: parseInt(productId),
        subOptionSelections: JSON.stringify(subOptionSelections)
      },
      include: {
        product: true,
        panel: true
      }
    })

    return NextResponse.json(componentInstance, { status: 201 })
  } catch (error) {
    console.error('Error creating component instance:', error)
    return NextResponse.json(
      { error: 'Failed to create component instance' },
      { status: 500 }
    )
  }
}
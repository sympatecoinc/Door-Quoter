import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/pricing-modes - List all pricing modes
export async function GET() {
  try {
    const modes = await prisma.pricingMode.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(modes)
  } catch (error) {
    console.error('Error fetching pricing modes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pricing modes' },
      { status: 500 }
    )
  }
}

// POST /api/pricing-modes - Create a new pricing mode
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { name, description, markup, extrusionMarkup, hardwareMarkup, glassMarkup, discount, isDefault, extrusionCostingMethod } = data

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const existing = await prisma.pricingMode.findUnique({
      where: { name: name.trim() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A pricing mode with this name already exists' },
        { status: 400 }
      )
    }

    // If this mode is set as default, unset all others
    if (isDefault) {
      await prisma.pricingMode.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const mode = await prisma.pricingMode.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        markup: parseFloat(markup) || 0,
        extrusionMarkup: parseFloat(extrusionMarkup) || 0,
        hardwareMarkup: parseFloat(hardwareMarkup) || 0,
        glassMarkup: parseFloat(glassMarkup) || 0,
        discount: parseFloat(discount) || 0,
        isDefault: Boolean(isDefault),
        extrusionCostingMethod: ['PERCENTAGE_BASED', 'HYBRID'].includes(extrusionCostingMethod) ? extrusionCostingMethod : 'FULL_STOCK'
      }
    })

    return NextResponse.json(mode, { status: 201 })
  } catch (error) {
    console.error('Error creating pricing mode:', error)
    return NextResponse.json(
      { error: 'Failed to create pricing mode' },
      { status: 500 }
    )
  }
}

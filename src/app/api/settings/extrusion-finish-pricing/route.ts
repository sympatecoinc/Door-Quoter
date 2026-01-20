import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch all extrusion finish pricing settings
export async function GET() {
  try {
    const finishPricing = await prisma.extrusionFinishPricing.findMany({
      orderBy: {
        finishType: 'asc'
      }
    })

    return NextResponse.json(finishPricing)
  } catch (error) {
    console.error('Error fetching extrusion finish pricing:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extrusion finish pricing' },
      { status: 500 }
    )
  }
}

// POST - Create new finish pricing entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { finishType, finishCode, costPerSqFt, isActive } = body

    if (!finishType) {
      return NextResponse.json(
        { error: 'Finish type is required' },
        { status: 400 }
      )
    }

    // Check if finish type already exists
    const existing = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Finish type already exists' },
        { status: 400 }
      )
    }

    const finishPricing = await prisma.extrusionFinishPricing.create({
      data: {
        finishType,
        finishCode: finishCode || null,
        costPerSqFt: costPerSqFt || 0,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json(finishPricing)
  } catch (error) {
    console.error('Error creating finish pricing:', error)
    return NextResponse.json(
      { error: 'Failed to create finish pricing' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const glassTypes = await prisma.glassType.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(glassTypes)
  } catch (error) {
    console.error('Error fetching glass types:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, pricePerSqFt } = body

    if (!name || !name.trim()) {
      return NextResponse.json({
        error: 'Glass type name is required'
      }, { status: 400 })
    }

    if (pricePerSqFt === undefined || pricePerSqFt === null || isNaN(parseFloat(pricePerSqFt.toString()))) {
      return NextResponse.json({
        error: 'Valid price per square foot is required'
      }, { status: 400 })
    }

    // Check if glass type name already exists
    const existingGlassType = await prisma.glassType.findUnique({
      where: { name: name.trim() }
    })

    if (existingGlassType) {
      return NextResponse.json({
        error: 'Glass type with this name already exists'
      }, { status: 409 })
    }

    const newGlassType = await prisma.glassType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        pricePerSqFt: parseFloat(pricePerSqFt.toString())
      }
    })

    return NextResponse.json(newGlassType)
  } catch (error) {
    console.error('Error creating glass type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

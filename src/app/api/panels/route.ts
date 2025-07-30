import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const openingId = searchParams.get('openingId')

    const where = openingId ? { openingId: parseInt(openingId) } : {}

    const panels = await prisma.panel.findMany({
      where,
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(panels)
  } catch (error) {
    console.error('Error fetching panels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch panels' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      openingId, 
      type, 
      width, 
      height, 
      glassType, 
      locking, 
      swingDirection = 'None',
      slidingDirection = 'Left',
      isCorner = false,
      cornerDirection = 'Up'
    } = await request.json()

    if (!openingId || !type) {
      return NextResponse.json(
        { error: 'Opening ID and type are required' },
        { status: 400 }
      )
    }

    const panel = await prisma.panel.create({
      data: {
        openingId: parseInt(openingId),
        type,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        glassType: glassType || 'N/A',
        locking: locking || 'N/A',
        swingDirection,
        slidingDirection,
        isCorner,
        cornerDirection
      },
      include: {
        componentInstance: {
          include: {
            product: true
          }
        }
      }
    })

    return NextResponse.json(panel, { status: 201 })
  } catch (error) {
    console.error('Error creating panel:', error)
    return NextResponse.json(
      { error: 'Failed to create panel' },
      { status: 500 }
    )
  }
}
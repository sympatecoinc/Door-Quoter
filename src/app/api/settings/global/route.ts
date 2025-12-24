import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch global settings (optionally filter by key or category)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const category = searchParams.get('category')

    if (key) {
      // Fetch single setting by key
      const setting = await prisma.globalSetting.findUnique({
        where: { key }
      })

      if (!setting) {
        return NextResponse.json(
          { error: `Setting '${key}' not found` },
          { status: 404 }
        )
      }

      return NextResponse.json(setting)
    }

    // Fetch all settings (optionally filtered by category)
    const where = category ? { category } : {}
    const settings = await prisma.globalSetting.findMany({
      where,
      orderBy: { key: 'asc' }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching global settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch global settings' },
      { status: 500 }
    )
  }
}

// PUT - Update a global setting by key
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      )
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      )
    }

    const setting = await prisma.globalSetting.update({
      where: { key },
      data: { value: String(value) }
    })

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Error updating global setting:', error)
    return NextResponse.json(
      { error: 'Failed to update global setting' },
      { status: 500 }
    )
  }
}

// POST - Create a new global setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { key, value, dataType = 'string', category, description } = body

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      )
    }

    if (value === undefined || value === null) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      )
    }

    // Check if setting already exists
    const existing = await prisma.globalSetting.findUnique({
      where: { key }
    })

    if (existing) {
      return NextResponse.json(
        { error: `Setting '${key}' already exists` },
        { status: 409 }
      )
    }

    const setting = await prisma.globalSetting.create({
      data: {
        key,
        value: String(value),
        dataType,
        category,
        description
      }
    })

    return NextResponse.json(setting, { status: 201 })
  } catch (error) {
    console.error('Error creating global setting:', error)
    return NextResponse.json(
      { error: 'Failed to create global setting' },
      { status: 500 }
    )
  }
}

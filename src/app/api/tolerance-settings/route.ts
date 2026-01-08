import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Default tolerance values
const DEFAULT_TOLERANCES = {
  thinwallWidthTolerance: 1.0,
  thinwallHeightTolerance: 1.5,
  framedWidthTolerance: 0.5,
  framedHeightTolerance: 0.75
}

// GET - Fetch global tolerance defaults for both opening types
export async function GET() {
  try {
    const settings = await prisma.toleranceSettings.findFirst({
      where: { name: 'default' }
    })

    if (!settings) {
      // Return defaults if no settings exist yet
      return NextResponse.json(DEFAULT_TOLERANCES)
    }

    return NextResponse.json({
      id: settings.id,
      name: settings.name,
      thinwallWidthTolerance: settings.thinwallWidthTolerance,
      thinwallHeightTolerance: settings.thinwallHeightTolerance,
      framedWidthTolerance: settings.framedWidthTolerance,
      framedHeightTolerance: settings.framedHeightTolerance,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    })
  } catch (error) {
    console.error('Error fetching tolerance settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tolerance settings' },
      { status: 500 }
    )
  }
}

// PUT - Update global tolerance defaults
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      thinwallWidthTolerance,
      thinwallHeightTolerance,
      framedWidthTolerance,
      framedHeightTolerance
    } = body

    // Validate all tolerance values are provided and are numbers
    const tolerances = {
      thinwallWidthTolerance,
      thinwallHeightTolerance,
      framedWidthTolerance,
      framedHeightTolerance
    }

    for (const [key, value] of Object.entries(tolerances)) {
      if (value === undefined || value === null) {
        return NextResponse.json(
          { error: `${key} is required` },
          { status: 400 }
        )
      }
      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json(
          { error: `${key} must be a non-negative number` },
          { status: 400 }
        )
      }
    }

    // Upsert the default tolerance settings
    const settings = await prisma.toleranceSettings.upsert({
      where: { name: 'default' },
      update: {
        thinwallWidthTolerance,
        thinwallHeightTolerance,
        framedWidthTolerance,
        framedHeightTolerance
      },
      create: {
        name: 'default',
        thinwallWidthTolerance,
        thinwallHeightTolerance,
        framedWidthTolerance,
        framedHeightTolerance
      }
    })

    return NextResponse.json({
      id: settings.id,
      name: settings.name,
      thinwallWidthTolerance: settings.thinwallWidthTolerance,
      thinwallHeightTolerance: settings.thinwallHeightTolerance,
      framedWidthTolerance: settings.framedWidthTolerance,
      framedHeightTolerance: settings.framedHeightTolerance,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    })
  } catch (error) {
    console.error('Error updating tolerance settings:', error)
    return NextResponse.json(
      { error: 'Failed to update tolerance settings' },
      { status: 500 }
    )
  }
}

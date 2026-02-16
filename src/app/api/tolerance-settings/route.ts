import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TOLERANCE_KEYS = {
  thinwallWidth: 'tolerance.thinwall.width',
  thinwallHeight: 'tolerance.thinwall.height',
  framedWidth: 'tolerance.framed.width',
  framedHeight: 'tolerance.framed.height',
} as const

const DEFAULTS = {
  thinwallWidthTolerance: 1.0,
  thinwallHeightTolerance: 1.5,
  framedWidthTolerance: 0.5,
  framedHeightTolerance: 0.75,
}

export async function GET() {
  try {
    const settings = await prisma.globalSetting.findMany({
      where: { category: 'tolerances' }
    })

    const map = new Map(settings.map(s => [s.key, parseFloat(s.value)]))

    return NextResponse.json({
      thinwallWidthTolerance: map.get(TOLERANCE_KEYS.thinwallWidth) ?? DEFAULTS.thinwallWidthTolerance,
      thinwallHeightTolerance: map.get(TOLERANCE_KEYS.thinwallHeight) ?? DEFAULTS.thinwallHeightTolerance,
      framedWidthTolerance: map.get(TOLERANCE_KEYS.framedWidth) ?? DEFAULTS.framedWidthTolerance,
      framedHeightTolerance: map.get(TOLERANCE_KEYS.framedHeight) ?? DEFAULTS.framedHeightTolerance,
    })
  } catch (error) {
    console.error('Error fetching tolerance settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tolerance settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      thinwallWidthTolerance,
      thinwallHeightTolerance,
      framedWidthTolerance,
      framedHeightTolerance,
    } = body

    const updates = [
      { key: TOLERANCE_KEYS.thinwallWidth, value: thinwallWidthTolerance, description: 'ThinWall width tolerance (inches)' },
      { key: TOLERANCE_KEYS.thinwallHeight, value: thinwallHeightTolerance, description: 'ThinWall height tolerance (inches)' },
      { key: TOLERANCE_KEYS.framedWidth, value: framedWidthTolerance, description: 'Framed width tolerance (inches)' },
      { key: TOLERANCE_KEYS.framedHeight, value: framedHeightTolerance, description: 'Framed height tolerance (inches)' },
    ]

    await Promise.all(
      updates.map(({ key, value, description }) =>
        prisma.globalSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: {
            key,
            value: String(value),
            dataType: 'number',
            category: 'tolerances',
            description,
          },
        })
      )
    )

    return NextResponse.json({
      thinwallWidthTolerance,
      thinwallHeightTolerance,
      framedWidthTolerance,
      framedHeightTolerance,
    })
  } catch (error) {
    console.error('Error updating tolerance settings:', error)
    return NextResponse.json(
      { error: 'Failed to update tolerance settings' },
      { status: 500 }
    )
  }
}

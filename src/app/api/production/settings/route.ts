import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_BATCH_SIZE_KEY = 'production.defaultBatchSize'

export async function GET() {
  try {
    const setting = await prisma.globalSetting.findUnique({
      where: { key: DEFAULT_BATCH_SIZE_KEY }
    })

    return NextResponse.json({
      defaultBatchSize: setting ? parseInt(setting.value) : null
    })
  } catch (error) {
    console.error('Error fetching production settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch production settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { defaultBatchSize } = await request.json()

    // Validate: must be null or positive integer
    if (defaultBatchSize !== null) {
      const parsed = parseInt(defaultBatchSize)
      if (isNaN(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: 'Default batch size must be a positive integer or null' },
          { status: 400 }
        )
      }
    }

    if (defaultBatchSize === null) {
      // Delete the setting if null
      await prisma.globalSetting.deleteMany({
        where: { key: DEFAULT_BATCH_SIZE_KEY }
      })
    } else {
      // Upsert the setting
      await prisma.globalSetting.upsert({
        where: { key: DEFAULT_BATCH_SIZE_KEY },
        update: { value: defaultBatchSize.toString() },
        create: {
          key: DEFAULT_BATCH_SIZE_KEY,
          value: defaultBatchSize.toString(),
          dataType: 'number',
          category: 'production',
          description: 'Default batch size for cut lists (null = all units)'
        }
      })
    }

    return NextResponse.json({
      defaultBatchSize: defaultBatchSize
    })
  } catch (error) {
    console.error('Error updating production settings:', error)
    return NextResponse.json(
      { error: 'Failed to update production settings' },
      { status: 500 }
    )
  }
}

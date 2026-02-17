import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const where = includeArchived ? {} : { isArchived: false }

    const presets = await prisma.openingPreset.findMany({
      where,
      include: {
        frameProduct: {
          select: { id: true, name: true, jambThickness: true }
        },
        panels: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                elevationImageData: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        parts: {
          include: {
            masterPart: {
              select: {
                id: true,
                partNumber: true,
                baseName: true,
                description: true,
                partType: true,
                unit: true,
                cost: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: {
            panels: true,
            parts: true,
            appliedOpenings: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ presets })
  } catch (error) {
    console.error('Error fetching opening presets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opening presets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const {
      name,
      description,
      defaultRoughWidth,
      defaultRoughHeight,
      defaultFinishedWidth,
      defaultFinishedHeight,
      isFinishedOpening = false,
      openingType,
      widthToleranceTotal,
      heightToleranceTotal,
      includeStarterChannels = false,
      frameProductId,
      panels = [],
      parts = []
    } = data

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Preset name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate name among active (non-archived) presets
    const existing = await prisma.openingPreset.findFirst({
      where: { name: name.trim(), isArchived: false }
    })
    if (existing) {
      return NextResponse.json(
        { error: 'A preset with this name already exists' },
        { status: 400 }
      )
    }

    // Validate openingType if isFinishedOpening is true
    if (isFinishedOpening && openingType && !['THINWALL', 'FRAMED'].includes(openingType)) {
      return NextResponse.json(
        { error: 'Invalid opening type. Must be THINWALL or FRAMED' },
        { status: 400 }
      )
    }

    // Create preset with nested panels and parts
    const preset = await prisma.openingPreset.create({
      data: {
        name: name.trim(),
        description: description || null,
        defaultRoughWidth: defaultRoughWidth ?? null,
        defaultRoughHeight: defaultRoughHeight ?? null,
        defaultFinishedWidth: defaultFinishedWidth ?? null,
        defaultFinishedHeight: defaultFinishedHeight ?? null,
        isFinishedOpening: openingType === 'THINWALL' || openingType === 'FRAMED',
        openingType: openingType || null,
        frameProductId: openingType === 'FRAMED' ? (frameProductId || null) : null,
        includeStarterChannels,
        panels: {
          create: panels.map((panel: any, index: number) => ({
            type: panel.type || 'Component',
            productId: panel.productId || null,
            widthFormula: panel.widthFormula || null,
            heightFormula: panel.heightFormula || null,
            glassType: panel.glassType || 'Clear',
            locking: panel.locking || 'None',
            swingDirection: panel.swingDirection || 'None',
            slidingDirection: panel.slidingDirection || 'Left',
            subOptionSelections: panel.subOptionSelections || '{}',
            includedOptions: panel.includedOptions || '[]',
            variantSelections: panel.variantSelections || '{}',
            displayOrder: panel.displayOrder ?? index
          }))
        },
        parts: {
          create: parts
            .filter((part: any) => part.masterPartId) // Only create parts with masterPartId
            .map((part: any, index: number) => ({
              masterPartId: part.masterPartId,
              formula: part.formula || null,
              quantity: part.quantity ?? null,
              displayOrder: part.displayOrder ?? index
            }))
        }
      },
      include: {
        frameProduct: {
          select: { id: true, name: true, jambThickness: true }
        },
        panels: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        parts: {
          include: {
            masterPart: {
              select: {
                id: true,
                partNumber: true,
                baseName: true,
                description: true,
                partType: true,
                unit: true,
                cost: true
              }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: {
            panels: true,
            parts: true,
            appliedOpenings: true
          }
        }
      }
    })

    return NextResponse.json(preset, { status: 201 })
  } catch (error) {
    console.error('Error creating opening preset:', error)
    return NextResponse.json(
      { error: 'Failed to create opening preset' },
      { status: 500 }
    )
  }
}

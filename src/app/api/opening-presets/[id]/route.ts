import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const presetId = parseInt(id)

    if (isNaN(presetId)) {
      return NextResponse.json(
        { error: 'Invalid preset ID' },
        { status: 400 }
      )
    }

    const preset = await prisma.openingPreset.findUnique({
      where: { id: presetId },
      include: {
        panels: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                productCategory: true
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

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(preset)
  } catch (error) {
    console.error('Error fetching opening preset:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opening preset' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const presetId = parseInt(id)

    if (isNaN(presetId)) {
      return NextResponse.json(
        { error: 'Invalid preset ID' },
        { status: 400 }
      )
    }

    const data = await request.json()
    const {
      name,
      description,
      defaultRoughWidth,
      defaultRoughHeight,
      defaultFinishedWidth,
      defaultFinishedHeight,
      isFinishedOpening,
      openingType,
      widthToleranceTotal,
      heightToleranceTotal,
      includeStarterChannels,
      isArchived,
      panels,
      parts
    } = data

    // Check preset exists
    const existing = await prisma.openingPreset.findUnique({
      where: { id: presetId }
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    // Check for duplicate name (if name changed, only among non-archived presets)
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.openingPreset.findFirst({
        where: { name: name.trim(), isArchived: false, id: { not: presetId } }
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'A preset with this name already exists' },
          { status: 400 }
        )
      }
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description || null
    if (defaultRoughWidth !== undefined) updateData.defaultRoughWidth = defaultRoughWidth ?? null
    if (defaultRoughHeight !== undefined) updateData.defaultRoughHeight = defaultRoughHeight ?? null
    if (defaultFinishedWidth !== undefined) updateData.defaultFinishedWidth = defaultFinishedWidth ?? null
    if (defaultFinishedHeight !== undefined) updateData.defaultFinishedHeight = defaultFinishedHeight ?? null
    if (isFinishedOpening !== undefined) updateData.isFinishedOpening = isFinishedOpening
    if (openingType !== undefined) updateData.openingType = openingType || null
    if (widthToleranceTotal !== undefined) updateData.widthToleranceTotal = widthToleranceTotal ?? null
    if (heightToleranceTotal !== undefined) updateData.heightToleranceTotal = heightToleranceTotal ?? null
    if (includeStarterChannels !== undefined) updateData.includeStarterChannels = includeStarterChannels
    if (isArchived !== undefined) updateData.isArchived = isArchived

    // Use transaction to update preset and replace panels/parts
    const preset = await prisma.$transaction(async (tx) => {
      // Update preset base data
      await tx.openingPreset.update({
        where: { id: presetId },
        data: updateData
      })

      // Replace panels if provided
      if (panels !== undefined) {
        // Delete existing panels
        await tx.openingPresetPanel.deleteMany({
          where: { presetId }
        })
        // Create new panels
        if (panels.length > 0) {
          await tx.openingPresetPanel.createMany({
            data: panels.map((panel: any, index: number) => ({
              presetId,
              type: panel.type || 'Swing Door',
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
          })
        }
      }

      // Replace parts if provided
      if (parts !== undefined) {
        // Delete existing parts (this will cascade to part instances)
        await tx.openingPresetPart.deleteMany({
          where: { presetId }
        })
        // Create new parts - only those with masterPartId
        const validParts = parts.filter((part: any) => part.masterPartId)
        if (validParts.length > 0) {
          await tx.openingPresetPart.createMany({
            data: validParts.map((part: any, index: number) => ({
              presetId,
              masterPartId: part.masterPartId,
              formula: part.formula || null,
              quantity: part.quantity ?? null,
              displayOrder: part.displayOrder ?? index
            }))
          })
        }
      }

      // Return updated preset with relations
      return tx.openingPreset.findUnique({
        where: { id: presetId },
        include: {
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
    })

    return NextResponse.json(preset)
  } catch (error) {
    console.error('Error updating opening preset:', error)
    return NextResponse.json(
      { error: 'Failed to update opening preset' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const presetId = parseInt(id)

    if (isNaN(presetId)) {
      return NextResponse.json(
        { error: 'Invalid preset ID' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    const preset = await prisma.openingPreset.findUnique({
      where: { id: presetId },
      include: {
        _count: {
          select: { appliedOpenings: true }
        }
      }
    })

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    if (hardDelete) {
      // Hard delete - only if no applied openings
      if (preset._count.appliedOpenings > 0) {
        return NextResponse.json(
          { error: 'Cannot delete preset that has been applied to openings. Use archive instead.' },
          { status: 400 }
        )
      }
      await prisma.openingPreset.delete({
        where: { id: presetId }
      })
    } else {
      // Soft delete (archive)
      await prisma.openingPreset.update({
        where: { id: presetId },
        data: { isArchived: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting opening preset:', error)
    return NextResponse.json(
      { error: 'Failed to delete opening preset' },
      { status: 500 }
    )
  }
}

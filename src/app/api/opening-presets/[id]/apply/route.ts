import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked, createLockedError } from '@/lib/project-status'
import { evaluatePresetFormula, PresetFormulaVariables } from '@/lib/preset-formulas'

export async function POST(
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
      projectId,
      name,
      roughWidth,
      roughHeight,
      finishedWidth,
      finishedHeight,
      finishColor // Optional override
    } = data

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Opening name is required' },
        { status: 400 }
      )
    }

    // Check if project exists and is not locked
    const project = await prisma.project.findUnique({
      where: { id: parseInt(projectId) },
      select: { status: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (isProjectLocked(project.status)) {
      return NextResponse.json(createLockedError(project.status), { status: 403 })
    }

    // Check for duplicate opening name
    const existingOpening = await prisma.opening.findFirst({
      where: {
        projectId: parseInt(projectId),
        name: name.trim()
      }
    })

    if (existingOpening) {
      return NextResponse.json(
        { error: 'Opening name already exists for this project' },
        { status: 400 }
      )
    }

    // Fetch preset with panels and parts
    const preset = await prisma.openingPreset.findUnique({
      where: { id: presetId },
      include: {
        panels: {
          orderBy: { displayOrder: 'asc' }
        },
        parts: {
          include: {
            masterPart: true
          },
          orderBy: { displayOrder: 'asc' }
        }
      }
    })

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    if (preset.isArchived) {
      return NextResponse.json(
        { error: 'Cannot apply an archived preset' },
        { status: 400 }
      )
    }

    // Determine dimensions - use provided values or preset defaults
    const finalRoughWidth = roughWidth ?? preset.defaultRoughWidth
    const finalRoughHeight = roughHeight ?? preset.defaultRoughHeight
    let finalFinishedWidth = finishedWidth ?? preset.defaultFinishedWidth
    let finalFinishedHeight = finishedHeight ?? preset.defaultFinishedHeight

    // If finished dimensions not provided, default to rough dimensions
    if (finalFinishedWidth === null || finalFinishedWidth === undefined) {
      finalFinishedWidth = finalRoughWidth
    }
    if (finalFinishedHeight === null || finalFinishedHeight === undefined) {
      finalFinishedHeight = finalRoughHeight
    }

    // Validate that we have at least some dimensions
    if (!finalRoughWidth && !finalFinishedWidth) {
      return NextResponse.json(
        { error: 'At least rough or finished width is required' },
        { status: 400 }
      )
    }
    if (!finalRoughHeight && !finalFinishedHeight) {
      return NextResponse.json(
        { error: 'At least rough or finished height is required' },
        { status: 400 }
      )
    }

    // Default rough to finished if not provided
    const effectiveRoughWidth = finalRoughWidth ?? finalFinishedWidth!
    const effectiveRoughHeight = finalRoughHeight ?? finalFinishedHeight!
    const effectiveFinishedWidth = finalFinishedWidth ?? finalRoughWidth!
    const effectiveFinishedHeight = finalFinishedHeight ?? finalRoughHeight!

    // Build formula variables for evaluation
    const formulaVariables: PresetFormulaVariables = {
      roughWidth: effectiveRoughWidth,
      roughHeight: effectiveRoughHeight,
      finishedWidth: effectiveFinishedWidth,
      finishedHeight: effectiveFinishedHeight
    }

    // Create opening, panels, component instances, and part instances in a transaction
    const opening = await prisma.$transaction(async (tx) => {
      // Create the opening
      const newOpening = await tx.opening.create({
        data: {
          projectId: parseInt(projectId),
          name: name.trim(),
          roughWidth: effectiveRoughWidth,
          roughHeight: effectiveRoughHeight,
          finishedWidth: effectiveFinishedWidth,
          finishedHeight: effectiveFinishedHeight,
          price: 0,
          isFinishedOpening: preset.isFinishedOpening,
          openingType: preset.openingType,
          widthToleranceTotal: preset.widthToleranceTotal,
          heightToleranceTotal: preset.heightToleranceTotal,
          finishColor: finishColor || null,
          includeStarterChannels: preset.includeStarterChannels,
          presetId: preset.id
        }
      })

      // Create panels from preset panels
      for (const presetPanel of preset.panels) {
        // Evaluate dimension formulas
        const formulaWidth = evaluatePresetFormula(presetPanel.widthFormula, formulaVariables)
        const formulaHeight = evaluatePresetFormula(presetPanel.heightFormula, formulaVariables)

        // Default to opening dimensions if formula evaluation fails or no formula
        const panelWidth = formulaWidth ?? effectiveFinishedWidth
        const panelHeight = formulaHeight ?? effectiveFinishedHeight

        // Create the panel
        const newPanel = await tx.panel.create({
          data: {
            openingId: newOpening.id,
            type: presetPanel.type,
            width: panelWidth,
            height: panelHeight,
            glassType: presetPanel.glassType,
            locking: presetPanel.locking,
            swingDirection: presetPanel.swingDirection,
            slidingDirection: presetPanel.slidingDirection,
            displayOrder: presetPanel.displayOrder
          }
        })

        // Create component instance if product is assigned
        if (presetPanel.productId) {
          await tx.componentInstance.create({
            data: {
              panelId: newPanel.id,
              productId: presetPanel.productId,
              subOptionSelections: presetPanel.subOptionSelections,
              includedOptions: presetPanel.includedOptions,
              variantSelections: presetPanel.variantSelections
            }
          })
        }
      }

      // Create preset part instances
      for (const presetPart of preset.parts) {
        // Evaluate formula or use fixed quantity
        let calculatedQuantity: number
        if (presetPart.formula) {
          const formulaResult = evaluatePresetFormula(presetPart.formula, formulaVariables)
          calculatedQuantity = formulaResult ?? presetPart.quantity ?? 1
        } else {
          calculatedQuantity = presetPart.quantity ?? 1
        }

        await tx.openingPresetPartInstance.create({
          data: {
            openingId: newOpening.id,
            presetPartId: presetPart.id,
            calculatedQuantity,
            calculatedCost: 0 // Will be calculated by pricing calculator
          }
        })
      }

      // Return the opening with all relations
      return tx.opening.findUnique({
        where: { id: newOpening.id },
        include: {
          panels: {
            include: {
              componentInstance: {
                include: {
                  product: {
                    include: {
                      productBOMs: {
                        include: {
                          option: true
                        }
                      },
                      productSubOptions: {
                        include: {
                          category: {
                            include: {
                              individualOptions: {
                                include: {
                                  variants: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { displayOrder: 'asc' }
          },
          preset: {
            select: {
              id: true,
              name: true
            }
          },
          presetPartInstances: {
            include: {
              presetPart: true
            }
          }
        }
      })
    })

    return NextResponse.json(opening, { status: 201 })
  } catch (error) {
    console.error('Error applying opening preset:', error)
    return NextResponse.json(
      { error: 'Failed to apply opening preset' },
      { status: 500 }
    )
  }
}

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
      openingId, // Optional: apply preset to an existing opening
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

    // Name is only required when creating a new opening
    if (!openingId && (!name || name.trim() === '')) {
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

    // Skip duplicate name check when applying to existing opening
    if (!openingId) {
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
    }

    // If openingId provided, verify the opening exists
    if (openingId) {
      const targetOpening = await prisma.opening.findUnique({
        where: { id: parseInt(openingId) }
      })
      if (!targetOpening) {
        return NextResponse.json(
          { error: 'Opening not found' },
          { status: 404 }
        )
      }
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
    // Tolerances are applied later in the project configurator based on opening type
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

    // Determine opening-level frameProductId and jambThickness from preset products
    let jambThickness = 0
    let openingFrameProductId: number | null = null
    const presetProductIds = preset.panels.map(p => p.productId).filter(Boolean) as number[]
    if (presetProductIds.length > 0) {
      const presetProducts = await prisma.product.findMany({
        where: { id: { in: presetProductIds } },
        select: {
          id: true,
          productType: true,
          jambThickness: true,
          frameConfig: { select: { id: true, jambThickness: true } },
          frameAssignments: { select: { frameProductId: true } }
        }
      })
      // Check if any preset panel product is itself a FRAME with jambThickness
      for (const pp of presetProducts) {
        if (pp.productType === 'FRAME' && pp.jambThickness) {
          jambThickness = pp.jambThickness
          openingFrameProductId = pp.id
          break
        }
      }
      // If no direct FRAME product, determine frame from frameAssignments or frameConfig
      if (jambThickness === 0) {
        for (const pp of presetProducts) {
          // Check many-to-many frame assignments first
          if (pp.frameAssignments?.length > 0) {
            const frameId = pp.frameAssignments[0].frameProductId
            const frameProd = await prisma.product.findUnique({
              where: { id: frameId },
              select: { id: true, jambThickness: true }
            })
            if (frameProd) {
              openingFrameProductId = frameProd.id
              jambThickness = frameProd.jambThickness || 0
              break
            }
          }
          // Legacy fallback: check frameConfig
          if (pp.frameConfig?.jambThickness) {
            jambThickness = pp.frameConfig.jambThickness
            openingFrameProductId = pp.frameConfig.id
            break
          }
        }
      }
    }

    // Compute interior dimensions
    const interiorWidth = jambThickness > 0 ? effectiveFinishedWidth - (2 * jambThickness) : effectiveFinishedWidth
    const interiorHeight = jambThickness > 0 ? effectiveFinishedHeight - jambThickness : effectiveFinishedHeight

    // Build formula variables for evaluation
    const formulaVariables: PresetFormulaVariables = {
      roughWidth: effectiveRoughWidth,
      roughHeight: effectiveRoughHeight,
      finishedWidth: effectiveFinishedWidth,
      finishedHeight: effectiveFinishedHeight,
      interiorWidth,
      interiorHeight,
      jambThickness
    }

    // Validate that preset panel dimensions fit within the opening
    const openingConstraintWidth = effectiveFinishedWidth
    const openingConstraintHeight = effectiveFinishedHeight
    let cumulativePanelWidth = 0

    for (const presetPanel of preset.panels) {
      const formulaWidth = evaluatePresetFormula(presetPanel.widthFormula, formulaVariables)
      const formulaHeight = evaluatePresetFormula(presetPanel.heightFormula, formulaVariables)
      const panelWidth = formulaWidth ?? effectiveFinishedWidth
      const panelHeight = formulaHeight ?? effectiveFinishedHeight

      if (panelHeight > openingConstraintHeight) {
        return NextResponse.json(
          { error: `Panel "${presetPanel.type}" height (${panelHeight}") exceeds opening height (${openingConstraintHeight}")` },
          { status: 400 }
        )
      }

      cumulativePanelWidth += panelWidth
    }

    if (cumulativePanelWidth > openingConstraintWidth) {
      return NextResponse.json(
        { error: `Total panel width (${cumulativePanelWidth.toFixed(3)}") exceeds opening width (${openingConstraintWidth}")` },
        { status: 400 }
      )
    }

    // Create or update opening, panels, component instances, and part instances in a transaction
    const opening = await prisma.$transaction(async (tx) => {
      let newOpening: any

      if (openingId) {
        // Update existing opening with preset metadata and dimensions
        newOpening = await tx.opening.update({
          where: { id: parseInt(openingId) },
          data: {
            roughWidth: effectiveRoughWidth,
            roughHeight: effectiveRoughHeight,
            finishedWidth: effectiveFinishedWidth,
            finishedHeight: effectiveFinishedHeight,
            isFinishedOpening: preset.isFinishedOpening,
            openingType: preset.openingType,
            includeStarterChannels: preset.includeStarterChannels,
            presetId: preset.id,
            frameProductId: openingFrameProductId
          }
        })
      } else {
        // Create the opening
        newOpening = await tx.opening.create({
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
            finishColor: finishColor || null,
            includeStarterChannels: preset.includeStarterChannels,
            presetId: preset.id,
            frameProductId: openingFrameProductId
          }
        })
      }

      // Create ONE frame panel for the opening (if frame product is set)
      if (openingFrameProductId) {
        const frameWidth = effectiveRoughWidth ?? effectiveFinishedWidth
        const frameHeight = effectiveRoughHeight ?? effectiveFinishedHeight

        const framePanel = await tx.panel.create({
          data: {
            openingId: newOpening.id,
            type: 'Component',
            width: frameWidth,
            height: frameHeight,
            glassType: 'N/A',
            locking: 'N/A',
            swingDirection: 'None',
            slidingDirection: 'Left',
            displayOrder: 9000 // Place after all preset panels
          }
        })

        await tx.componentInstance.create({
          data: {
            panelId: framePanel.id,
            productId: openingFrameProductId,
            subOptionSelections: '{}',
            includedOptions: '[]',
            variantSelections: '{}'
          }
        })
      }

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
            glassType: '',  // Leave empty so user selects during configuration
            locking: presetPanel.locking,
            swingDirection: presetPanel.swingDirection,
            slidingDirection: presetPanel.slidingDirection,
            displayOrder: presetPanel.displayOrder
          }
        })

        // Create component instance if product is assigned
        if (presetPanel.productId) {
          // Fetch product with sub-options and frame config so we can backfill missing selections
          // and auto-add frame panels
          const product = await tx.product.findUnique({
            where: { id: presetPanel.productId },
            include: {
              frameConfig: true,
              productSubOptions: {
                include: {
                  category: {
                    include: {
                      individualOptions: {
                        include: { variants: true }
                      }
                    }
                  }
                }
              }
            }
          })

          let parsedSelections: Record<string, number> = {}
          let parsedVariants: Record<string, number> = {}
          try {
            parsedSelections = JSON.parse(presetPanel.subOptionSelections || '{}')
          } catch { parsedSelections = {} }
          try {
            parsedVariants = JSON.parse(presetPanel.variantSelections || '{}')
          } catch { parsedVariants = {} }

          // Backfill subOptionSelections and variantSelections with standard
          // defaults for any categories not already in the preset
          if (product?.productSubOptions?.length) {
            const defaultSelections: Record<string, number> = { ...parsedSelections }
            const defaultVariants: Record<string, number> = { ...parsedVariants }
            let hasBackfill = false

            for (const pso of product.productSubOptions) {
              if (pso.standardOptionId) {
                const catKey = String(pso.categoryId)
                if (!(catKey in defaultSelections)) {
                  defaultSelections[catKey] = pso.standardOptionId
                  hasBackfill = true
                }

                const standardOpt = pso.category.individualOptions.find(
                  (io: any) => io.id === pso.standardOptionId
                )
                if (standardOpt && standardOpt.variants && standardOpt.variants.length > 0 && !(catKey in defaultVariants)) {
                  defaultVariants[catKey] = standardOpt.variants[0].id
                  hasBackfill = true
                }
              }
            }

            if (hasBackfill) {
              parsedSelections = defaultSelections
              parsedVariants = defaultVariants
            }
          }

          await tx.componentInstance.create({
            data: {
              panelId: newPanel.id,
              productId: presetPanel.productId,
              subOptionSelections: JSON.stringify(parsedSelections),
              includedOptions: presetPanel.includedOptions || '[]',
              variantSelections: JSON.stringify(parsedVariants)
            }
          })

          // Legacy: Auto-add frame panel if product has a frame config
          // Skip if opening-level frame is already set (ONE frame per opening created above)
          if (!openingFrameProductId && product?.frameConfig && product.frameConfig.id !== presetPanel.productId) {
            const framePanel = await tx.panel.create({
              data: {
                openingId: newOpening.id,
                type: 'Component',
                width: effectiveFinishedWidth,
                height: effectiveFinishedHeight,
                glassType: 'N/A',
                locking: 'N/A',
                swingDirection: 'None',
                slidingDirection: 'Left',
                displayOrder: presetPanel.displayOrder + 1000, // Place after all preset panels
                parentPanelId: newPanel.id
              }
            })

            await tx.componentInstance.create({
              data: {
                panelId: framePanel.id,
                productId: product.frameConfig.id,
                subOptionSelections: '{}',
                includedOptions: '[]',
                variantSelections: '{}'
              }
            })
          }
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
                      planViews: true,
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
                                  variants: true,
                                  linkedParts: {
                                    select: {
                                      id: true,
                                      masterPartId: true,
                                      variantId: true,
                                      quantity: true,
                                      masterPart: {
                                        select: { id: true, partNumber: true, baseName: true }
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
              presetPart: {
                include: {
                  masterPart: {
                    select: { id: true, partNumber: true, baseName: true }
                  }
                }
              }
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

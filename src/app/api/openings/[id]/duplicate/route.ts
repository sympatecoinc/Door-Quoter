import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const openingId = parseInt(id)
    const { baseName, count = 1, autoIncrement = false } = await request.json()

    // Validate inputs
    if (!baseName || baseName.trim() === '') {
      return NextResponse.json(
        { error: 'Base name is required' },
        { status: 400 }
      )
    }

    // Validate count
    const duplicateCount = parseInt(count.toString())
    if (isNaN(duplicateCount) || duplicateCount < 1 || duplicateCount > 50) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 50' },
        { status: 400 }
      )
    }

    // Get the original opening with all relations
    const originalOpening = await prisma.opening.findUnique({
      where: { id: openingId },
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: true
              }
            }
          }
        }
      }
    })

    if (!originalOpening) {
      return NextResponse.json(
        { error: 'Opening not found' },
        { status: 404 }
      )
    }

    const trimmedBaseName = baseName.trim()
    const createdOpenings = []

    // If auto-increment is enabled, rename original and create numbered duplicates
    if (autoIncrement) {
      // Generate all names that will be used (including original)
      const allNames = []
      for (let i = 1; i <= duplicateCount + 1; i++) {
        allNames.push(`${trimmedBaseName} ${i}`)
      }

      // Check if any of these names already exist (excluding the original opening itself)
      const existingOpenings = await prisma.opening.findMany({
        where: {
          projectId: originalOpening.projectId,
          name: { in: allNames },
          id: { not: openingId }
        }
      })

      if (existingOpenings.length > 0) {
        const conflictingNames = existingOpenings.map(o => o.name).join(', ')
        return NextResponse.json(
          { error: `Opening name(s) already exist: ${conflictingNames}` },
          { status: 400 }
        )
      }

      // Rename the original opening to "{baseName} 1"
      await prisma.opening.update({
        where: { id: openingId },
        data: { name: `${trimmedBaseName} 1` }
      })

      // Create duplicates starting from number 2
      for (let i = 2; i <= duplicateCount + 1; i++) {
        const duplicatedOpening = await prisma.opening.create({
          data: {
            projectId: originalOpening.projectId,
            name: `${trimmedBaseName} ${i}`,
            roughWidth: originalOpening.roughWidth,
            roughHeight: originalOpening.roughHeight,
            finishedWidth: originalOpening.finishedWidth,
            finishedHeight: originalOpening.finishedHeight,
            finishColor: originalOpening.finishColor,
            multiplier: originalOpening.multiplier,
            price: 0,
            priceCalculatedAt: null,
            panels: {
              create: originalOpening.panels.map(panel => ({
                type: panel.type,
                width: panel.width,
                height: panel.height,
                glassType: panel.glassType,
                locking: panel.locking,
                swingDirection: panel.swingDirection,
                slidingDirection: panel.slidingDirection,
                isCorner: panel.isCorner,
                cornerDirection: panel.cornerDirection,
                displayOrder: panel.displayOrder,
                componentLibraryId: panel.componentLibraryId,
                componentInstance: panel.componentInstance ? {
                  create: {
                    productId: panel.componentInstance.productId,
                    subOptionSelections: panel.componentInstance.subOptionSelections
                  }
                } : undefined
              }))
            }
          },
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: true
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
        })
        createdOpenings.push(duplicatedOpening)
      }
    } else {
      // Non-auto-increment: use exact name as provided by user
      const namesToCreate = []
      if (duplicateCount === 1) {
        // Single duplicate: use exact name provided
        namesToCreate.push(trimmedBaseName)
      } else {
        // Multiple duplicates: append numbers (1, 2, 3, etc.)
        for (let i = 1; i <= duplicateCount; i++) {
          namesToCreate.push(`${trimmedBaseName} ${i}`)
        }
      }

      // Check if any names already exist
      const existingOpenings = await prisma.opening.findMany({
        where: {
          projectId: originalOpening.projectId,
          name: { in: namesToCreate }
        }
      })

      if (existingOpenings.length > 0) {
        const conflictingNames = existingOpenings.map(o => o.name).join(', ')
        return NextResponse.json(
          { error: `Opening name(s) already exist: ${conflictingNames}` },
          { status: 400 }
        )
      }

      // Create all duplicates
      for (const name of namesToCreate) {
        const duplicatedOpening = await prisma.opening.create({
          data: {
            projectId: originalOpening.projectId,
            name: name,
            roughWidth: originalOpening.roughWidth,
            roughHeight: originalOpening.roughHeight,
            finishedWidth: originalOpening.finishedWidth,
            finishedHeight: originalOpening.finishedHeight,
            finishColor: originalOpening.finishColor,
            multiplier: originalOpening.multiplier,
            price: 0,
            priceCalculatedAt: null,
            panels: {
              create: originalOpening.panels.map(panel => ({
                type: panel.type,
                width: panel.width,
                height: panel.height,
                glassType: panel.glassType,
                locking: panel.locking,
                swingDirection: panel.swingDirection,
                slidingDirection: panel.slidingDirection,
                isCorner: panel.isCorner,
                cornerDirection: panel.cornerDirection,
                displayOrder: panel.displayOrder,
                componentLibraryId: panel.componentLibraryId,
                componentInstance: panel.componentInstance ? {
                  create: {
                    productId: panel.componentInstance.productId,
                    subOptionSelections: panel.componentInstance.subOptionSelections
                  }
                } : undefined
              }))
            }
          },
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productSubOptions: {
                          include: {
                            category: {
                              include: {
                                individualOptions: true
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
        })
        createdOpenings.push(duplicatedOpening)
      }
    }

    return NextResponse.json({
      message: `Successfully created ${createdOpenings.length} duplicate(s)`,
      openings: createdOpenings,
      originalRenamed: autoIncrement
    }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating opening:', error)
    return NextResponse.json(
      { error: 'Failed to duplicate opening' },
      { status: 500 }
    )
  }
}

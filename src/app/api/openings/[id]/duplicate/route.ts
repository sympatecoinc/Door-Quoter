import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Intelligently increments a base name that may contain numbers.
 * - Pure numeric strings (101, 201, 1001): increment the number (102, 202, 1002)
 * - Strings ending with numbers (Office 101): increment the trailing number (Office 102)
 * - Non-numeric strings: append space and number (Office 1)
 */
function smartIncrementName(baseName: string, index: number): string {
  const trimmed = baseName.trim()

  // Check if the entire string is numeric
  if (/^\d+$/.test(trimmed)) {
    const baseNumber = parseInt(trimmed)
    return (baseNumber + index).toString()
  }

  // Check if string ends with a number (e.g., "Office 101")
  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (match) {
    const prefix = match[1] // "Office " or ""
    const number = parseInt(match[2]) // 101
    return `${prefix}${number + index}`
  }

  // Non-numeric: use traditional space-separated numbering
  return `${trimmed} ${index}`
}

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
      for (let i = 0; i <= duplicateCount; i++) {
        allNames.push(smartIncrementName(trimmedBaseName, i))
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

      // Rename the original opening to base name (e.g., 101)
      await prisma.opening.update({
        where: { id: openingId },
        data: { name: smartIncrementName(trimmedBaseName, 0) }
      })

      // Create duplicates with incremented names (e.g., 102, 103, ...)
      for (let i = 1; i <= duplicateCount; i++) {
        const duplicatedOpening = await prisma.opening.create({
          data: {
            projectId: originalOpening.projectId,
            name: smartIncrementName(trimmedBaseName, i),
            roughWidth: originalOpening.roughWidth,
            roughHeight: originalOpening.roughHeight,
            finishedWidth: originalOpening.finishedWidth,
            finishedHeight: originalOpening.finishedHeight,
            multiplier: originalOpening.multiplier,
            finishColor: originalOpening.finishColor,
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
        // Multiple duplicates: use smart incrementing (1, 2, 3, etc.)
        for (let i = 1; i <= duplicateCount; i++) {
          namesToCreate.push(smartIncrementName(trimmedBaseName, i))
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
            multiplier: originalOpening.multiplier,
            finishColor: originalOpening.finishColor,
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

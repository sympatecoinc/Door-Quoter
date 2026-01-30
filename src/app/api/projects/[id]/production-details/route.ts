import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to get finish code abbreviation from database
async function getFinishCode(finishType: string): Promise<string | null> {
  try {
    const finish = await prisma.extrusionFinishPricing.findUnique({
      where: { finishType }
    })
    return finish?.finishCode || null
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Fetch project with all details needed for expanded view
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        productType: true
                      }
                    }
                  }
                }
              },
              orderBy: { displayOrder: 'asc' }
            }
          }
        },
        workOrders: {
          select: {
            id: true,
            batchNumber: true,
            currentStage: true,
            priority: true,
            items: {
              select: {
                id: true,
                isCompleted: true
              }
            }
          },
          orderBy: { batchNumber: 'asc' }
        },
        fieldVerificationUploads: {
          select: {
            id: true,
            originalName: true,
            uploadedAt: true,
            confirmed: true
          },
          orderBy: { uploadedAt: 'desc' }
        },
        // Get all versions of this project
        revisions: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
            isCurrentVersion: true
          },
          orderBy: { version: 'asc' }
        },
        parentProject: {
          select: {
            id: true,
            name: true,
            version: true,
            status: true,
            isCurrentVersion: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Natural sort comparison for opening names
    const naturalSortCompare = (a: string, b: string): number => {
      const aParts = a.split(/(\d+)/)
      const bParts = b.split(/(\d+)/)

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || ''
        const bPart = bParts[i] || ''

        const aNum = parseInt(aPart, 10)
        const bNum = parseInt(bPart, 10)

        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum
        } else {
          const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' })
          if (cmp !== 0) return cmp
        }
      }
      return 0
    }

    // Sort openings by name using natural sort
    const sortedOpenings = [...project.openings].sort((a, b) =>
      naturalSortCompare(a.name || '', b.name || '')
    )

    // Format openings with product info
    const openings = await Promise.all(sortedOpenings.map(async opening => {
      // Calculate frame dimensions from panels if not set
      const calculatedWidth = opening.panels.length > 0
        ? opening.panels.reduce((sum, p) => sum + p.width, 0)
        : null
      const calculatedHeight = opening.panels.length > 0
        ? Math.max(...opening.panels.map(p => p.height))
        : null

      // Get unique products from panels (exclude paired/hidden panels like frames)
      const products = opening.panels
        .filter(panel => panel.componentInstance?.product && !panel.parentPanelId)
        .map(panel => ({
          id: panel.componentInstance!.product!.id,
          name: panel.componentInstance!.product!.name,
          productType: panel.componentInstance!.product!.productType,
          width: panel.width,
          height: panel.height
        }))

      // Get finish code abbreviation
      const finishCode = opening.finishColor
        ? await getFinishCode(opening.finishColor)
        : null

      return {
        id: opening.id,
        name: opening.name,
        openingType: opening.openingType, // THINWALL or FRAMED
        roughWidth: opening.roughWidth ?? calculatedWidth,
        roughHeight: opening.roughHeight ?? calculatedHeight,
        finishedWidth: opening.finishedWidth ?? calculatedWidth,
        finishedHeight: opening.finishedHeight ?? calculatedHeight,
        finishColor: opening.finishColor,
        finishCode,
        products
      }
    }))

    // Format work orders with progress
    const workOrders = project.workOrders.map(wo => {
      const totalItems = wo.items.length
      const completedItems = wo.items.filter(item => item.isCompleted).length
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

      return {
        id: wo.id,
        batchNumber: wo.batchNumber,
        currentStage: wo.currentStage,
        priority: wo.priority,
        itemCount: totalItems,
        completedCount: completedItems,
        progressPercent
      }
    })

    // Get all versions (including this project and its revisions)
    const allVersions = []

    // If this project has a parent, include the parent
    if (project.parentProject) {
      allVersions.push({
        id: project.parentProject.id,
        name: project.parentProject.name,
        version: project.parentProject.version,
        status: project.parentProject.status,
        isCurrentVersion: project.parentProject.isCurrentVersion
      })
    }

    // Add the current project
    allVersions.push({
      id: project.id,
      name: project.name,
      version: project.version,
      status: project.status,
      isCurrentVersion: project.isCurrentVersion
    })

    // Add revisions
    if (project.revisions && project.revisions.length > 0) {
      allVersions.push(...project.revisions.map(rev => ({
        id: rev.id,
        name: rev.name,
        version: rev.version,
        status: rev.status,
        isCurrentVersion: rev.isCurrentVersion
      })))
    }

    // Sort by version and dedupe
    const uniqueVersions = Array.from(
      new Map(allVersions.map(v => [v.id, v])).values()
    ).sort((a, b) => a.version - b.version)

    return NextResponse.json({
      id: project.id,
      name: project.name,
      version: project.version,
      openings,
      workOrders,
      fieldVerificationUploads: {
        count: project.fieldVerificationUploads.length,
        confirmedCount: project.fieldVerificationUploads.filter(u => u.confirmed).length,
        uploads: project.fieldVerificationUploads
      },
      versions: uniqueVersions
    })
  } catch (error) {
    console.error('Error fetching production details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch production details' },
      { status: 500 }
    )
  }
}

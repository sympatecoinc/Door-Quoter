import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          include: {
            panels: {
              orderBy: {
                displayOrder: 'asc'
              },
              include: {
                componentInstance: {
                  include: {
                    product: {
                      // Include product info and BOMs for sync detection
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        type: true,
                        productType: true,
                        archived: true,
                        withTrim: true,
                        glassWidthFormula: true,
                        glassHeightFormula: true,
                        glassQuantityFormula: true,
                        createdAt: true,
                        updatedAt: true,
                        productBOMs: {
                          select: {
                            id: true,
                            updatedAt: true
                          }
                        },
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
        },
        boms: true,
        _count: {
          select: {
            openings: true,
            boms: true
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

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Delete the project (cascade will handle related records)
    await prisma.project.delete({
      where: { id: projectId }
    })

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    const { name, status, dueDate, extrusionCostingMethod, excludedPartNumbers, taxRate, pricingModeId, installationCost, installationMethod, installationComplexity, manualInstallationCost } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Validate extrusionCostingMethod if provided
    if (extrusionCostingMethod !== undefined &&
        extrusionCostingMethod !== 'FULL_STOCK' &&
        extrusionCostingMethod !== 'PERCENTAGE_BASED') {
      return NextResponse.json(
        { error: 'Invalid extrusion costing method. Must be FULL_STOCK or PERCENTAGE_BASED' },
        { status: 400 }
      )
    }

    const updateData: any = { name, status }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null
    }
    if (extrusionCostingMethod !== undefined) {
      updateData.extrusionCostingMethod = extrusionCostingMethod
    }
    if (excludedPartNumbers !== undefined) {
      updateData.excludedPartNumbers = excludedPartNumbers
    }
    if (taxRate !== undefined) {
      updateData.taxRate = taxRate
    }
    if (pricingModeId !== undefined) {
      updateData.pricingModeId = pricingModeId
    }
    if (installationCost !== undefined) {
      updateData.installationCost = installationCost
    }
    if (installationMethod !== undefined) {
      updateData.installationMethod = installationMethod
    }
    if (installationComplexity !== undefined) {
      updateData.installationComplexity = installationComplexity
    }
    if (manualInstallationCost !== undefined) {
      updateData.manualInstallationCost = manualInstallationCost
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: updateData
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}
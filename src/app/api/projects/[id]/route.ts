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
          orderBy: { id: 'asc' },
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
                            partNumber: true,
                            formula: true,
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

    // Collect all unique part numbers from product BOMs across all components
    const allPartNumbers = new Set<string>()

    project.openings.forEach(opening => {
      opening.panels.forEach(panel => {
        if (panel.componentInstance?.product?.productBOMs) {
          panel.componentInstance.product.productBOMs.forEach((bom: any) => {
            if (bom.partNumber) {
              allPartNumbers.add(bom.partNumber)
            }
          })
        }
      })
    })

    // Fetch master parts with their latest pricing rule update times
    if (allPartNumbers.size > 0) {
      const masterParts = await prisma.masterPart.findMany({
        where: {
          partNumber: {
            in: Array.from(allPartNumbers)
          }
        },
        select: {
          partNumber: true,
          baseName: true,
          updatedAt: true,
          pricingRules: {
            select: {
              id: true,
              updatedAt: true
            },
            orderBy: {
              updatedAt: 'desc'
            },
            take: 1
          },
          stockLengthRules: {
            select: {
              id: true,
              updatedAt: true
            },
            orderBy: {
              updatedAt: 'desc'
            },
            take: 1
          }
        }
      })

      // Attach master parts info to response
      const projectWithSync = {
        ...project,
        _syncInfo: {
          masterParts: masterParts.map(mp => ({
            partNumber: mp.partNumber,
            baseName: mp.baseName,
            masterPartUpdatedAt: mp.updatedAt,
            latestPricingRuleUpdate: mp.pricingRules[0]?.updatedAt || null,
            latestStockLengthRuleUpdate: mp.stockLengthRules[0]?.updatedAt || null
          }))
        }
      }

      return NextResponse.json(projectWithSync)
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
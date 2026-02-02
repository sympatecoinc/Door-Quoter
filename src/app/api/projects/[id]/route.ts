import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import { ensureProjectPricingMode, getDefaultPricingMode } from '@/lib/pricing-mode'
import { createProjectRevision } from '@/lib/project-revisions'
import { LEAD_STATUSES } from '@/types'

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
        pricingMode: {
          select: {
            id: true,
            name: true,
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            packagingMarkup: true,
            discount: true
          }
        },
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
                        productCategory: true,
                        archived: true,
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
                                individualOptions: {
                                  include: {
                                    variants: {
                                      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
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
          }
        },
        boms: true,
        projectContacts: {
          orderBy: { createdAt: 'asc' }
        },
        projectNotes: {
          orderBy: { createdAt: 'desc' }
        },
        primaryContact: true,
        primaryProjectContact: true,
        customer: {
          include: {
            contacts: true
          }
        },
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

      // If project doesn't have a pricing mode, get the default
      let effectivePricingMode = project.pricingMode
      if (!effectivePricingMode) {
        const defaultMode = await getDefaultPricingMode(prisma)
        effectivePricingMode = {
          id: defaultMode.id,
          name: defaultMode.name,
          markup: defaultMode.markup,
          extrusionMarkup: defaultMode.extrusionMarkup,
          hardwareMarkup: defaultMode.hardwareMarkup,
          glassMarkup: defaultMode.glassMarkup,
          packagingMarkup: defaultMode.packagingMarkup,
          discount: defaultMode.discount
        }
      }

      // Attach master parts info to response
      const projectWithSync = {
        ...project,
        pricingMode: effectivePricingMode,
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

    // If project doesn't have a pricing mode, get the default
    let effectivePricingMode = project.pricingMode
    if (!effectivePricingMode) {
      const defaultMode = await getDefaultPricingMode(prisma)
      effectivePricingMode = {
        id: defaultMode.id,
        name: defaultMode.name,
        markup: defaultMode.markup,
        extrusionMarkup: defaultMode.extrusionMarkup,
        hardwareMarkup: defaultMode.hardwareMarkup,
        glassMarkup: defaultMode.glassMarkup,
        packagingMarkup: defaultMode.packagingMarkup,
        discount: defaultMode.discount
      }
    }

    return NextResponse.json({ ...project, pricingMode: effectivePricingMode })
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

    // Delete the project and all related data (cascading deletes handled by Prisma)
    await prisma.project.delete({
      where: { id: projectId }
    })

    return NextResponse.json({ success: true })
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

    const { name, status, dueDate, shipDate, shippingAddress, shippingCity, shippingState, shippingZipCode, primaryContactId, primaryProjectContactId, extrusionCostingMethod, excludedPartNumbers, taxRate, pricingModeId, installationCost, installationMethod, installationComplexity, manualInstallationCost, quoteDrawingView, batchSize } = await request.json()

    // Validate status if provided
    if (status && !Object.values(ProjectStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid project status' },
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

    // Validate quoteDrawingView if provided
    if (quoteDrawingView !== undefined &&
        quoteDrawingView !== 'ELEVATION' &&
        quoteDrawingView !== 'PLAN') {
      return NextResponse.json(
        { error: 'Invalid quote drawing view. Must be ELEVATION or PLAN' },
        { status: 400 }
      )
    }

    // Validate batchSize if provided (must be null or positive integer)
    if (batchSize !== undefined && batchSize !== null) {
      const parsedBatchSize = parseInt(batchSize)
      if (isNaN(parsedBatchSize) || parsedBatchSize < 1) {
        return NextResponse.json(
          { error: 'Invalid batch size. Must be a positive integer or null' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (name !== undefined) {
      updateData.name = name
    }
    if (status !== undefined) {
      updateData.status = status
    }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null
    }
    if (shipDate !== undefined) {
      updateData.shipDate = shipDate ? new Date(shipDate) : null
    }
    if (shippingAddress !== undefined) {
      updateData.shippingAddress = shippingAddress
    }
    if (shippingCity !== undefined) {
      updateData.shippingCity = shippingCity
    }
    if (shippingState !== undefined) {
      updateData.shippingState = shippingState
    }
    if (shippingZipCode !== undefined) {
      updateData.shippingZipCode = shippingZipCode
    }
    if (primaryContactId !== undefined) {
      updateData.primaryContactId = primaryContactId
    }
    if (primaryProjectContactId !== undefined) {
      updateData.primaryProjectContactId = primaryProjectContactId
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
    // Ensure pricing mode is set (apply default if null/undefined provided)
    if (pricingModeId !== undefined) {
      const finalPricingModeId = await ensureProjectPricingMode(pricingModeId, prisma)
      updateData.pricingMode = { connect: { id: finalPricingModeId } }
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
    if (quoteDrawingView !== undefined) {
      updateData.quoteDrawingView = quoteDrawingView
    }
    if (batchSize !== undefined) {
      updateData.batchSize = batchSize === null ? null : parseInt(batchSize)
    }

    // Update project and track status change in a transaction
    const updatedProject = await prisma.$transaction(async (tx) => {
      // Get current project with full details for conversion check
      const currentProject = await tx.project.findUnique({
        where: { id: projectId },
        select: {
          status: true,
          customerId: true,
          prospectCompanyName: true,
          prospectPhone: true,
          prospectAddress: true,
          prospectCity: true,
          prospectState: true,
          prospectZipCode: true
        }
      })

      if (!currentProject) {
        throw new Error('Project not found')
      }

      // Check if status change requires a quote to exist
      const statusesRequiringQuote = [
        ProjectStatus.QUOTE_SENT,
        ProjectStatus.QUOTE_ACCEPTED,
        ProjectStatus.ACTIVE,
        ProjectStatus.COMPLETE
      ]

      if (status && statusesRequiringQuote.includes(status) && currentProject.status !== status) {
        // Check if a quote has been generated for this project
        const quoteCount = await tx.quoteVersion.count({
          where: { projectId: projectId }
        })

        if (quoteCount === 0) {
          const statusLabel = status === ProjectStatus.QUOTE_SENT ? 'Quote Sent' :
                              status === ProjectStatus.QUOTE_ACCEPTED ? 'Quote Accepted' :
                              status === ProjectStatus.ACTIVE ? 'Active' : 'Complete'
          throw new Error(`Cannot change status to "${statusLabel}" - a quote must be generated first`)
        }
      }

      // Check if we're reverting from QUOTE_ACCEPTED to a lead status
      // This requires creating a new revision to preserve the accepted quote history
      const isRevertingToLead = status &&
        currentProject.status === ProjectStatus.QUOTE_ACCEPTED &&
        LEAD_STATUSES.includes(status as any)

      if (isRevertingToLead) {
        // Create a new revision with the target lead status
        // The original project stays at QUOTE_ACCEPTED to preserve history
        const revisionResult = await createProjectRevision(tx, {
          sourceProjectId: projectId,
          targetStatus: status as ProjectStatus,
          changedBy: 'System (Reverted from Quote Accepted)'
        })

        if (!revisionResult.success) {
          throw new Error(revisionResult.error)
        }

        // Return the new revision info - the original project is NOT modified
        return {
          ...revisionResult.revision,
          revisionCreated: true,
          originalProjectId: projectId,
          message: `Project reverted to ${status}. A new revision (v${revisionResult.revision.version}) was created to preserve the accepted quote history.`
        }
      }

      // Check if we need to convert lead to customer
      // This happens when:
      // 1. Status is changing to QUOTE_ACCEPTED
      // 2. Project has no linked customer (customerId is null)
      // 3. Project has prospect info (prospectCompanyName)
      const isConvertingToQuoteAccepted = status === ProjectStatus.QUOTE_ACCEPTED &&
        currentProject.status !== ProjectStatus.QUOTE_ACCEPTED
      const needsCustomerConversion = isConvertingToQuoteAccepted &&
        !currentProject.customerId &&
        currentProject.prospectCompanyName

      let newCustomerId: number | null = null

      if (needsCustomerConversion) {
        // Create new customer from prospect info
        const newCustomer = await tx.customer.create({
          data: {
            companyName: currentProject.prospectCompanyName!,
            phone: currentProject.prospectPhone,
            address: currentProject.prospectAddress,
            city: currentProject.prospectCity,
            state: currentProject.prospectState,
            zipCode: currentProject.prospectZipCode,
            status: 'Active'
          }
        })
        newCustomerId = newCustomer.id

        // Add customerId to update data
        updateData.customerId = newCustomerId
      } else if (isConvertingToQuoteAccepted && currentProject.customerId) {
        // Update existing customer status from Lead to Active when lead is won
        await tx.customer.updateMany({
          where: {
            id: currentProject.customerId,
            status: 'Lead'
          },
          data: {
            status: 'Active'
          }
        })
      }

      // Note: Sales Orders are now created manually from the "Pending from Quotes" tab
      // to allow users to review accepted quotes before creating SOs

      const project = await tx.project.update({
        where: { id: projectId },
        data: updateData,
        include: {
          customer: true
        }
      })

      // Record status change if status was updated
      if (status && currentProject && currentProject.status !== status) {
        await tx.projectStatusHistory.create({
          data: {
            projectId: projectId,
            status: status
          }
        })
      }

      return { ...project, customerCreated: needsCustomerConversion }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Error updating project:', error)

    // Return specific error message for validation errors
    if (error instanceof Error && error.message.includes('quote must be generated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}
import { PrismaClient, ProjectStatus } from '@prisma/client'

interface CreateRevisionOptions {
  sourceProjectId: number
  targetStatus?: ProjectStatus // Defaults to STAGING if not provided
  changedBy?: string
}

interface RevisionResult {
  success: true
  revision: {
    id: number
    name: string
    version: number
    status: ProjectStatus
    isCurrentVersion: boolean
  }
  sourceProjectId: number
  rootProjectId: number
  message: string
}

interface RevisionError {
  success: false
  error: string
}

type CreateRevisionResult = RevisionResult | RevisionError

/**
 * Creates a new revision (deep copy) of a project.
 * This function handles all the complexity of copying openings, panels,
 * component instances, contacts, and notes.
 *
 * @param prisma - Prisma client instance (can be transaction client)
 * @param options - Configuration for revision creation
 * @returns The new revision or an error
 */
export async function createProjectRevision(
  prisma: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  options: CreateRevisionOptions
): Promise<CreateRevisionResult> {
  const { sourceProjectId, targetStatus = ProjectStatus.STAGING, changedBy = 'System (Revision Created)' } = options

  try {
    // Get the source project with all related data
    const sourceProject = await prisma.project.findUnique({
      where: { id: sourceProjectId },
      include: {
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: true
              }
            }
          }
        },
        projectContacts: true,
        projectNotes: true,
        quoteAttachments: true
      }
    })

    if (!sourceProject) {
      return { success: false, error: 'Project not found' }
    }

    // Find the root project (traverse up the parent chain)
    let rootId = sourceProject.id
    let parentId = sourceProject.parentProjectId

    while (parentId) {
      const parent = await prisma.project.findUnique({
        where: { id: parentId },
        select: { id: true, parentProjectId: true }
      })
      if (!parent) break
      rootId = parent.id
      parentId = parent.parentProjectId
    }

    // Get the next version number
    const maxVersion = await prisma.project.aggregate({
      where: {
        OR: [
          { id: rootId },
          { parentProjectId: rootId }
        ]
      },
      _max: { version: true }
    })

    const nextVersion = (maxVersion._max.version || 1) + 1

    // Mark all existing versions as not current
    await prisma.project.updateMany({
      where: {
        OR: [
          { id: rootId },
          { parentProjectId: rootId }
        ]
      },
      data: { isCurrentVersion: false }
    })

    // Create the new project (revision)
    const newProject = await prisma.project.create({
      data: {
        name: sourceProject.name,
        status: targetStatus,
        customerId: sourceProject.customerId,
        pricingModeId: sourceProject.pricingModeId,
        extrusionCostingMethod: sourceProject.extrusionCostingMethod,
        excludedPartNumbers: sourceProject.excludedPartNumbers,
        multiplier: sourceProject.multiplier,
        taxRate: sourceProject.taxRate,
        installationMethod: sourceProject.installationMethod,
        installationComplexity: sourceProject.installationComplexity,
        manualInstallationCost: sourceProject.manualInstallationCost,
        quoteDrawingView: sourceProject.quoteDrawingView,
        dueDate: sourceProject.dueDate,
        shipDate: sourceProject.shipDate,
        shippingAddress: sourceProject.shippingAddress,
        shippingCity: sourceProject.shippingCity,
        shippingState: sourceProject.shippingState,
        shippingZipCode: sourceProject.shippingZipCode,
        prospectCompanyName: sourceProject.prospectCompanyName,
        prospectPhone: sourceProject.prospectPhone,
        prospectAddress: sourceProject.prospectAddress,
        prospectCity: sourceProject.prospectCity,
        prospectState: sourceProject.prospectState,
        prospectZipCode: sourceProject.prospectZipCode,
        // Version tracking
        version: nextVersion,
        parentProjectId: rootId,
        isCurrentVersion: true
      }
    })

    // Deep copy openings with panels and component instances
    for (const opening of sourceProject.openings) {
      const newOpening = await prisma.opening.create({
        data: {
          projectId: newProject.id,
          name: opening.name,
          roughWidth: opening.roughWidth,
          roughHeight: opening.roughHeight,
          finishedWidth: opening.finishedWidth,
          finishedHeight: opening.finishedHeight,
          price: 0, // Reset price - will be recalculated
          extrusionCost: 0,
          hardwareCost: 0,
          glassCost: 0,
          packagingCost: 0,
          otherCost: 0,
          standardOptionCost: 0,
          hybridRemainingCost: 0,
          multiplier: opening.multiplier,
          finishColor: opening.finishColor,
          includeStarterChannels: opening.includeStarterChannels,
          isFinishedOpening: opening.isFinishedOpening,
          openingType: opening.openingType,
          widthToleranceTotal: opening.widthToleranceTotal,
          heightToleranceTotal: opening.heightToleranceTotal
        }
      })

      // Create a map to track old panel ID -> new panel ID for parent panel relationships
      const panelIdMap = new Map<number, number>()

      // First pass: create all panels without parent relationships
      for (const panel of opening.panels) {
        const newPanel = await prisma.panel.create({
          data: {
            openingId: newOpening.id,
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
            componentLibraryId: panel.componentLibraryId
            // parentPanelId will be set in second pass
          }
        })

        panelIdMap.set(panel.id, newPanel.id)

        // Copy component instance if exists
        if (panel.componentInstance) {
          await prisma.componentInstance.create({
            data: {
              panelId: newPanel.id,
              productId: panel.componentInstance.productId,
              subOptionSelections: panel.componentInstance.subOptionSelections,
              includedOptions: panel.componentInstance.includedOptions,
              variantSelections: panel.componentInstance.variantSelections
            }
          })
        }
      }

      // Second pass: update parent panel relationships
      for (const panel of opening.panels) {
        if (panel.parentPanelId) {
          const newPanelId = panelIdMap.get(panel.id)
          const newParentPanelId = panelIdMap.get(panel.parentPanelId)
          if (newPanelId && newParentPanelId) {
            await prisma.panel.update({
              where: { id: newPanelId },
              data: { parentPanelId: newParentPanelId }
            })
          }
        }
      }
    }

    // Copy project contacts
    for (const contact of sourceProject.projectContacts) {
      await prisma.projectContact.create({
        data: {
          projectId: newProject.id,
          contactType: contact.contactType,
          companyName: contact.companyName,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes
        }
      })
    }

    // Copy project notes
    for (const note of sourceProject.projectNotes) {
      await prisma.projectNote.create({
        data: {
          projectId: newProject.id,
          content: note.content,
          createdBy: note.createdBy
        }
      })
    }

    // Create status history entry for the new revision
    await prisma.projectStatusHistory.create({
      data: {
        projectId: newProject.id,
        status: targetStatus,
        changedBy
      }
    })

    return {
      success: true,
      revision: {
        id: newProject.id,
        name: newProject.name,
        version: nextVersion,
        status: targetStatus,
        isCurrentVersion: true
      },
      sourceProjectId,
      rootProjectId: rootId,
      message: `Revision v${nextVersion} created successfully`
    }
  } catch (error) {
    console.error('Error creating revision:', error)
    return { success: false, error: 'Failed to create revision' }
  }
}

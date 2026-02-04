/**
 * Lead/Opportunity sync between ClickUp CRM and ERP
 *
 * ClickUp Leads are now synced directly to Projects (not a separate Lead model)
 * with the appropriate ProjectStatus based on ClickUp status.
 */

import { prisma } from '@/lib/prisma'
import type { Project, Customer } from '@prisma/client'
import {
  getClickUpClient,
  type ClickUpTask,
  type CreateTaskData,
  type UpdateTaskData,
} from '../clickup-client'
import {
  getCustomField,
  extractTextValue,
  extractCurrencyValue,
  extractDateValue,
  extractLabelsValue,
  extractRelationshipIds,
  extractUserIds,
  LEAD_CUSTOM_FIELDS,
} from './field-mappings'
import {
  getProjectStatusFromClickUpLead,
  getClickUpLeadStatusFromProject,
} from './status-mappings'
import { logSync, getClickUpUserId, getERPUserId } from './index'
import { ProjectStatus } from '@/types'

// ============ ClickUp → ERP Sync ============

export interface LeadSyncResult {
  success: boolean
  projectId?: number
  error?: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Sync a ClickUp Lead/Opportunity task to ERP Project
 */
export async function syncClickUpLeadToERP(
  task: ClickUpTask
): Promise<LeadSyncResult> {
  try {
    // Check if this lead already exists as a Project in ERP
    const existingProject = await prisma.project.findUnique({
      where: { clickupLeadId: task.id },
    })

    // Extract custom field values
    const valueField = getCustomField(task, LEAD_CUSTOM_FIELDS.opportunityValue)
    const accountField = getCustomField(task, LEAD_CUSTOM_FIELDS.associatedAccount)
    const ownerField = getCustomField(task, LEAD_CUSTOM_FIELDS.accountOwner)
    const lastContactField = getCustomField(task, LEAD_CUSTOM_FIELDS.lastContactDate)

    // Map ClickUp status to ProjectStatus
    const projectStatus = getProjectStatusFromClickUpLead(task.status?.status || 'new lead')

    // Find associated customer by ClickUp relationship
    let customerId: number | null = null
    const accountTaskIds = extractRelationshipIds(accountField)
    if (accountTaskIds.length > 0) {
      const customer = await prisma.customer.findUnique({
        where: { clickupAccountId: accountTaskIds[0] },
      })
      customerId = customer?.id || null
    }

    // Build project data
    const projectData = {
      name: task.name,
      status: projectStatus,
      customerId,
      // For leads without a customer, store prospect info
      prospectCompanyName: customerId ? null : task.name,
      clickupLeadId: task.id,
      clickupLastSyncedAt: new Date(),
    }

    let project: Project
    let action: 'created' | 'updated'

    if (existingProject) {
      // Update existing project
      project = await prisma.project.update({
        where: { id: existingProject.id },
        data: projectData,
      })
      action = 'updated'
    } else {
      // Create new project
      project = await prisma.project.create({
        data: projectData,
      })
      action = 'created'
    }

    // Log successful sync
    await logSync({
      entityType: 'project',
      entityId: project.id,
      clickupTaskId: task.id,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: projectData,
    })

    return {
      success: true,
      projectId: project.id,
      action,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'project',
      entityId: 0,
      clickupTaskId: task.id,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'failed',
      errorMessage,
      payload: { taskName: task.name },
    })

    return {
      success: false,
      error: errorMessage,
      action: 'skipped',
    }
  }
}

// ============ ERP → ClickUp Sync ============

export interface ERPToClickUpResult {
  success: boolean
  clickupTaskId?: string
  error?: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Sync an ERP Project (in lead phase) to ClickUp Lead/Opportunity task
 */
export async function syncERPProjectToClickUp(
  project: Project & { customer?: Customer | null },
  customFieldIds?: Record<string, string>
): Promise<ERPToClickUpResult> {
  try {
    const client = getClickUpClient()
    const listId = process.env.CLICKUP_LEADS_LIST_ID

    if (!listId) {
      throw new Error('CLICKUP_LEADS_LIST_ID not configured')
    }

    // Get ClickUp status from ProjectStatus
    const clickupStatus = getClickUpLeadStatusFromProject(project.status as ProjectStatus)

    if (project.clickupLeadId) {
      // Update existing ClickUp task
      const updateData: UpdateTaskData = {
        name: project.name,
        status: clickupStatus,
      }

      await client.updateTask(project.clickupLeadId, updateData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateProjectCustomFields(
          client,
          project.clickupLeadId,
          project,
          customFieldIds
        )
      }

      // Update sync timestamp
      await prisma.project.update({
        where: { id: project.id },
        data: { clickupLastSyncedAt: new Date() },
      })

      // Log successful sync
      await logSync({
        entityType: 'project',
        entityId: project.id,
        clickupTaskId: project.clickupLeadId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: updateData,
      })

      return {
        success: true,
        clickupTaskId: project.clickupLeadId,
        action: 'updated',
      }
    } else {
      // Create new ClickUp task
      const createData: CreateTaskData = {
        name: project.name,
        status: clickupStatus,
      }

      const newTask = await client.createTask(listId, createData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateProjectCustomFields(client, newTask.id, project, customFieldIds)
      }

      // Store ClickUp task ID
      await prisma.project.update({
        where: { id: project.id },
        data: {
          clickupLeadId: newTask.id,
          clickupLastSyncedAt: new Date(),
        },
      })

      // Log successful sync
      await logSync({
        entityType: 'project',
        entityId: project.id,
        clickupTaskId: newTask.id,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: createData,
      })

      return {
        success: true,
        clickupTaskId: newTask.id,
        action: 'created',
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'project',
      entityId: project.id,
      clickupTaskId: project.clickupLeadId || '',
      syncDirection: 'erp_to_clickup',
      syncStatus: 'failed',
      errorMessage,
      payload: { projectId: project.id },
    })

    return {
      success: false,
      error: errorMessage,
      action: 'skipped',
    }
  }
}

/**
 * Update custom fields on a ClickUp Lead task for a Project
 */
async function updateProjectCustomFields(
  client: ReturnType<typeof getClickUpClient>,
  taskId: string,
  project: Project & { customer?: Customer | null },
  fieldIds: Record<string, string>
): Promise<void> {
  const updates: Array<{ fieldId: string; value: any }> = []

  // Link to associated account if available
  if (fieldIds.associatedAccount && project.customer?.clickupAccountId) {
    updates.push({
      fieldId: fieldIds.associatedAccount,
      value: [project.customer.clickupAccountId],
    })
  }

  // Execute updates
  for (const update of updates) {
    try {
      await client.setCustomFieldValue(taskId, update.fieldId, update.value)
    } catch (error) {
      console.error(`Failed to update custom field ${update.fieldId}:`, error)
    }
  }
}

/**
 * Handle ClickUp Lead task deletion - unlink from Project
 */
export async function handleLeadDeletion(clickupTaskId: string): Promise<void> {
  // Find and update the project to remove ClickUp link
  const project = await prisma.project.findUnique({
    where: { clickupLeadId: clickupTaskId },
  })

  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        clickupLeadId: null,
        clickupLastSyncedAt: null,
      },
    })

    await logSync({
      entityType: 'project',
      entityId: project.id,
      clickupTaskId,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: { action: 'unlinked' },
    })
  }
}

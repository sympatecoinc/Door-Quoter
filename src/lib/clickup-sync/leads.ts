/**
 * Lead/Opportunity sync between ClickUp CRM and ERP
 */

import { prisma } from '@/lib/prisma'
import type { Lead, Customer } from '@prisma/client'
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
  getERPLeadStage,
  getClickUpLeadStatus,
} from './status-mappings'
import { logSync, getClickUpUserId, getERPUserId } from './index'

// ============ ClickUp → ERP Sync ============

export interface LeadSyncResult {
  success: boolean
  leadId?: number
  error?: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Sync a ClickUp Lead/Opportunity task to ERP Lead
 */
export async function syncClickUpLeadToERP(
  task: ClickUpTask
): Promise<LeadSyncResult> {
  try {
    // Check if this lead already exists in ERP
    const existingLead = await prisma.lead.findUnique({
      where: { clickupLeadId: task.id },
    })

    // Extract custom field values
    const valueField = getCustomField(task, LEAD_CUSTOM_FIELDS.opportunityValue)
    const accountField = getCustomField(task, LEAD_CUSTOM_FIELDS.associatedAccount)
    const ownerField = getCustomField(task, LEAD_CUSTOM_FIELDS.accountOwner)
    const lastContactField = getCustomField(task, LEAD_CUSTOM_FIELDS.lastContactDate)
    const colorsField = getCustomField(task, LEAD_CUSTOM_FIELDS.aluminumColors)

    // Map ClickUp status to ERP stage
    const erpStage = getERPLeadStage(task.status?.status || 'new lead')

    // Find associated customer by ClickUp relationship
    let customerId: number | null = null
    const accountTaskIds = extractRelationshipIds(accountField)
    if (accountTaskIds.length > 0) {
      const customer = await prisma.customer.findUnique({
        where: { clickupAccountId: accountTaskIds[0] },
      })
      customerId = customer?.id || null
    }

    // Get sales owner user ID mapping
    const clickupOwnerIds = extractUserIds(ownerField)
    let salesOwnerId: number | null = null
    if (clickupOwnerIds.length > 0) {
      salesOwnerId = await getERPUserId(clickupOwnerIds[0])
    }

    // Extract aluminum colors labels
    const aluminumColors = extractLabelsValue(colorsField)

    // Build lead data
    const leadData = {
      title: task.name,
      description: task.description || task.text_content || null,
      value: extractCurrencyValue(valueField),
      stage: erpStage,
      customerId,
      salesOwnerId,
      lastContactDate: extractDateValue(lastContactField),
      aluminumColors,
      clickupLeadId: task.id,
      clickupLastSyncedAt: new Date(),
    }

    let lead: Lead
    let action: 'created' | 'updated'

    if (existingLead) {
      // Update existing lead
      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: leadData,
      })
      action = 'updated'
    } else {
      // Create new lead
      lead = await prisma.lead.create({
        data: leadData,
      })
      action = 'created'
    }

    // Log successful sync
    await logSync({
      entityType: 'lead',
      entityId: lead.id,
      clickupTaskId: task.id,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: leadData,
    })

    return {
      success: true,
      leadId: lead.id,
      action,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'lead',
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
 * Sync an ERP Lead to ClickUp Lead/Opportunity task
 */
export async function syncERPLeadToClickUp(
  lead: Lead & { customer?: Customer | null },
  customFieldIds?: Record<string, string>
): Promise<ERPToClickUpResult> {
  try {
    const client = getClickUpClient()
    const listId = process.env.CLICKUP_LEADS_LIST_ID

    if (!listId) {
      throw new Error('CLICKUP_LEADS_LIST_ID not configured')
    }

    // Get ClickUp status from ERP stage
    const clickupStatus = getClickUpLeadStatus(lead.stage)

    // Get ClickUp user ID for sales owner
    let assignees: number[] = []
    if (lead.salesOwnerId) {
      const clickupUserId = await getClickUpUserId(lead.salesOwnerId)
      if (clickupUserId) {
        assignees = [clickupUserId]
      }
    }

    if (lead.clickupLeadId) {
      // Update existing ClickUp task
      const updateData: UpdateTaskData = {
        name: lead.title,
        description: lead.description || undefined,
        status: clickupStatus,
        assignees: assignees.length > 0 ? { add: assignees } : undefined,
      }

      await client.updateTask(lead.clickupLeadId, updateData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateLeadCustomFields(
          client,
          lead.clickupLeadId,
          lead,
          customFieldIds
        )
      }

      // Update sync timestamp
      await prisma.lead.update({
        where: { id: lead.id },
        data: { clickupLastSyncedAt: new Date() },
      })

      // Log successful sync
      await logSync({
        entityType: 'lead',
        entityId: lead.id,
        clickupTaskId: lead.clickupLeadId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: updateData,
      })

      return {
        success: true,
        clickupTaskId: lead.clickupLeadId,
        action: 'updated',
      }
    } else {
      // Create new ClickUp task
      const createData: CreateTaskData = {
        name: lead.title,
        description: lead.description || undefined,
        status: clickupStatus,
        assignees,
      }

      const newTask = await client.createTask(listId, createData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateLeadCustomFields(client, newTask.id, lead, customFieldIds)
      }

      // Store ClickUp task ID
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          clickupLeadId: newTask.id,
          clickupLastSyncedAt: new Date(),
        },
      })

      // Log successful sync
      await logSync({
        entityType: 'lead',
        entityId: lead.id,
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
      entityType: 'lead',
      entityId: lead.id,
      clickupTaskId: lead.clickupLeadId || '',
      syncDirection: 'erp_to_clickup',
      syncStatus: 'failed',
      errorMessage,
      payload: { leadId: lead.id },
    })

    return {
      success: false,
      error: errorMessage,
      action: 'skipped',
    }
  }
}

/**
 * Update custom fields on a ClickUp Lead task
 */
async function updateLeadCustomFields(
  client: ReturnType<typeof getClickUpClient>,
  taskId: string,
  lead: Lead & { customer?: Customer | null },
  fieldIds: Record<string, string>
): Promise<void> {
  const updates: Array<{ fieldId: string; value: any }> = []

  if (fieldIds.opportunityValue && lead.value !== null) {
    updates.push({ fieldId: fieldIds.opportunityValue, value: lead.value })
  }
  if (fieldIds.lastContactDate && lead.lastContactDate) {
    updates.push({ fieldId: fieldIds.lastContactDate, value: lead.lastContactDate.getTime() })
  }
  if (fieldIds.aluminumColors && lead.aluminumColors.length > 0) {
    updates.push({ fieldId: fieldIds.aluminumColors, value: lead.aluminumColors })
  }

  // Link to associated account if available
  if (fieldIds.associatedAccount && lead.customer?.clickupAccountId) {
    updates.push({
      fieldId: fieldIds.associatedAccount,
      value: [lead.customer.clickupAccountId],
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
 * Handle ClickUp Lead task deletion
 */
export async function handleLeadDeletion(clickupTaskId: string): Promise<void> {
  // Find and update the lead to remove ClickUp link
  const lead = await prisma.lead.findUnique({
    where: { clickupLeadId: clickupTaskId },
  })

  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        clickupLeadId: null,
        clickupLastSyncedAt: null,
      },
    })

    await logSync({
      entityType: 'lead',
      entityId: lead.id,
      clickupTaskId,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: { action: 'unlinked' },
    })
  }
}

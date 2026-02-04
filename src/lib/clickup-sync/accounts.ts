/**
 * Account (Customer) sync between ClickUp CRM and ERP
 */

import { prisma } from '@/lib/prisma'
import type { Customer } from '@prisma/client'
import {
  getClickUpClient,
  type ClickUpTask,
  type CreateTaskData,
  type UpdateTaskData,
} from '../clickup-client'
import {
  getCustomFieldValue,
  getCustomField,
  extractTextValue,
  extractPhoneValue,
  extractDropdownValue,
  extractUserIds,
  ACCOUNT_CUSTOM_FIELDS,
} from './field-mappings'
import {
  getERPCustomerStatus,
  getClickUpAccountStatus,
  normalizeClickUpStatus,
} from './status-mappings'
import { logSync, getClickUpUserId, getERPUserId } from './index'

// ============ ClickUp → ERP Sync ============

export interface AccountSyncResult {
  success: boolean
  customerId?: number
  error?: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Sync a ClickUp Account task to ERP Customer
 */
export async function syncClickUpAccountToERP(
  task: ClickUpTask
): Promise<AccountSyncResult> {
  try {
    // Check if this account already exists in ERP
    const existingCustomer = await prisma.customer.findUnique({
      where: { clickupAccountId: task.id },
    })

    // Extract custom field values
    const addressField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.address)
    const cityField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.city)
    const stateField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.state)
    const zipCodeField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.zipCode)
    const phoneField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.phone)
    const engagementField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.engagementLevel)
    const accountTypeField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.accountType)
    const ownerField = getCustomField(task, ACCOUNT_CUSTOM_FIELDS.accountOwner)

    // Map ClickUp status to ERP status
    const erpStatus = getERPCustomerStatus(task.status?.status || 'new account')

    // Get owner user ID mapping
    const clickupOwnerIds = extractUserIds(ownerField)
    let accountOwnerId: number | null = null
    if (clickupOwnerIds.length > 0) {
      accountOwnerId = await getERPUserId(clickupOwnerIds[0])
    }

    // Build customer data
    const customerData = {
      companyName: task.name,
      address: extractTextValue(addressField),
      city: extractTextValue(cityField),
      state: extractDropdownValue(stateField),
      zipCode: extractTextValue(zipCodeField),
      phone: extractPhoneValue(phoneField),
      status: erpStatus,
      engagementLevel: extractDropdownValue(engagementField),
      accountType: extractDropdownValue(accountTypeField),
      accountOwnerId,
      clickupAccountId: task.id,
      clickupLastSyncedAt: new Date(),
    }

    let customer: Customer
    let action: 'created' | 'updated'

    if (existingCustomer) {
      // Update existing customer
      customer = await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: customerData,
      })
      action = 'updated'
    } else {
      // Check if customer with same name exists (potential duplicate)
      const duplicateCheck = await prisma.customer.findFirst({
        where: { companyName: task.name },
      })

      if (duplicateCheck) {
        // Link existing customer to ClickUp task instead of creating duplicate
        customer = await prisma.customer.update({
          where: { id: duplicateCheck.id },
          data: {
            ...customerData,
            // Preserve existing data if ClickUp fields are empty
            address: customerData.address || duplicateCheck.address,
            city: customerData.city || duplicateCheck.city,
            state: customerData.state || duplicateCheck.state,
            zipCode: customerData.zipCode || duplicateCheck.zipCode,
            phone: customerData.phone || duplicateCheck.phone,
          },
        })
        action = 'updated'
      } else {
        // Create new customer
        customer = await prisma.customer.create({
          data: customerData,
        })
        action = 'created'
      }
    }

    // Log successful sync
    await logSync({
      entityType: 'account',
      entityId: customer.id,
      clickupTaskId: task.id,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: customerData,
    })

    return {
      success: true,
      customerId: customer.id,
      action,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'account',
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
 * Sync an ERP Customer to ClickUp Account task
 */
export async function syncERPCustomerToClickUp(
  customer: Customer,
  customFieldIds?: Record<string, string>
): Promise<ERPToClickUpResult> {
  try {
    const client = getClickUpClient()
    const listId = process.env.CLICKUP_ACCOUNTS_LIST_ID

    if (!listId) {
      throw new Error('CLICKUP_ACCOUNTS_LIST_ID not configured')
    }

    // Get ClickUp status from ERP status
    const clickupStatus = getClickUpAccountStatus(customer.status)

    // Get ClickUp user ID for account owner
    let assignees: number[] = []
    if (customer.accountOwnerId) {
      const clickupUserId = await getClickUpUserId(customer.accountOwnerId)
      if (clickupUserId) {
        assignees = [clickupUserId]
      }
    }

    if (customer.clickupAccountId) {
      // Update existing ClickUp task
      const updateData: UpdateTaskData = {
        name: customer.companyName,
        status: clickupStatus,
        assignees: assignees.length > 0 ? { add: assignees } : undefined,
      }

      const updatedTask = await client.updateTask(customer.clickupAccountId, updateData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateAccountCustomFields(
          client,
          customer.clickupAccountId,
          customer,
          customFieldIds
        )
      }

      // Update sync timestamp
      await prisma.customer.update({
        where: { id: customer.id },
        data: { clickupLastSyncedAt: new Date() },
      })

      // Log successful sync
      await logSync({
        entityType: 'account',
        entityId: customer.id,
        clickupTaskId: customer.clickupAccountId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: updateData,
      })

      return {
        success: true,
        clickupTaskId: customer.clickupAccountId,
        action: 'updated',
      }
    } else {
      // Create new ClickUp task
      const createData: CreateTaskData = {
        name: customer.companyName,
        status: clickupStatus,
        assignees,
      }

      const newTask = await client.createTask(listId, createData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateAccountCustomFields(client, newTask.id, customer, customFieldIds)
      }

      // Store ClickUp task ID
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          clickupAccountId: newTask.id,
          clickupLastSyncedAt: new Date(),
        },
      })

      // Log successful sync
      await logSync({
        entityType: 'account',
        entityId: customer.id,
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
      entityType: 'account',
      entityId: customer.id,
      clickupTaskId: customer.clickupAccountId || '',
      syncDirection: 'erp_to_clickup',
      syncStatus: 'failed',
      errorMessage,
      payload: { customerId: customer.id },
    })

    return {
      success: false,
      error: errorMessage,
      action: 'skipped',
    }
  }
}

/**
 * Update custom fields on a ClickUp Account task
 */
async function updateAccountCustomFields(
  client: ReturnType<typeof getClickUpClient>,
  taskId: string,
  customer: Customer,
  fieldIds: Record<string, string>
): Promise<void> {
  const updates: Array<{ fieldId: string; value: any }> = []

  if (fieldIds.address && customer.address) {
    updates.push({ fieldId: fieldIds.address, value: customer.address })
  }
  if (fieldIds.city && customer.city) {
    updates.push({ fieldId: fieldIds.city, value: customer.city })
  }
  if (fieldIds.state && customer.state) {
    updates.push({ fieldId: fieldIds.state, value: customer.state })
  }
  if (fieldIds.zipCode && customer.zipCode) {
    updates.push({ fieldId: fieldIds.zipCode, value: customer.zipCode })
  }
  if (fieldIds.phone && customer.phone) {
    updates.push({ fieldId: fieldIds.phone, value: customer.phone })
  }
  if (fieldIds.engagementLevel && customer.engagementLevel) {
    updates.push({ fieldId: fieldIds.engagementLevel, value: customer.engagementLevel })
  }
  if (fieldIds.accountType && customer.accountType) {
    updates.push({ fieldId: fieldIds.accountType, value: customer.accountType })
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
 * Handle ClickUp Account task deletion
 */
export async function handleAccountDeletion(clickupTaskId: string): Promise<void> {
  // Find and update the customer to remove ClickUp link
  const customer = await prisma.customer.findUnique({
    where: { clickupAccountId: clickupTaskId },
  })

  if (customer) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        clickupAccountId: null,
        clickupLastSyncedAt: null,
      },
    })

    await logSync({
      entityType: 'account',
      entityId: customer.id,
      clickupTaskId,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: { action: 'unlinked' },
    })
  }
}

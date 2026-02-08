/**
 * Contact sync between ClickUp CRM and ERP
 */

import { prisma } from '@/lib/prisma'
import type { Contact, Customer } from '@prisma/client'
import {
  getClickUpClient,
  type ClickUpTask,
  type CreateTaskData,
  type UpdateTaskData,
} from '../clickup-client'
import {
  getCustomField,
  extractTextValue,
  extractPhoneValue,
  extractDropdownValue,
  extractDateValue,
  extractLabelsValue,
  extractRelationshipIds,
  parseFullName,
  combineNames,
  CONTACT_CUSTOM_FIELDS,
} from './field-mappings'
import {
  getERPContactIsActive,
  getClickUpContactStatus,
} from './status-mappings'
import { logSync } from './index'

// ============ ClickUp → ERP Sync ============

export interface ContactSyncResult {
  success: boolean
  contactId?: number
  error?: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Sync a ClickUp Contact task to ERP Contact
 */
export async function syncClickUpContactToERP(
  task: ClickUpTask
): Promise<ContactSyncResult> {
  try {
    // Check if this contact already exists in ERP
    const existingContact = await prisma.contact.findUnique({
      where: { clickupContactId: task.id },
    })

    // Extract custom field values
    const phoneField = getCustomField(task, CONTACT_CUSTOM_FIELDS.phone)
    const emailField = getCustomField(task, CONTACT_CUSTOM_FIELDS.email)
    const accountField = getCustomField(task, CONTACT_CUSTOM_FIELDS.associatedAccount)
    const roleField = getCustomField(task, CONTACT_CUSTOM_FIELDS.contactRole)
    const relationshipField = getCustomField(task, CONTACT_CUSTOM_FIELDS.relationshipStatus)
    const lastContactField = getCustomField(task, CONTACT_CUSTOM_FIELDS.lastContactDate)
    const addressField = getCustomField(task, CONTACT_CUSTOM_FIELDS.address)
    const cityField = getCustomField(task, CONTACT_CUSTOM_FIELDS.city)
    const stateField = getCustomField(task, CONTACT_CUSTOM_FIELDS.state)
    const zipCodeField = getCustomField(task, CONTACT_CUSTOM_FIELDS.zipCode)

    // Parse name from task name
    const { firstName, lastName } = parseFullName(task.name)

    // Map ClickUp status to ERP isActive
    const isActive = getERPContactIsActive(task.status?.status || 'new contact')

    // Find associated customer by ClickUp relationship
    let customerId: number | null = null
    const accountTaskIds = extractRelationshipIds(accountField)
    if (accountTaskIds.length > 0) {
      const customer = await prisma.customer.findUnique({
        where: { clickupAccountId: accountTaskIds[0] },
      })
      customerId = customer?.id || null
    }

    // Get title from contact role labels (first label)
    const roles = extractLabelsValue(roleField)
    const title = roles.length > 0 ? roles[0] : null

    // If no customer found and no existing contact, we need a customer
    if (!customerId && !existingContact) {
      return {
        success: false,
        error: 'No associated account found for new contact',
        action: 'skipped',
      }
    }

    // Build contact data
    const contactData = {
      firstName,
      lastName,
      email: extractTextValue(emailField),
      phone: extractPhoneValue(phoneField),
      title,
      isActive,
      relationshipStatus: extractDropdownValue(relationshipField),
      lastContactDate: extractDateValue(lastContactField),
      contactAddress: extractTextValue(addressField),
      contactCity: extractTextValue(cityField),
      contactState: extractDropdownValue(stateField),
      contactZipCode: extractTextValue(zipCodeField),
      clickupContactId: task.id,
      clickupLastSyncedAt: new Date(),
    }

    let contact: Contact
    let action: 'created' | 'updated'

    if (existingContact) {
      // Update existing contact
      contact = await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          ...contactData,
          // Update customerId only if we found a new one
          customerId: customerId || existingContact.customerId,
        },
      })
      action = 'updated'
    } else {
      // Create new contact (customerId is guaranteed at this point)
      contact = await prisma.contact.create({
        data: {
          ...contactData,
          customerId: customerId!,
        },
      })
      action = 'created'
    }

    // Log successful sync
    await logSync({
      entityType: 'contact',
      entityId: contact.id,
      clickupTaskId: task.id,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: contactData,
    })

    return {
      success: true,
      contactId: contact.id,
      action,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'contact',
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
 * Sync an ERP Contact to ClickUp Contact task
 */
export async function syncERPContactToClickUp(
  contact: Contact & { customer?: Customer | null },
  customFieldIds?: Record<string, string>
): Promise<ERPToClickUpResult> {
  try {
    const client = getClickUpClient()
    const listId = process.env.CLICKUP_CONTACTS_LIST_ID

    if (!listId) {
      throw new Error('CLICKUP_CONTACTS_LIST_ID not configured')
    }

    // Get ClickUp status from ERP isActive
    const clickupStatus = getClickUpContactStatus(contact.isActive)

    // Combine name for task name
    const fullName = combineNames(contact.firstName, contact.lastName)

    if (contact.clickupContactId) {
      // Update existing ClickUp task
      const updateData: UpdateTaskData = {
        name: fullName,
        status: clickupStatus,
      }

      await client.updateTask(contact.clickupContactId, updateData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateContactCustomFields(
          client,
          contact.clickupContactId,
          contact,
          customFieldIds
        )
      }

      // Update sync timestamp
      await prisma.contact.update({
        where: { id: contact.id },
        data: { clickupLastSyncedAt: new Date() },
      })

      // Log successful sync
      await logSync({
        entityType: 'contact',
        entityId: contact.id,
        clickupTaskId: contact.clickupContactId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: updateData,
      })

      return {
        success: true,
        clickupTaskId: contact.clickupContactId,
        action: 'updated',
      }
    } else {
      // Create new ClickUp task
      const createData: CreateTaskData = {
        name: fullName,
        status: clickupStatus,
      }

      const newTask = await client.createTask(listId, createData)

      // Update custom fields if IDs are provided
      if (customFieldIds) {
        await updateContactCustomFields(client, newTask.id, contact, customFieldIds)
      }

      // Store ClickUp task ID
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          clickupContactId: newTask.id,
          clickupLastSyncedAt: new Date(),
        },
      })

      // Log successful sync
      await logSync({
        entityType: 'contact',
        entityId: contact.id,
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
      entityType: 'contact',
      entityId: contact.id,
      clickupTaskId: contact.clickupContactId || '',
      syncDirection: 'erp_to_clickup',
      syncStatus: 'failed',
      errorMessage,
      payload: { contactId: contact.id },
    })

    return {
      success: false,
      error: errorMessage,
      action: 'skipped',
    }
  }
}

/**
 * Update custom fields on a ClickUp Contact task
 */
async function updateContactCustomFields(
  client: ReturnType<typeof getClickUpClient>,
  taskId: string,
  contact: Contact & { customer?: Customer | null },
  fieldIds: Record<string, string>
): Promise<void> {
  const updates: Array<{ fieldId: string; value: any }> = []

  // Field IDs are stored by their ClickUp field name, so use CONTACT_CUSTOM_FIELDS constants
  const phoneFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.phone]
  const emailFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.email]
  const relationshipStatusFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.relationshipStatus]
  const lastContactDateFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.lastContactDate]
  const addressFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.address]
  const cityFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.city]
  const stateFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.state]
  const zipCodeFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.zipCode]

  if (phoneFieldId && contact.phone) {
    updates.push({ fieldId: phoneFieldId, value: contact.phone })
  }
  if (emailFieldId && contact.email) {
    updates.push({ fieldId: emailFieldId, value: contact.email })
  }
  if (relationshipStatusFieldId && contact.relationshipStatus) {
    updates.push({ fieldId: relationshipStatusFieldId, value: contact.relationshipStatus })
  }
  if (lastContactDateFieldId && contact.lastContactDate) {
    updates.push({ fieldId: lastContactDateFieldId, value: contact.lastContactDate.getTime() })
  }
  if (addressFieldId && contact.contactAddress) {
    updates.push({ fieldId: addressFieldId, value: contact.contactAddress })
  }
  if (cityFieldId && contact.contactCity) {
    updates.push({ fieldId: cityFieldId, value: contact.contactCity })
  }
  if (stateFieldId && contact.contactState) {
    updates.push({ fieldId: stateFieldId, value: contact.contactState })
  }
  if (zipCodeFieldId && contact.contactZipCode) {
    updates.push({ fieldId: zipCodeFieldId, value: contact.contactZipCode })
  }

  // Link to associated account if available
  // Field IDs are stored by their ClickUp field name, so use CONTACT_CUSTOM_FIELDS constant
  const associatedAccountFieldId = fieldIds[CONTACT_CUSTOM_FIELDS.associatedAccount]
  if (associatedAccountFieldId && contact.customer?.clickupAccountId) {
    updates.push({
      fieldId: associatedAccountFieldId,
      // Relationship fields require { add: [{ id: "task_id" }] } format
      value: { add: [{ id: contact.customer.clickupAccountId }] },
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
 * Handle ClickUp Contact task deletion
 */
export async function handleContactDeletion(clickupTaskId: string): Promise<void> {
  // Find and update the contact to remove ClickUp link
  const contact = await prisma.contact.findUnique({
    where: { clickupContactId: clickupTaskId },
  })

  if (contact) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        clickupContactId: null,
        clickupLastSyncedAt: null,
      },
    })

    await logSync({
      entityType: 'contact',
      entityId: contact.id,
      clickupTaskId,
      syncDirection: 'clickup_to_erp',
      syncStatus: 'success',
      payload: { action: 'unlinked' },
    })
  }
}

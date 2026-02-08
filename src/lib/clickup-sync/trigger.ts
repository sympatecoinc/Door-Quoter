/**
 * ERP → ClickUp Sync Triggers
 *
 * Fire-and-forget async triggers with conflict detection.
 * These functions are called from API routes after ERP records are created/updated.
 *
 * Non-destructive strategy:
 * 1. New records (no clickupId): Create task in ClickUp, store returned ID
 * 2. Existing records: Check if ClickUp was modified more recently than clickupLastSyncedAt
 *    - If ClickUp is newer → Log conflict, skip sync (let webhook handle ClickUp→ERP)
 *    - If ERP is newer → Safe to push to ClickUp
 * 3. Never delete ClickUp tasks when ERP records are deleted
 * 4. ERP saves always succeed - ClickUp sync failures don't block the response
 */

import { prisma } from '@/lib/prisma'
import { getClickUpClient } from '../clickup-client'
import { isSyncEnabled, logSync, getCustomFieldIds } from './index'
import { syncERPCustomerToClickUp } from './accounts'
import { syncERPContactToClickUp } from './contacts'
import { syncERPProjectToClickUp } from './leads'

/**
 * Check if the ClickUp task was updated more recently than our last sync
 */
async function isClickUpNewer(
  clickupTaskId: string,
  lastSyncedAt: Date | null
): Promise<boolean> {
  if (!lastSyncedAt) {
    // If we've never synced, we should push to ClickUp
    return false
  }

  try {
    const client = getClickUpClient()
    const task = await client.getTask(clickupTaskId, false)

    // ClickUp date_updated is a Unix timestamp in milliseconds as a string
    const clickupUpdatedAt = new Date(parseInt(task.date_updated, 10))

    // If ClickUp was updated after our last sync, there might be newer data in ClickUp
    // Add a small buffer (5 seconds) to account for timing differences
    const bufferMs = 5000
    return clickupUpdatedAt.getTime() > lastSyncedAt.getTime() + bufferMs
  } catch (error) {
    // If we can't fetch the task, assume we should try to sync
    // The sync will fail if the task doesn't exist
    console.error(`[ClickUp Sync] Failed to check task ${clickupTaskId}:`, error)
    return false
  }
}

/**
 * Trigger async sync of a Customer to ClickUp Account task
 * Fire-and-forget - does not block the API response
 */
export function triggerCustomerSync(customerId: number): void {
  if (!isSyncEnabled()) {
    return
  }

  // Fire-and-forget async operation
  Promise.resolve().then(async () => {
    try {
      // Fetch fresh customer data with relationships
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          accountOwner: true,
        },
      })

      if (!customer) {
        console.warn(`[ClickUp Sync] Customer ${customerId} not found for sync`)
        return
      }

      // Check for conflicts if already linked to ClickUp
      if (customer.clickupAccountId) {
        const isNewer = await isClickUpNewer(
          customer.clickupAccountId,
          customer.clickupLastSyncedAt
        )

        if (isNewer) {
          // Log conflict and skip - let webhook handle ClickUp → ERP sync
          await logSync({
            entityType: 'account',
            entityId: customer.id,
            clickupTaskId: customer.clickupAccountId,
            syncDirection: 'erp_to_clickup',
            syncStatus: 'conflict',
            errorMessage: 'ClickUp task was modified more recently - skipping ERP→ClickUp sync',
            payload: { customerId: customer.id, companyName: customer.companyName },
          })
          console.log(
            `[ClickUp Sync] Conflict detected for customer ${customer.companyName} - ClickUp is newer, skipping sync`
          )
          return
        }
      }

      // Get custom field IDs for the accounts list
      const fieldIds = await getCustomFieldIds()

      // Perform the sync
      const result = await syncERPCustomerToClickUp(customer, fieldIds.accounts)

      if (result.success) {
        console.log(
          `[ClickUp Sync] Customer "${customer.companyName}" synced to ClickUp (${result.action})`
        )
      } else {
        console.error(
          `[ClickUp Sync] Failed to sync customer "${customer.companyName}":`,
          result.error
        )
      }
    } catch (error) {
      console.error(`[ClickUp Sync] Error syncing customer ${customerId}:`, error)

      // Log the failure
      await logSync({
        entityType: 'account',
        entityId: customerId,
        clickupTaskId: '',
        syncDirection: 'erp_to_clickup',
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        payload: { customerId },
      }).catch((logError) => {
        console.error('[ClickUp Sync] Failed to log sync error:', logError)
      })
    }
  })
}

/**
 * Trigger async sync of a Contact to ClickUp Contact task
 * Fire-and-forget - does not block the API response
 */
export function triggerContactSync(contactId: number): void {
  if (!isSyncEnabled()) {
    return
  }

  // Fire-and-forget async operation
  Promise.resolve().then(async () => {
    try {
      // Fetch fresh contact data with customer relationship
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          customer: true,
        },
      })

      if (!contact) {
        console.warn(`[ClickUp Sync] Contact ${contactId} not found for sync`)
        return
      }

      // Check for conflicts if already linked to ClickUp
      if (contact.clickupContactId) {
        const isNewer = await isClickUpNewer(
          contact.clickupContactId,
          contact.clickupLastSyncedAt
        )

        if (isNewer) {
          // Log conflict and skip - let webhook handle ClickUp → ERP sync
          await logSync({
            entityType: 'contact',
            entityId: contact.id,
            clickupTaskId: contact.clickupContactId,
            syncDirection: 'erp_to_clickup',
            syncStatus: 'conflict',
            errorMessage: 'ClickUp task was modified more recently - skipping ERP→ClickUp sync',
            payload: { contactId: contact.id, name: `${contact.firstName} ${contact.lastName}` },
          })
          console.log(
            `[ClickUp Sync] Conflict detected for contact ${contact.firstName} ${contact.lastName} - ClickUp is newer, skipping sync`
          )
          return
        }
      }

      // Get custom field IDs for the contacts list
      const fieldIds = await getCustomFieldIds()

      // Perform the sync
      const result = await syncERPContactToClickUp(contact, fieldIds.contacts)

      if (result.success) {
        console.log(
          `[ClickUp Sync] Contact "${contact.firstName} ${contact.lastName}" synced to ClickUp (${result.action})`
        )
      } else {
        console.error(
          `[ClickUp Sync] Failed to sync contact "${contact.firstName} ${contact.lastName}":`,
          result.error
        )
      }
    } catch (error) {
      console.error(`[ClickUp Sync] Error syncing contact ${contactId}:`, error)

      // Log the failure
      await logSync({
        entityType: 'contact',
        entityId: contactId,
        clickupTaskId: '',
        syncDirection: 'erp_to_clickup',
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        payload: { contactId },
      }).catch((logError) => {
        console.error('[ClickUp Sync] Failed to log sync error:', logError)
      })
    }
  })
}

/**
 * Trigger async sync of a Project to ClickUp Lead task
 * Fire-and-forget - does not block the API response
 *
 * Handles these scenarios:
 * 1. Project has customer with clickupAccountId -> link lead to existing account
 * 2. Project has customer without clickupAccountId -> sync customer first, then link lead
 * 3. Project has prospectCompanyName but no customer -> create customer in ClickUp as "NEW CONTACT", then link lead
 */
export function triggerProjectSync(projectId: number): void {
  if (!isSyncEnabled()) {
    return
  }

  // Fire-and-forget async operation
  Promise.resolve().then(async () => {
    try {
      // Fetch fresh project data with customer relationship
      let project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          customer: {
            include: {
              contacts: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      })

      if (!project) {
        console.warn(`[ClickUp Sync] Project ${projectId} not found for sync`)
        return
      }

      // Get custom field IDs for all lists
      const fieldIds = await getCustomFieldIds()

      // Handle customer/account creation/sync before syncing the lead
      // Case 1: Project has a customer that's NOT yet in ClickUp -> sync customer first
      if (project.customer && !project.customer.clickupAccountId) {
        console.log(
          `[ClickUp Sync] Customer "${project.customer.companyName}" not in ClickUp, syncing first...`
        )
        const customerResult = await syncERPCustomerToClickUp(project.customer, fieldIds.accounts)
        if (customerResult.success) {
          console.log(
            `[ClickUp Sync] Customer "${project.customer.companyName}" synced to ClickUp (${customerResult.action})`
          )
          // Refresh the project to get updated customer with clickupAccountId
          project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
              customer: {
                include: {
                  contacts: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          })
          if (!project) {
            console.warn(`[ClickUp Sync] Project ${projectId} not found after customer sync`)
            return
          }
        } else {
          console.error(
            `[ClickUp Sync] Failed to sync customer "${project.customer.companyName}":`,
            customerResult.error
          )
          // Continue with lead sync even if customer sync failed
        }
      }
      // Case 2: Project has NO customer but has prospectCompanyName -> create customer in ClickUp
      else if (!project.customer && project.prospectCompanyName) {
        console.log(
          `[ClickUp Sync] Creating new customer "${project.prospectCompanyName}" in ClickUp from prospect...`
        )

        // Create a new Customer record in ERP from the prospect info
        const newCustomer = await prisma.customer.create({
          data: {
            companyName: project.prospectCompanyName,
            phone: project.prospectPhone,
            address: project.prospectAddress,
            city: project.prospectCity,
            state: project.prospectState,
            zipCode: project.prospectZipCode,
            status: 'Lead', // Mark as Lead in ERP
          },
        })

        // Link the project to the new customer
        await prisma.project.update({
          where: { id: projectId },
          data: { customerId: newCustomer.id },
        })

        // Sync the new customer to ClickUp with "new contact" status
        // The syncERPCustomerToClickUp will create it with the appropriate status
        const customerResult = await syncERPCustomerToClickUpAsNewContact(
          newCustomer,
          fieldIds.accounts
        )

        if (customerResult.success) {
          console.log(
            `[ClickUp Sync] New customer "${newCustomer.companyName}" created in ClickUp as NEW CONTACT`
          )
          // Refresh the project to get updated customer with clickupAccountId
          project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
              customer: {
                include: {
                  contacts: {
                    where: { isPrimary: true },
                    take: 1,
                  },
                },
              },
            },
          })
          if (!project) {
            console.warn(`[ClickUp Sync] Project ${projectId} not found after customer creation`)
            return
          }
        } else {
          console.error(
            `[ClickUp Sync] Failed to create customer "${newCustomer.companyName}" in ClickUp:`,
            customerResult.error
          )
          // Continue with lead sync even if customer creation failed
        }
      }

      // Check for conflicts if already linked to ClickUp
      if (project.clickupLeadId) {
        const isNewer = await isClickUpNewer(
          project.clickupLeadId,
          project.clickupLastSyncedAt
        )

        if (isNewer) {
          // Log conflict and skip - let webhook handle ClickUp → ERP sync
          await logSync({
            entityType: 'project',
            entityId: project.id,
            clickupTaskId: project.clickupLeadId,
            syncDirection: 'erp_to_clickup',
            syncStatus: 'conflict',
            errorMessage: 'ClickUp task was modified more recently - skipping ERP→ClickUp sync',
            payload: { projectId: project.id, name: project.name },
          })
          console.log(
            `[ClickUp Sync] Conflict detected for project ${project.name} - ClickUp is newer, skipping sync`
          )
          return
        }
      }

      // Perform the lead sync
      const result = await syncERPProjectToClickUp(project, fieldIds.leads)

      if (result.success) {
        console.log(
          `[ClickUp Sync] Project "${project.name}" synced to ClickUp (${result.action})`
        )
      } else {
        console.error(
          `[ClickUp Sync] Failed to sync project "${project.name}":`,
          result.error
        )
      }
    } catch (error) {
      console.error(`[ClickUp Sync] Error syncing project ${projectId}:`, error)

      // Log the failure
      await logSync({
        entityType: 'project',
        entityId: projectId,
        clickupTaskId: '',
        syncDirection: 'erp_to_clickup',
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        payload: { projectId },
      }).catch((logError) => {
        console.error('[ClickUp Sync] Failed to log sync error:', logError)
      })
    }
  })
}

/**
 * Sync a customer to ClickUp with "new contact" status
 * Used when creating a customer from a prospect
 */
/**
 * Trigger async deletion of a ClickUp Lead task when ERP project is deleted
 * Fire-and-forget - does not block the API response
 */
export function triggerProjectDeletion(clickupLeadId: string): void {
  if (!isSyncEnabled()) {
    return
  }

  // Fire-and-forget async operation
  Promise.resolve().then(async () => {
    try {
      const client = getClickUpClient()
      await client.deleteTask(clickupLeadId)
      console.log(`[ClickUp Sync] Deleted ClickUp task ${clickupLeadId}`)

      // Log successful deletion
      await logSync({
        entityType: 'project',
        entityId: 0,
        clickupTaskId: clickupLeadId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'success',
        payload: { action: 'deleted' },
      })
    } catch (error) {
      console.error(`[ClickUp Sync] Failed to delete ClickUp task ${clickupLeadId}:`, error)

      // Log the failure
      await logSync({
        entityType: 'project',
        entityId: 0,
        clickupTaskId: clickupLeadId,
        syncDirection: 'erp_to_clickup',
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        payload: { action: 'delete', clickupLeadId },
      }).catch((logError) => {
        console.error('[ClickUp Sync] Failed to log sync error:', logError)
      })
    }
  })
}

async function syncERPCustomerToClickUpAsNewContact(
  customer: { id: number; companyName: string; phone?: string | null; address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null },
  customFieldIds?: Record<string, string>
): Promise<{ success: boolean; clickupTaskId?: string; error?: string; action: 'created' | 'updated' | 'skipped' }> {
  try {
    const client = getClickUpClient()
    const listId = process.env.CLICKUP_ACCOUNTS_LIST_ID

    if (!listId) {
      throw new Error('CLICKUP_ACCOUNTS_LIST_ID not configured')
    }

    // Create new ClickUp task with "new contact" status
    const createData = {
      name: customer.companyName,
      status: 'new contact', // ClickUp status for new accounts from ERP
    }

    const newTask = await client.createTask(listId, createData)

    // Store ClickUp task ID on the customer
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
      payload: { ...createData, source: 'prospect_conversion' },
    })

    return {
      success: true,
      clickupTaskId: newTask.id,
      action: 'created',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Log failed sync
    await logSync({
      entityType: 'account',
      entityId: customer.id,
      clickupTaskId: '',
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

/**
 * ClickUp CRM Sync Service
 *
 * Main entry point for bi-directional sync between ClickUp CRM and ERP.
 */

import { prisma } from '@/lib/prisma'
import { getClickUpClient, type ClickUpTask, type ClickUpWebhookPayload } from '../clickup-client'

// Re-export entity sync functions
export { syncClickUpAccountToERP, syncERPCustomerToClickUp, handleAccountDeletion } from './accounts'
export { syncClickUpContactToERP, syncERPContactToClickUp, handleContactDeletion } from './contacts'
export { syncClickUpLeadToERP, syncERPProjectToClickUp, handleLeadDeletion } from './leads'

// Re-export mappings
export * from './status-mappings'
export * from './field-mappings'

// ============ Sync Configuration ============

export function isSyncEnabled(): boolean {
  return process.env.CLICKUP_SYNC_ENABLED === 'true'
}

export function getListIdForEntityType(entityType: 'account' | 'contact' | 'lead'): string | undefined {
  switch (entityType) {
    case 'account':
      return process.env.CLICKUP_ACCOUNTS_LIST_ID
    case 'contact':
      return process.env.CLICKUP_CONTACTS_LIST_ID
    case 'lead':
      return process.env.CLICKUP_LEADS_LIST_ID
  }
}

// ============ User Mapping ============

/**
 * Get ClickUp user ID from ERP user ID
 */
export async function getClickUpUserId(erpUserId: number): Promise<number | null> {
  const mapping = await prisma.clickUpUserMapping.findUnique({
    where: { erpUserId },
  })
  return mapping?.clickupUserId || null
}

/**
 * Get ERP user ID from ClickUp user ID
 */
export async function getERPUserId(clickupUserId: number): Promise<number | null> {
  const mapping = await prisma.clickUpUserMapping.findUnique({
    where: { clickupUserId },
  })
  return mapping?.erpUserId || null
}

/**
 * Create or update user mapping
 */
export async function upsertUserMapping(
  erpUserId: number,
  clickupUserId: number,
  clickupUsername?: string,
  clickupEmail?: string
): Promise<void> {
  await prisma.clickUpUserMapping.upsert({
    where: { erpUserId },
    create: {
      erpUserId,
      clickupUserId,
      clickupUsername,
      clickupEmail,
    },
    update: {
      clickupUserId,
      clickupUsername,
      clickupEmail,
    },
  })
}

// ============ Sync Logging ============

export interface SyncLogData {
  entityType: string
  entityId: number
  clickupTaskId: string
  syncDirection: 'clickup_to_erp' | 'erp_to_clickup'
  syncStatus: 'success' | 'failed' | 'conflict'
  errorMessage?: string
  payload?: any
}

/**
 * Log a sync operation
 */
export async function logSync(data: SyncLogData): Promise<void> {
  try {
    await prisma.clickUpSyncLog.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        clickupTaskId: data.clickupTaskId,
        syncDirection: data.syncDirection,
        syncStatus: data.syncStatus,
        errorMessage: data.errorMessage,
        payload: data.payload ? JSON.parse(JSON.stringify(data.payload)) : undefined,
      },
    })
  } catch (error) {
    console.error('Failed to log sync operation:', error)
  }
}

/**
 * Get recent sync logs for an entity
 */
export async function getSyncLogs(
  entityType: string,
  entityId: number,
  limit = 10
): Promise<any[]> {
  return prisma.clickUpSyncLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get failed sync logs for review
 */
export async function getFailedSyncLogs(limit = 50): Promise<any[]> {
  return prisma.clickUpSyncLog.findMany({
    where: { syncStatus: 'failed' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// ============ Webhook Processing ============

/**
 * Determine entity type from list ID
 */
export function getEntityTypeFromListId(listId: string): 'account' | 'contact' | 'lead' | null {
  if (listId === process.env.CLICKUP_ACCOUNTS_LIST_ID) return 'account'
  if (listId === process.env.CLICKUP_CONTACTS_LIST_ID) return 'contact'
  if (listId === process.env.CLICKUP_LEADS_LIST_ID) return 'lead'
  return null
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET
  if (!secret || !signature) return false

  // ClickUp uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto')
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return signature === expectedSignature
}

// ============ Bulk Sync Operations ============

/**
 * Sync all accounts from ClickUp to ERP
 */
export async function syncAllAccountsFromClickUp(): Promise<{
  total: number
  synced: number
  errors: string[]
}> {
  const client = getClickUpClient()
  const listId = process.env.CLICKUP_ACCOUNTS_LIST_ID

  if (!listId) {
    return { total: 0, synced: 0, errors: ['CLICKUP_ACCOUNTS_LIST_ID not configured'] }
  }

  const { syncClickUpAccountToERP } = await import('./accounts')

  const errors: string[] = []
  let synced = 0
  let page = 0
  let total = 0

  try {
    while (true) {
      const response = await client.getTasks(listId, { page })
      const tasks = response.tasks

      if (tasks.length === 0) break

      total += tasks.length

      for (const task of tasks) {
        const result = await syncClickUpAccountToERP(task)
        if (result.success) {
          synced++
        } else if (result.error) {
          errors.push(`${task.name}: ${result.error}`)
        }
      }

      page++
    }
  } catch (error) {
    errors.push(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { total, synced, errors }
}

/**
 * Sync all contacts from ClickUp to ERP
 */
export async function syncAllContactsFromClickUp(): Promise<{
  total: number
  synced: number
  errors: string[]
}> {
  const client = getClickUpClient()
  const listId = process.env.CLICKUP_CONTACTS_LIST_ID

  if (!listId) {
    return { total: 0, synced: 0, errors: ['CLICKUP_CONTACTS_LIST_ID not configured'] }
  }

  const { syncClickUpContactToERP } = await import('./contacts')

  const errors: string[] = []
  let synced = 0
  let page = 0
  let total = 0

  try {
    while (true) {
      const response = await client.getTasks(listId, { page })
      const tasks = response.tasks

      if (tasks.length === 0) break

      total += tasks.length

      for (const task of tasks) {
        const result = await syncClickUpContactToERP(task)
        if (result.success) {
          synced++
        } else if (result.error) {
          errors.push(`${task.name}: ${result.error}`)
        }
      }

      page++
    }
  } catch (error) {
    errors.push(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { total, synced, errors }
}

/**
 * Sync all leads from ClickUp to ERP
 */
export async function syncAllLeadsFromClickUp(): Promise<{
  total: number
  synced: number
  errors: string[]
}> {
  const client = getClickUpClient()
  const listId = process.env.CLICKUP_LEADS_LIST_ID

  if (!listId) {
    return { total: 0, synced: 0, errors: ['CLICKUP_LEADS_LIST_ID not configured'] }
  }

  const { syncClickUpLeadToERP } = await import('./leads')

  const errors: string[] = []
  let synced = 0
  let page = 0
  let total = 0

  try {
    while (true) {
      const response = await client.getTasks(listId, { page })
      const tasks = response.tasks

      if (tasks.length === 0) break

      total += tasks.length

      for (const task of tasks) {
        // Skip subtasks - only sync top-level leads
        if (task.parent) {
          console.log(`[ClickUp Sync] Skipping subtask "${task.name}" (parent: ${task.parent})`)
          continue
        }

        const result = await syncClickUpLeadToERP(task)
        if (result.success) {
          synced++
        } else if (result.error) {
          errors.push(`${task.name}: ${result.error}`)
        }
      }

      page++
    }
  } catch (error) {
    errors.push(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return { total, synced, errors }
}

// ============ Custom Field ID Cache ============

let customFieldIdCache: Record<string, Record<string, string>> | null = null

/**
 * Fetch and cache custom field IDs for all CRM lists
 */
export async function getCustomFieldIds(): Promise<Record<string, Record<string, string>>> {
  if (customFieldIdCache) return customFieldIdCache

  const client = getClickUpClient()
  const cache: Record<string, Record<string, string>> = {
    accounts: {},
    contacts: {},
    leads: {},
  }

  try {
    // Fetch account custom fields
    const accountsListId = process.env.CLICKUP_ACCOUNTS_LIST_ID
    if (accountsListId) {
      const fields = await client.getCustomFields(accountsListId)
      for (const field of fields.fields) {
        cache.accounts[field.name] = field.id
      }
    }

    // Fetch contact custom fields
    const contactsListId = process.env.CLICKUP_CONTACTS_LIST_ID
    if (contactsListId) {
      const fields = await client.getCustomFields(contactsListId)
      for (const field of fields.fields) {
        cache.contacts[field.name] = field.id
      }
    }

    // Fetch lead custom fields
    const leadsListId = process.env.CLICKUP_LEADS_LIST_ID
    if (leadsListId) {
      const fields = await client.getCustomFields(leadsListId)
      for (const field of fields.fields) {
        cache.leads[field.name] = field.id
      }
    }

    customFieldIdCache = cache
  } catch (error) {
    console.error('Failed to fetch custom field IDs:', error)
  }

  return cache
}

/**
 * Clear the custom field ID cache (e.g., after field changes)
 */
export function clearCustomFieldIdCache(): void {
  customFieldIdCache = null
}

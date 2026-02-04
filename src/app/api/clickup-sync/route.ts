/**
 * ClickUp CRM Sync Management API
 *
 * Endpoints for managing ClickUp CRM sync:
 * - GET: Get sync status and recent logs
 * - POST: Trigger bulk sync operations
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  isSyncEnabled,
  getFailedSyncLogs,
  syncAllAccountsFromClickUp,
  syncAllContactsFromClickUp,
  syncAllLeadsFromClickUp,
  getCustomFieldIds,
  clearCustomFieldIdCache,
} from '@/lib/clickup-sync'
import { prisma } from '@/lib/prisma'

// GET: Get sync status and logs
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'logs') {
      // Get recent failed sync logs
      const limit = parseInt(searchParams.get('limit') || '50', 10)
      const logs = await getFailedSyncLogs(limit)
      return NextResponse.json({ logs })
    }

    if (action === 'stats') {
      // Get sync statistics
      const [
        totalAccounts,
        syncedAccounts,
        totalContacts,
        syncedContacts,
        totalLeads,
        syncedLeads,
        recentLogs,
      ] = await Promise.all([
        prisma.customer.count(),
        prisma.customer.count({ where: { clickupAccountId: { not: null } } }),
        prisma.contact.count(),
        prisma.contact.count({ where: { clickupContactId: { not: null } } }),
        prisma.lead.count(),
        prisma.lead.count({ where: { clickupLeadId: { not: null } } }),
        prisma.clickUpSyncLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

      return NextResponse.json({
        syncEnabled: isSyncEnabled(),
        stats: {
          accounts: { total: totalAccounts, synced: syncedAccounts },
          contacts: { total: totalContacts, synced: syncedContacts },
          leads: { total: totalLeads, synced: syncedLeads },
        },
        recentLogs,
      })
    }

    if (action === 'fields') {
      // Get cached custom field IDs
      const fieldIds = await getCustomFieldIds()
      return NextResponse.json({ fieldIds })
    }

    // Default: return sync configuration status
    return NextResponse.json({
      syncEnabled: isSyncEnabled(),
      config: {
        accountsListId: process.env.CLICKUP_ACCOUNTS_LIST_ID || null,
        contactsListId: process.env.CLICKUP_CONTACTS_LIST_ID || null,
        leadsListId: process.env.CLICKUP_LEADS_LIST_ID || null,
        crmSpaceId: process.env.CLICKUP_CRM_SPACE_ID || null,
      },
    })
  } catch (error) {
    console.error('[ClickUp Sync API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Trigger sync operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, entityType } = body

    if (!isSyncEnabled()) {
      return NextResponse.json(
        { error: 'Sync is disabled. Set CLICKUP_SYNC_ENABLED=true to enable.' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'sync-all': {
        // Sync all entities from ClickUp
        const results = {
          accounts: { total: 0, synced: 0, errors: [] as string[] },
          contacts: { total: 0, synced: 0, errors: [] as string[] },
          leads: { total: 0, synced: 0, errors: [] as string[] },
        }

        if (!entityType || entityType === 'accounts') {
          results.accounts = await syncAllAccountsFromClickUp()
        }
        if (!entityType || entityType === 'contacts') {
          results.contacts = await syncAllContactsFromClickUp()
        }
        if (!entityType || entityType === 'leads') {
          results.leads = await syncAllLeadsFromClickUp()
        }

        return NextResponse.json({
          message: 'Bulk sync completed',
          results,
        })
      }

      case 'refresh-fields': {
        // Clear and refresh custom field ID cache
        clearCustomFieldIdCache()
        const fieldIds = await getCustomFieldIds()
        return NextResponse.json({
          message: 'Custom field cache refreshed',
          fieldIds,
        })
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[ClickUp Sync API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

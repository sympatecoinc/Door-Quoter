/**
 * ClickUp Webhook Management API
 *
 * Endpoints for setting up and managing ClickUp webhooks:
 * - GET: List existing webhooks
 * - POST: Create webhooks for CRM lists
 * - DELETE: Remove webhooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient, type ClickUpWebhookEvent } from '@/lib/clickup-client'

const CRM_WEBHOOK_EVENTS: ClickUpWebhookEvent[] = [
  'taskCreated',
  'taskUpdated',
  'taskDeleted',
  'taskStatusUpdated',
]

// GET: List existing webhooks
export async function GET() {
  try {
    const teamId = process.env.CLICKUP_TEAM_ID
    if (!teamId) {
      return NextResponse.json(
        { error: 'CLICKUP_TEAM_ID not configured' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()
    const { webhooks } = await client.getWebhooks(teamId)

    // Filter to only CRM-related webhooks (by list ID)
    const crmListIds = [
      process.env.CLICKUP_ACCOUNTS_LIST_ID,
      process.env.CLICKUP_CONTACTS_LIST_ID,
      process.env.CLICKUP_LEADS_LIST_ID,
    ].filter(Boolean)

    const crmWebhooks = webhooks.filter(
      (webhook) => webhook.list_id && crmListIds.includes(webhook.list_id)
    )

    return NextResponse.json({
      webhooks: crmWebhooks,
      total: webhooks.length,
      crmTotal: crmWebhooks.length,
    })
  } catch (error) {
    console.error('[ClickUp Webhooks API] Error listing webhooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Create webhooks for CRM lists
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { baseUrl } = body

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'baseUrl is required (e.g., https://your-domain.com)' },
        { status: 400 }
      )
    }

    const teamId = process.env.CLICKUP_TEAM_ID
    if (!teamId) {
      return NextResponse.json(
        { error: 'CLICKUP_TEAM_ID not configured' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()
    const results: Array<{
      list: string
      success: boolean
      webhookId?: string
      error?: string
    }> = []

    // Create webhook for Accounts list
    const accountsListId = process.env.CLICKUP_ACCOUNTS_LIST_ID
    if (accountsListId) {
      try {
        const webhook = await client.createWebhook(teamId, {
          endpoint: `${baseUrl}/api/webhooks/clickup/accounts`,
          events: CRM_WEBHOOK_EVENTS,
          list_id: accountsListId,
        })
        results.push({
          list: 'accounts',
          success: true,
          webhookId: webhook.id,
        })
      } catch (error) {
        results.push({
          list: 'accounts',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Create webhook for Contacts list
    const contactsListId = process.env.CLICKUP_CONTACTS_LIST_ID
    if (contactsListId) {
      try {
        const webhook = await client.createWebhook(teamId, {
          endpoint: `${baseUrl}/api/webhooks/clickup/contacts`,
          events: CRM_WEBHOOK_EVENTS,
          list_id: contactsListId,
        })
        results.push({
          list: 'contacts',
          success: true,
          webhookId: webhook.id,
        })
      } catch (error) {
        results.push({
          list: 'contacts',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Create webhook for Leads list
    const leadsListId = process.env.CLICKUP_LEADS_LIST_ID
    if (leadsListId) {
      try {
        const webhook = await client.createWebhook(teamId, {
          endpoint: `${baseUrl}/api/webhooks/clickup/leads`,
          events: CRM_WEBHOOK_EVENTS,
          list_id: leadsListId,
        })
        results.push({
          list: 'leads',
          success: true,
          webhookId: webhook.id,
        })
      } catch (error) {
        results.push({
          list: 'leads',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      message: 'Webhook setup completed',
      results,
    })
  } catch (error) {
    console.error('[ClickUp Webhooks API] Error creating webhooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a webhook
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const webhookId = searchParams.get('webhookId')

    if (!webhookId) {
      return NextResponse.json(
        { error: 'webhookId query parameter is required' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()
    await client.deleteWebhook(webhookId)

    return NextResponse.json({
      message: 'Webhook deleted successfully',
      webhookId,
    })
  } catch (error) {
    console.error('[ClickUp Webhooks API] Error deleting webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * ClickUp Contacts Webhook Handler
 *
 * Receives webhook events from ClickUp for the Contacts list
 * and syncs changes to ERP Contact records.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'
import {
  isSyncEnabled,
  verifyWebhookSignature,
  syncClickUpContactToERP,
  handleContactDeletion,
  logSync,
} from '@/lib/clickup-sync'

export async function POST(request: NextRequest) {
  try {
    // Check if sync is enabled
    if (!isSyncEnabled()) {
      return NextResponse.json(
        { message: 'Sync is disabled' },
        { status: 200 }
      )
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature')

    // Verify webhook signature (optional but recommended)
    if (process.env.CLICKUP_WEBHOOK_SECRET && signature) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn('Invalid webhook signature for contacts webhook')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    // Parse the payload
    const payload = JSON.parse(rawBody)

    // ClickUp sends different event structures
    const event = payload.event
    const taskId = payload.task_id

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing task_id in payload' },
        { status: 400 }
      )
    }

    console.log(`[ClickUp Webhook] Contacts event: ${event}, Task: ${taskId}`)

    // Handle different events
    switch (event) {
      case 'taskCreated':
      case 'taskUpdated':
      case 'taskStatusUpdated': {
        // Fetch the full task details
        const client = getClickUpClient()
        const task = await client.getTask(taskId)

        // Verify this task is in the correct list
        if (task.list?.id !== process.env.CLICKUP_CONTACTS_LIST_ID) {
          console.log(`[ClickUp Webhook] Task ${taskId} is not in Contacts list, skipping`)
          return NextResponse.json({ message: 'Task not in Contacts list' })
        }

        // Sync to ERP
        const result = await syncClickUpContactToERP(task)

        if (result.success) {
          return NextResponse.json({
            message: 'Contact synced successfully',
            action: result.action,
            contactId: result.contactId,
          })
        } else {
          return NextResponse.json({
            message: 'Contact sync failed',
            error: result.error,
          })
        }
      }

      case 'taskDeleted': {
        // Handle contact deletion - unlink from ERP (don't delete)
        await handleContactDeletion(taskId)
        return NextResponse.json({
          message: 'Contact unlinked from ERP',
        })
      }

      default:
        // Ignore other events
        return NextResponse.json({
          message: `Event ${event} ignored`,
        })
    }
  } catch (error) {
    console.error('[ClickUp Webhook] Error processing contacts webhook:', error)

    // Log the error
    await logSync({
      entityType: 'contact',
      entityId: 0,
      clickupTaskId: 'unknown',
      syncDirection: 'clickup_to_erp',
      syncStatus: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ClickUp sends a HEAD request to verify the endpoint
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

// ClickUp may also send GET for verification
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'clickup-contacts-webhook' })
}

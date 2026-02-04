/**
 * ClickUp Leads/Opportunities Webhook Handler
 *
 * Receives webhook events from ClickUp for the Leads/Opportunities list
 * and syncs changes to ERP Projects (in lead phase).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'
import {
  isSyncEnabled,
  verifyWebhookSignature,
  syncClickUpLeadToERP,
  handleLeadDeletion,
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
        console.warn('Invalid webhook signature for leads webhook')
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

    console.log(`[ClickUp Webhook] Leads event: ${event}, Task: ${taskId}`)

    // Handle different events
    switch (event) {
      case 'taskCreated':
      case 'taskUpdated':
      case 'taskStatusUpdated': {
        // Fetch the full task details
        const client = getClickUpClient()
        const task = await client.getTask(taskId)

        // Verify this task is in the correct list
        if (task.list?.id !== process.env.CLICKUP_LEADS_LIST_ID) {
          console.log(`[ClickUp Webhook] Task ${taskId} is not in Leads list, skipping`)
          return NextResponse.json({ message: 'Task not in Leads list' })
        }

        // Skip subtasks - only sync top-level leads
        if (task.parent) {
          console.log(`[ClickUp Webhook] Task ${taskId} is a subtask, skipping`)
          return NextResponse.json({ message: 'Subtask ignored - only top-level leads are synced' })
        }

        // Sync to ERP
        const result = await syncClickUpLeadToERP(task)

        if (result.success) {
          return NextResponse.json({
            message: 'Lead synced to Project successfully',
            action: result.action,
            projectId: result.projectId,
          })
        } else {
          return NextResponse.json({
            message: 'Lead sync failed',
            error: result.error,
          })
        }
      }

      case 'taskDeleted': {
        // Handle lead deletion - unlink from ERP (don't delete)
        await handleLeadDeletion(taskId)
        return NextResponse.json({
          message: 'Lead unlinked from ERP',
        })
      }

      default:
        // Ignore other events
        return NextResponse.json({
          message: `Event ${event} ignored`,
        })
    }
  } catch (error) {
    console.error('[ClickUp Webhook] Error processing leads webhook:', error)

    // Log the error
    await logSync({
      entityType: 'project',
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
  return NextResponse.json({ status: 'ok', endpoint: 'clickup-leads-webhook' })
}

import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, processWebhookEvents } from '@/lib/quickbooks-webhooks'

// QuickBooks webhooks endpoint
// This endpoint receives real-time notifications when POs are created/updated in QuickBooks

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text()

    // Get the signature from headers
    const signature = request.headers.get('intuit-signature')

    if (!signature) {
      console.warn('[QB Webhook] Missing intuit-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Verify the webhook signature
    const webhookSecret = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN
    if (!webhookSecret) {
      console.error('[QB Webhook] QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN not configured')
      // Still return 200 to prevent QB from retrying
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 200 })
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      console.warn('[QB Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse the payload
    const payload = JSON.parse(rawBody)
    console.log('[QB Webhook] Received webhook:', JSON.stringify(payload, null, 2))

    // Process events asynchronously (don't wait - QB has a 5 second timeout)
    // We return 200 immediately and process in background
    processWebhookEvents(payload).catch(error => {
      console.error('[QB Webhook] Error processing events:', error)
    })

    return NextResponse.json({ status: 'received' }, { status: 200 })
  } catch (error) {
    console.error('[QB Webhook] Error handling webhook:', error)
    // Return 200 even on error to prevent QB from excessive retries
    return NextResponse.json({ error: 'Processing error' }, { status: 200 })
  }
}

// QuickBooks sends a GET request to verify the endpoint during setup
export async function GET(request: NextRequest) {
  // Return 200 to confirm the endpoint is active
  return NextResponse.json({
    status: 'active',
    message: 'QuickBooks webhook endpoint is ready'
  })
}

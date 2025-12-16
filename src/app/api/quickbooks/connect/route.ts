import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/quickbooks'

export async function GET(request: NextRequest) {
  try {
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15)

    // Get the authorization URL
    const authUrl = getAuthorizationUrl(state)

    // Return the URL for the frontend to redirect to
    return NextResponse.json({ authUrl, state })
  } catch (error) {
    console.error('Error generating QuickBooks auth URL:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate QuickBooks connection' },
      { status: 500 }
    )
  }
}

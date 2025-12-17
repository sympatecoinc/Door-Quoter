import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/quickbooks'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const realmId = searchParams.get('realmId')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('QuickBooks OAuth error:', error, errorDescription)
      // Redirect to vendors page with error
      return NextResponse.redirect(
        new URL(`/?menu=vendors&qb_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      )
    }

    // Validate required parameters
    if (!code || !realmId) {
      return NextResponse.redirect(
        new URL('/?menu=vendors&qb_error=Missing+authorization+code+or+realm+ID', request.url)
      )
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code, realmId)

    // Redirect to vendors page with success
    return NextResponse.redirect(
      new URL('/?menu=vendors&qb_connected=true', request.url)
    )
  } catch (error) {
    console.error('Error handling QuickBooks callback:', error)
    const errorMsg = error instanceof Error ? error.message : 'Failed to complete QuickBooks connection'
    return NextResponse.redirect(
      new URL(`/?menu=vendors&qb_error=${encodeURIComponent(errorMsg)}`, request.url)
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { isQuickBooksConnected, getQBConfig } from '@/lib/quickbooks'

export async function GET(request: NextRequest) {
  try {
    const connectionStatus = await isQuickBooksConnected()

    // Check if credentials are configured
    let credentialsConfigured = false
    try {
      getQBConfig()
      credentialsConfigured = true
    } catch {
      credentialsConfigured = false
    }

    return NextResponse.json({
      ...connectionStatus,
      credentialsConfigured
    })
  } catch (error) {
    console.error('Error checking QuickBooks status:', error)
    return NextResponse.json(
      { error: 'Failed to check QuickBooks status' },
      { status: 500 }
    )
  }
}

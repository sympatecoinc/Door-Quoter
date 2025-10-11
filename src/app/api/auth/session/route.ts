import { NextResponse } from 'next/server'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'

/**
 * GET /api/auth/session
 * Get current user session
 */
export async function GET() {
  try {
    // Get session token from cookie
    const sessionToken = await getSessionToken()

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session found' },
        { status: 401 }
      )
    }

    // Validate session and get user
    const session = await getSessionWithUser(sessionToken)

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user: session.user })
  } catch (error) {
    console.error('Error validating session:', error)
    return NextResponse.json(
      { error: 'Failed to validate session' },
      { status: 500 }
    )
  }
}

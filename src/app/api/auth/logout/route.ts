import { NextResponse } from 'next/server'
import { getSessionToken, deleteSessionCookie } from '@/lib/auth'
import { deleteSession } from '@/lib/db-session'

/**
 * POST /api/auth/logout
 * Logout user and destroy session
 */
export async function POST() {
  try {
    // Get session token from cookie
    const sessionToken = await getSessionToken()

    if (sessionToken) {
      // Delete session from database
      await deleteSession(sessionToken)
    }

    // Delete session cookie
    await deleteSessionCookie()

    return NextResponse.json({ message: 'Logout successful' })
  } catch (error) {
    console.error('Error during logout:', error)
    // Still delete cookie even if database deletion fails
    await deleteSessionCookie()
    return NextResponse.json(
      { error: 'Logout completed with warnings' },
      { status: 200 }
    )
  }
}

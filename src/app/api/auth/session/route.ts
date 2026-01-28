import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import {
  getSubdomainFromHostname,
  getPortalBySubdomain,
  getPortalPermissions,
  toPortalContext,
  isMainAppSubdomain
} from '@/lib/portals'

/**
 * GET /api/auth/session
 * Get current user session with portal context
 *
 * Returns:
 * - user: User object with effectivePermissions adjusted for portal
 * - portal: Portal context if on a portal subdomain, null otherwise
 */
export async function GET(request: NextRequest) {
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

    // Detect subdomain from request headers
    const headerStore = await headers()
    const host = headerStore.get('host') || ''
    const subdomain = getSubdomainFromHostname(host)

    // If main app subdomain (or no subdomain), return user with full permissions
    if (isMainAppSubdomain(subdomain)) {
      return NextResponse.json({
        user: session.user,
        portal: null
      })
    }

    // Lookup portal for this subdomain
    const portalConfig = await getPortalBySubdomain(subdomain)

    // If no portal found for this subdomain, treat as main app
    if (!portalConfig) {
      return NextResponse.json({
        user: session.user,
        portal: null
      })
    }

    // Calculate effective permissions intersected with portal tabs
    const userPermissions = session.user.effectivePermissions || session.user.permissions || []
    const portalPermissions = getPortalPermissions(userPermissions, portalConfig.tabs)

    // Return user with portal-restricted permissions
    return NextResponse.json({
      user: {
        ...session.user,
        effectivePermissions: portalPermissions
      },
      portal: toPortalContext(portalConfig)
    })
  } catch (error) {
    console.error('Error validating session:', error)
    return NextResponse.json(
      { error: 'Failed to validate session' },
      { status: 500 }
    )
  }
}

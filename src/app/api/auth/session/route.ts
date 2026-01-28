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
    let subdomain = getSubdomainFromHostname(host)

    // Allow query parameter override for testing (e.g., ?portal=purchasing)
    const url = new URL(request.url)
    const portalOverride = url.searchParams.get('portal')
    if (portalOverride) {
      subdomain = portalOverride
    }

    // If main app subdomain (or no subdomain) and no override, return user with full permissions
    if (isMainAppSubdomain(subdomain) && !portalOverride) {
      return NextResponse.json({
        user: session.user,
        portal: null
      })
    }

    // Lookup portal for this subdomain (with graceful fallback if Portals table doesn't exist)
    let portalConfig = null
    try {
      portalConfig = await getPortalBySubdomain(subdomain)
    } catch (portalError) {
      // If Portals table doesn't exist or other DB error, continue without portal context
      console.warn('Portal lookup failed (table may not exist):', portalError)
    }

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

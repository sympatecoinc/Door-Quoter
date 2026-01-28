import { NextRequest, NextResponse } from 'next/server'
import { getPortalBySubdomain } from '@/lib/portals'

/**
 * GET /api/portals/lookup?subdomain=purchasing
 * Lookup a portal by subdomain (public endpoint for session hydration)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain parameter is required' },
        { status: 400 }
      )
    }

    const portal = await getPortalBySubdomain(subdomain)

    if (!portal) {
      // Return null portal (not an error - means main app or unknown subdomain)
      return NextResponse.json({ portal: null })
    }

    return NextResponse.json({ portal })
  } catch (error) {
    console.error('Error looking up portal:', error)
    return NextResponse.json({ error: 'Failed to lookup portal' }, { status: 500 })
  }
}

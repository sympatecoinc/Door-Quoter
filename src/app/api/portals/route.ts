import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'

/**
 * GET /api/portals
 * List all portals (admin only)
 */
export async function GET() {
  try {
    // Verify session and admin role
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const portals = await prisma.portal.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ portals })
  } catch (error) {
    console.error('Error fetching portals:', error)
    return NextResponse.json({ error: 'Failed to fetch portals' }, { status: 500 })
  }
}

/**
 * POST /api/portals
 * Create a new portal (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session and admin role
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { subdomain, name, description, tabs, defaultTab, headerTitle, isActive } = body

    // Validate required fields
    if (!subdomain || !name) {
      return NextResponse.json(
        { error: 'Subdomain and name are required' },
        { status: 400 }
      )
    }

    // Validate subdomain format (lowercase alphanumeric, hyphens allowed)
    const subdomainRegex = /^[a-z0-9-]+$/
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      return NextResponse.json(
        { error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    // Check for reserved subdomains
    const reserved = ['www', 'app', 'api', 'mail', 'ftp', 'admin']
    if (reserved.includes(subdomain.toLowerCase())) {
      return NextResponse.json(
        { error: `Subdomain '${subdomain}' is reserved` },
        { status: 400 }
      )
    }

    // Check if subdomain already exists
    const existing = await prisma.portal.findUnique({
      where: { subdomain: subdomain.toLowerCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: `Portal with subdomain '${subdomain}' already exists` },
        { status: 409 }
      )
    }

    // Validate defaultTab is in tabs array
    if (defaultTab && tabs && !tabs.includes(defaultTab)) {
      return NextResponse.json(
        { error: 'Default tab must be included in the tabs array' },
        { status: 400 }
      )
    }

    const portal = await prisma.portal.create({
      data: {
        subdomain: subdomain.toLowerCase(),
        name,
        description: description || null,
        tabs: tabs || [],
        defaultTab: defaultTab || null,
        headerTitle: headerTitle || null,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    return NextResponse.json({ portal }, { status: 201 })
  } catch (error) {
    console.error('Error creating portal:', error)
    return NextResponse.json({ error: 'Failed to create portal' }, { status: 500 })
  }
}

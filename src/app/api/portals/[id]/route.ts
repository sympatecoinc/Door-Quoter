import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'
import { triggerDomainMappingCreate, triggerDomainMappingDelete } from '@/lib/cloudrun-domain-mapping'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/portals/[id]
 * Get a single portal by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params
    const portalId = parseInt(id, 10)

    if (isNaN(portalId)) {
      return NextResponse.json({ error: 'Invalid portal ID' }, { status: 400 })
    }

    // Verify session
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await validateSession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const portal = await prisma.portal.findUnique({
      where: { id: portalId }
    })

    if (!portal) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
    }

    return NextResponse.json({ portal })
  } catch (error) {
    console.error('Error fetching portal:', error)
    return NextResponse.json({ error: 'Failed to fetch portal' }, { status: 500 })
  }
}

/**
 * PUT /api/portals/[id]
 * Update a portal (admin only)
 */
export async function PUT(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params
    const portalId = parseInt(id, 10)

    if (isNaN(portalId)) {
      return NextResponse.json({ error: 'Invalid portal ID' }, { status: 400 })
    }

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

    // Check portal exists
    const existing = await prisma.portal.findUnique({
      where: { id: portalId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
    }

    const body = await request.json()
    const { subdomain, name, description, tabs, defaultTab, headerTitle, isActive } = body

    // If subdomain is being changed, validate it
    if (subdomain && subdomain.toLowerCase() !== existing.subdomain) {
      const subdomainRegex = /^[a-z0-9-]+$/
      if (!subdomainRegex.test(subdomain.toLowerCase())) {
        return NextResponse.json(
          { error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' },
          { status: 400 }
        )
      }

      // Check for reserved subdomains
      const reserved = ['www', 'app', 'api', 'mail', 'ftp']
      if (reserved.includes(subdomain.toLowerCase())) {
        return NextResponse.json(
          { error: `Subdomain '${subdomain}' is reserved` },
          { status: 400 }
        )
      }

      // Check if new subdomain is taken
      const conflict = await prisma.portal.findUnique({
        where: { subdomain: subdomain.toLowerCase() }
      })

      if (conflict && conflict.id !== portalId) {
        return NextResponse.json(
          { error: `Portal with subdomain '${subdomain}' already exists` },
          { status: 409 }
        )
      }
    }

    // Validate defaultTab is in tabs array (use new tabs if provided, else existing)
    const finalTabs = tabs !== undefined ? tabs : existing.tabs
    const finalDefaultTab = defaultTab !== undefined ? defaultTab : existing.defaultTab

    if (finalDefaultTab && !finalTabs.includes(finalDefaultTab)) {
      return NextResponse.json(
        { error: 'Default tab must be included in the tabs array' },
        { status: 400 }
      )
    }

    const portal = await prisma.portal.update({
      where: { id: portalId },
      data: {
        ...(subdomain !== undefined && { subdomain: subdomain.toLowerCase() }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(tabs !== undefined && { tabs }),
        ...(defaultTab !== undefined && { defaultTab: defaultTab || null }),
        ...(headerTitle !== undefined && { headerTitle: headerTitle || null }),
        ...(isActive !== undefined && { isActive })
      }
    })

    // If subdomain changed, update Cloud Run domain mappings
    if (subdomain && subdomain.toLowerCase() !== existing.subdomain) {
      triggerDomainMappingDelete(existing.subdomain)
      triggerDomainMappingCreate(subdomain.toLowerCase())
    }

    return NextResponse.json({ portal })
  } catch (error) {
    console.error('Error updating portal:', error)
    return NextResponse.json({ error: 'Failed to update portal' }, { status: 500 })
  }
}

/**
 * DELETE /api/portals/[id]
 * Delete a portal (admin only)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = await context.params
    const portalId = parseInt(id, 10)

    if (isNaN(portalId)) {
      return NextResponse.json({ error: 'Invalid portal ID' }, { status: 400 })
    }

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

    // Check portal exists
    const existing = await prisma.portal.findUnique({
      where: { id: portalId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Portal not found' }, { status: 404 })
    }

    await prisma.portal.delete({
      where: { id: portalId }
    })

    // Fire-and-forget: remove Cloud Run domain mapping for deleted portal
    triggerDomainMappingDelete(existing.subdomain)

    return NextResponse.json({ message: 'Portal deleted successfully' })
  } catch (error) {
    console.error('Error deleting portal:', error)
    return NextResponse.json({ error: 'Failed to delete portal' }, { status: 500 })
  }
}

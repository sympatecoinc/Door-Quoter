import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'
import { ALL_TABS } from '@/lib/permissions'

/**
 * GET /api/profiles
 * List all profiles (admin only)
 */
export async function GET() {
  try {
    // Validate session and check if user is admin
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await validateSession(sessionToken)
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Get all profiles with user count
    const profiles = await prisma.profile.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('Error fetching profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/profiles
 * Create a new profile (admin only)
 */
export async function POST(request: Request) {
  try {
    // Validate session and check if user is admin
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await validateSession(sessionToken)
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, tabs } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Profile name is required' },
        { status: 400 }
      )
    }

    // Validate tabs array
    if (!Array.isArray(tabs)) {
      return NextResponse.json(
        { error: 'Tabs must be an array' },
        { status: 400 }
      )
    }

    // Validate each tab ID
    const validTabs = tabs.filter(tab => ALL_TABS.includes(tab))
    if (validTabs.length !== tabs.length) {
      const invalidTabs = tabs.filter(tab => !ALL_TABS.includes(tab))
      return NextResponse.json(
        { error: `Invalid tab IDs: ${invalidTabs.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if profile name already exists
    const existingProfile = await prisma.profile.findUnique({
      where: { name: name.trim() }
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: 'A profile with this name already exists' },
        { status: 400 }
      )
    }

    // Create profile
    const profile = await prisma.profile.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        tabs: validTabs,
        isActive: true
      },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    return NextResponse.json({
      message: 'Profile created successfully',
      profile
    })
  } catch (error) {
    console.error('Error creating profile:', error)
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    )
  }
}

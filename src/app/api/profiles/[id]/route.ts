import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'
import { ALL_TABS } from '@/lib/permissions'

/**
 * GET /api/profiles/[id]
 * Get a single profile with assigned users (admin only)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const profileId = parseInt(id)

    if (isNaN(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: { users: true }
        }
      }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/profiles/[id]
 * Update a profile (admin only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const profileId = parseInt(id)

    if (isNaN(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, tabs, defaultTab } = body

    // Build update data
    const updateData: any = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Profile name cannot be empty' },
          { status: 400 }
        )
      }

      // Check if name is already in use by another profile
      const existingProfile = await prisma.profile.findUnique({
        where: { name: name.trim() }
      })

      if (existingProfile && existingProfile.id !== profileId) {
        return NextResponse.json(
          { error: 'A profile with this name already exists' },
          { status: 400 }
        )
      }

      updateData.name = name.trim()
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }

    let validTabs: string[] | undefined
    if (tabs !== undefined) {
      if (!Array.isArray(tabs)) {
        return NextResponse.json(
          { error: 'Tabs must be an array' },
          { status: 400 }
        )
      }

      // Validate each tab ID
      validTabs = tabs.filter(tab => ALL_TABS.includes(tab))
      if (validTabs.length !== tabs.length) {
        const invalidTabs = tabs.filter(tab => !ALL_TABS.includes(tab))
        return NextResponse.json(
          { error: `Invalid tab IDs: ${invalidTabs.join(', ')}` },
          { status: 400 }
        )
      }

      updateData.tabs = validTabs
    }

    // Handle defaultTab
    if (defaultTab !== undefined) {
      // If tabs are being updated, validate against new tabs
      // If not, we need to fetch the current profile to validate
      const tabsToValidate = validTabs || (await prisma.profile.findUnique({
        where: { id: profileId },
        select: { tabs: true }
      }))?.tabs || []

      if (defaultTab === null) {
        updateData.defaultTab = null
      } else if (tabsToValidate.includes(defaultTab)) {
        updateData.defaultTab = defaultTab
      } else {
        return NextResponse.json(
          { error: 'Default tab must be one of the selected tabs' },
          { status: 400 }
        )
      }
    }

    // Update profile
    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: updateData,
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    return NextResponse.json({
      message: 'Profile updated successfully',
      profile
    })
  } catch (error: any) {
    console.error('Error updating profile:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/profiles/[id]
 * Soft delete a profile (admin only) - sets isActive to false and unlinks users
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const profileId = parseInt(id)

    if (isNaN(profileId)) {
      return NextResponse.json({ error: 'Invalid profile ID' }, { status: 400 })
    }

    // Check how many users are assigned to this profile
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Soft delete: set isActive to false and unlink all users
    await prisma.$transaction([
      // Unlink all users from this profile
      prisma.user.updateMany({
        where: { profileId: profileId },
        data: { profileId: null }
      }),
      // Deactivate the profile
      prisma.profile.update({
        where: { id: profileId },
        data: { isActive: false }
      })
    ])

    return NextResponse.json({
      message: 'Profile deleted successfully',
      usersUnlinked: profile._count.users
    })
  } catch (error: any) {
    console.error('Error deleting profile:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    )
  }
}

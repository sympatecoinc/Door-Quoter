import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken, hashPassword, validatePassword, validateEmail } from '@/lib/auth'
import { validateSession, deleteAllUserSessions } from '@/lib/db-session'
import type { Role } from '@prisma/client'

/**
 * PUT /api/users/[id]
 * Update user details (admin only)
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
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { email, name, role, isActive, password, permissions, profileId, tabOverrides, portalIds } = body

    // Build update data
    const updateData: any = {}

    if (permissions !== undefined) {
      updateData.permissions = permissions
    }

    // Handle profile assignment (can be set to null to remove profile)
    if (profileId !== undefined) {
      updateData.profileId = profileId === null ? null : profileId
    }

    // Handle tab overrides
    if (tabOverrides !== undefined) {
      updateData.tabOverrides = typeof tabOverrides === 'string' ? tabOverrides : JSON.stringify(tabOverrides)
    }

    if (email !== undefined) {
      const emailError = validateEmail(email)
      if (emailError) {
        return NextResponse.json({ error: emailError }, { status: 400 })
      }

      // Check if email is already in use by another user
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== userId) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        )
      }

      updateData.email = email
    }

    if (name !== undefined) {
      updateData.name = name
    }

    if (role !== undefined) {
      const validRoles: Role[] = ['ADMIN', 'MANAGER', 'VIEWER']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be ADMIN, MANAGER, or VIEWER' },
          { status: 400 }
        )
      }
      updateData.role = role
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive

      // If deactivating user, delete all their sessions
      if (!isActive) {
        await deleteAllUserSessions(userId)
      }
    }

    // Update password if provided
    if (password !== undefined && password !== '') {
      const passwordError = validatePassword(password)
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 })
      }
      updateData.passwordHash = await hashPassword(password)
    }

    // Handle portal assignments - set replaces all current assignments
    if (portalIds !== undefined && Array.isArray(portalIds)) {
      updateData.portals = {
        set: portalIds.map((id: number) => ({ id }))
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
        profileId: true,
        tabOverrides: true,
        profile: {
          select: {
            id: true,
            name: true,
            tabs: true
          }
        },
        portals: {
          select: {
            id: true,
            subdomain: true,
            name: true
          }
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: 'User updated successfully',
      user,
    })
  } catch (error: any) {
    console.error('Error updating user:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Deactivate user (admin only) - soft delete
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
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Prevent self-deactivation
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Deactivate user and delete all sessions
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    })

    await deleteAllUserSessions(userId)

    return NextResponse.json({
      message: 'User deactivated successfully',
      user,
    })
  } catch (error: any) {
    console.error('Error deactivating user:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    )
  }
}

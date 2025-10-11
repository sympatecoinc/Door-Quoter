import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { validateSession } from '@/lib/db-session'
import { hashPassword, validatePassword, validateEmail } from '@/lib/auth'
import type { Role } from '@prisma/client'

/**
 * GET /api/users
 * List all users (admin only)
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

    // Get all users (excluding password hashes)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
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
    const { email, password, name, role, permissions } = body

    // Validate input
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Email, password, name, and role are required' },
        { status: 400 }
      )
    }

    const emailError = validateEmail(email)
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    // Validate role
    const validRoles: Role[] = ['ADMIN', 'MANAGER', 'VIEWER']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ADMIN, MANAGER, or VIEWER' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user with permissions (use provided permissions or default to all tabs)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        isActive: true,
        permissions: permissions || ['dashboard', 'projects', 'crm', 'products', 'masterParts', 'settings'],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      message: 'User created successfully',
      user,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

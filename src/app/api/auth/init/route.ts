import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, validatePassword, validateEmail } from '@/lib/auth'

/**
 * POST /api/auth/init
 * Create the first admin user (only works if no users exist)
 */
export async function POST(request: Request) {
  try {
    // Check if any users already exist
    const userCount = await prisma.user.count()

    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Users already exist. Initial setup is only available when no users exist.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, password, name } = body

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
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

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create admin user with all permissions
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'ADMIN',
        isActive: true,
        permissions: ['dashboard', 'projects', 'crm', 'products', 'masterParts', 'settings'],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      message: 'Initial admin user created successfully',
      user,
    })
  } catch (error) {
    console.error('Error creating initial admin user:', error)
    return NextResponse.json(
      { error: 'Failed to create initial admin user' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/init
 * Check if initial setup is needed (no users exist)
 */
export async function GET() {
  try {
    const userCount = await prisma.user.count()

    return NextResponse.json({
      needsSetup: userCount === 0,
      userCount,
    })
  } catch (error) {
    console.error('Error checking setup status:', error)
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}

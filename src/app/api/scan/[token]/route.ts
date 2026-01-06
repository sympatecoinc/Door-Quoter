import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/scan/[token] - Get bin location info by access token (PUBLIC - no auth)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find bin location by access token
    const binLocation = await prisma.binLocation.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true
      }
    })

    if (!binLocation) {
      return NextResponse.json({ error: 'Invalid or expired scan code' }, { status: 404 })
    }

    if (!binLocation.isActive) {
      return NextResponse.json({ error: 'This bin location is no longer active' }, { status: 400 })
    }

    return NextResponse.json({
      binLocation: {
        id: binLocation.id,
        code: binLocation.code,
        name: binLocation.name,
        description: binLocation.description
      }
    })
  } catch (error) {
    console.error('Error fetching bin location by token:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bin location' },
      { status: 500 }
    )
  }
}

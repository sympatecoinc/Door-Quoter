import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked, createLockedError } from '@/lib/project-status'

export async function POST(request: NextRequest) {
  try {
    const { openingIds } = await request.json()

    // Validate input
    if (!Array.isArray(openingIds) || openingIds.length === 0) {
      return NextResponse.json(
        { error: 'openingIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate all IDs are valid numbers
    const validIds = openingIds.filter(id => typeof id === 'number' && !isNaN(id) && id > 0)
    if (validIds.length !== openingIds.length) {
      return NextResponse.json(
        { error: 'All opening IDs must be valid positive numbers' },
        { status: 400 }
      )
    }

    // Check if any of the openings belong to a locked project
    const openingsWithStatus = await prisma.opening.findMany({
      where: { id: { in: validIds } },
      include: { project: { select: { status: true } } }
    })

    for (const opening of openingsWithStatus) {
      if (isProjectLocked(opening.project.status)) {
        return NextResponse.json(createLockedError(opening.project.status), { status: 403 })
      }
    }

    // Delete all openings in a single transaction (cascade handles related panels)
    const result = await prisma.opening.deleteMany({
      where: {
        id: {
          in: validIds
        }
      }
    })

    return NextResponse.json({
      deletedCount: result.count,
      message: `Successfully deleted ${result.count} opening${result.count !== 1 ? 's' : ''}`
    })
  } catch (error) {
    console.error('Error bulk deleting openings:', error)
    return NextResponse.json(
      { error: 'Failed to delete openings' },
      { status: 500 }
    )
  }
}

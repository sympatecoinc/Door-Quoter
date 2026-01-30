import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WorkOrderStage } from '@prisma/client'

// Valid stations (exclude COMPLETE as it's not a workable station)
const VALID_STATIONS: WorkOrderStage[] = [
  'STAGED',
  'CUTTING',
  'ASSEMBLY',
  'QC',
  'SHIP'
]

// GET - Get user's assigned stations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get station assignments
    const assignments = await prisma.userStationAssignment.findMany({
      where: { userId },
      orderBy: { station: 'asc' }
    })

    // Get primary station
    const primary = assignments.find(a => a.isPrimary)

    return NextResponse.json({
      user,
      assignments,
      primaryStation: primary?.station || null,
      assignedStations: assignments.map(a => a.station)
    })
  } catch (error) {
    console.error('Error fetching user stations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user stations' },
      { status: 500 }
    )
  }
}

// POST - Assign user to station(s)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { stations, primaryStation } = body

    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      return NextResponse.json(
        { error: 'At least one station is required' },
        { status: 400 }
      )
    }

    // Validate all stations
    for (const station of stations) {
      if (!VALID_STATIONS.includes(station)) {
        return NextResponse.json(
          { error: `Invalid station: ${station}` },
          { status: 400 }
        )
      }
    }

    // Validate primary station if provided
    if (primaryStation && !stations.includes(primaryStation)) {
      return NextResponse.json(
        { error: 'Primary station must be one of the assigned stations' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Use transaction to update assignments
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing assignments
      await tx.userStationAssignment.deleteMany({
        where: { userId }
      })

      // Create new assignments
      const assignments = await Promise.all(
        stations.map((station: WorkOrderStage) =>
          tx.userStationAssignment.create({
            data: {
              userId,
              station,
              isPrimary: station === (primaryStation || stations[0])
            }
          })
        )
      )

      return assignments
    })

    return NextResponse.json({
      success: true,
      assignments: result,
      primaryStation: primaryStation || stations[0]
    })
  } catch (error) {
    console.error('Error assigning user to stations:', error)
    return NextResponse.json(
      { error: 'Failed to assign user to stations' },
      { status: 500 }
    )
  }
}

// DELETE - Remove station assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const station = searchParams.get('station') as WorkOrderStage | null

    if (!station) {
      // Delete all assignments
      await prisma.userStationAssignment.deleteMany({
        where: { userId }
      })

      return NextResponse.json({ success: true, message: 'All station assignments removed' })
    }

    // Delete specific station assignment
    await prisma.userStationAssignment.deleteMany({
      where: { userId, station }
    })

    // If deleted the primary, make another one primary
    const remaining = await prisma.userStationAssignment.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    })

    if (remaining.length > 0 && !remaining.some(a => a.isPrimary)) {
      await prisma.userStationAssignment.update({
        where: { id: remaining[0].id },
        data: { isPrimary: true }
      })
    }

    return NextResponse.json({ success: true, message: `Station ${station} removed` })
  } catch (error) {
    console.error('Error removing station assignment:', error)
    return NextResponse.json(
      { error: 'Failed to remove station assignment' },
      { status: 500 }
    )
  }
}

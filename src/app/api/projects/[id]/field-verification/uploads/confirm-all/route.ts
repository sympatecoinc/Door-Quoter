import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Update all unconfirmed uploads for this project
    const result = await prisma.fieldVerificationUpload.updateMany({
      where: {
        projectId,
        confirmed: false
      },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedBy: 'user' // Could be enhanced to include actual user info
      }
    })

    return NextResponse.json({
      success: true,
      confirmedCount: result.count
    })
  } catch (error) {
    console.error('Error confirming all field verification uploads:', error)
    return NextResponse.json(
      { error: 'Failed to confirm uploads' },
      { status: 500 }
    )
  }
}

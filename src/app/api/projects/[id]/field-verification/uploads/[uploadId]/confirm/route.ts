import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  try {
    const { id, uploadId } = await params
    const projectId = parseInt(id)
    const uploadIdInt = parseInt(uploadId)

    if (isNaN(projectId) || isNaN(uploadIdInt)) {
      return NextResponse.json(
        { error: 'Invalid project ID or upload ID' },
        { status: 400 }
      )
    }

    // Verify upload exists and belongs to the project
    const upload = await prisma.fieldVerificationUpload.findFirst({
      where: {
        id: uploadIdInt,
        projectId
      }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Update the upload to mark as confirmed
    const updatedUpload = await prisma.fieldVerificationUpload.update({
      where: { id: uploadIdInt },
      data: {
        confirmed: true,
        confirmedAt: new Date(),
        confirmedBy: 'user' // Could be enhanced to include actual user info
      }
    })

    return NextResponse.json({
      success: true,
      upload: {
        id: updatedUpload.id,
        confirmed: updatedUpload.confirmed,
        confirmedAt: updatedUpload.confirmedAt?.toISOString(),
        confirmedBy: updatedUpload.confirmedBy
      }
    })
  } catch (error) {
    console.error('Error confirming field verification upload:', error)
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    )
  }
}

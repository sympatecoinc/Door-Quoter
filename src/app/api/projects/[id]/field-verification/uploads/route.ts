import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
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
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Fetch all field verification uploads for this project
    const uploads = await prisma.fieldVerificationUpload.findMany({
      where: { projectId },
      orderBy: { uploadedAt: 'desc' }
    })

    // Map uploads to include image URL for the frontend
    const uploadsWithUrls = uploads.map(upload => ({
      id: upload.id,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      size: upload.size,
      uploadedAt: upload.uploadedAt.toISOString(),
      uploadedBy: upload.uploadedBy,
      confirmed: upload.confirmed,
      confirmedAt: upload.confirmedAt?.toISOString() || null,
      confirmedBy: upload.confirmedBy,
      // Image URL that will be served via our image endpoint
      imageUrl: `/api/projects/${projectId}/field-verification/uploads/${upload.id}/image`
    }))

    const confirmedCount = uploads.filter(u => u.confirmed).length

    return NextResponse.json({
      projectId,
      projectName: project.name,
      count: uploads.length,
      confirmedCount,
      uploads: uploadsWithUrls
    })
  } catch (error) {
    console.error('Error fetching field verification uploads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch field verification uploads' },
      { status: 500 }
    )
  }
}

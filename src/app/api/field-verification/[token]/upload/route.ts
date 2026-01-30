import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/gcs-storage'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find project by field verification token
    const project = await prisma.project.findUnique({
      where: { fieldVerificationToken: token },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or link expired' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Generate GCS path
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const gcsPath = `field-verification/${project.id}/${timestamp}.${extension}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to GCS (or local filesystem in dev)
    await uploadFile(buffer, gcsPath, file.type)

    // Get user agent for uploadedBy field
    const userAgent = request.headers.get('user-agent') || 'Unknown device'

    // Save record to database
    const upload = await prisma.fieldVerificationUpload.create({
      data: {
        projectId: project.id,
        gcsPath,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedBy: userAgent.substring(0, 255) // Truncate to reasonable length
      }
    })

    return NextResponse.json({
      success: true,
      upload: {
        id: upload.id,
        originalName: upload.originalName,
        uploadedAt: upload.uploadedAt.toISOString()
      }
    })
  } catch (error) {
    console.error('Error uploading field verification photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

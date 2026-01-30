import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/gcs-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  try {
    const { id, uploadId } = await params
    const projectId = parseInt(id)
    const uploadIdNum = parseInt(uploadId)

    if (isNaN(projectId) || isNaN(uploadIdNum)) {
      return NextResponse.json(
        { error: 'Invalid ID' },
        { status: 400 }
      )
    }

    // Fetch the upload record
    const upload = await prisma.fieldVerificationUpload.findFirst({
      where: {
        id: uploadIdNum,
        projectId // Ensure upload belongs to this project
      }
    })

    if (!upload) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Download the file from storage (GCS or local)
    const buffer = await downloadFile(upload.gcsPath)

    // Return the image with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': upload.mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `inline; filename="${upload.originalName}"`
      }
    })
  } catch (error) {
    console.error('Error serving field verification image:', error)
    return NextResponse.json(
      { error: 'Failed to load image' },
      { status: 500 }
    )
  }
}

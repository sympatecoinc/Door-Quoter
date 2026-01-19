import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/gcs-storage'

// GET: Download/serve a quote attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id, attachmentId } = await params
    const projectId = parseInt(id)
    const attId = parseInt(attachmentId)

    // Fetch attachment from database
    const attachment = await prisma.quoteAttachment.findFirst({
      where: {
        id: attId,
        projectId
      }
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Download from GCS
    const gcsPath = `quote-attachments/${projectId}/${attachment.filename}`
    const buffer = await downloadFile(gcsPath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (error) {
    console.error('Error serving quote attachment:', error)
    return NextResponse.json(
      { error: 'Failed to serve attachment' },
      { status: 500 }
    )
  }
}

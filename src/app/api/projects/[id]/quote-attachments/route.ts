import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { writeFile, mkdir } from 'fs/promises'

// GET: Fetch all quote attachments for a project
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    const attachments = await prisma.quoteAttachment.findMany({
      where: { projectId },
      orderBy: { displayOrder: 'asc' }
    })

    return NextResponse.json({ success: true, attachments })
  } catch (error) {
    console.error('Error fetching quote attachments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote attachments' },
      { status: 500 }
    )
  }
}

// POST: Upload a new quote attachment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string || 'custom'
    const description = formData.get('description') as string || null
    const position = formData.get('position') as string || 'after'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPEG, and PDF files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Validate position
    if (position !== 'before' && position !== 'after') {
      return NextResponse.json(
        { error: 'Invalid position value. Must be "before" or "after".' },
        { status: 400 }
      )
    }

    // Create project-specific directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'quote-attachments', String(projectId))
    if (!fs.existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = path.extname(file.name)
    const filename = `attachment-${timestamp}${extension}`
    const filePath = path.join(uploadDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Get the next display order
    const maxOrderResult = await prisma.quoteAttachment.findFirst({
      where: { projectId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true }
    })
    const nextOrder = (maxOrderResult?.displayOrder ?? -1) + 1

    // Create database record
    const attachment = await prisma.quoteAttachment.create({
      data: {
        projectId,
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        type,
        displayOrder: nextOrder,
        position,
        description
      }
    })

    return NextResponse.json({ success: true, attachment })
  } catch (error) {
    console.error('Error uploading quote attachment:', error)
    return NextResponse.json(
      { error: 'Failed to upload quote attachment' },
      { status: 500 }
    )
  }
}

// PATCH: Update attachment order or metadata
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    const body = await request.json()

    // Handle reordering multiple attachments
    if (body.attachments && Array.isArray(body.attachments)) {
      // Update display order for each attachment
      await Promise.all(
        body.attachments.map((item: { id: number, displayOrder: number }) =>
          prisma.quoteAttachment.update({
            where: { id: item.id, projectId },
            data: { displayOrder: item.displayOrder }
          })
        )
      )

      return NextResponse.json({ success: true, message: 'Attachment order updated' })
    }

    // Handle single attachment update
    if (body.id) {
      const { id: attachmentId, description, type } = body

      const attachment = await prisma.quoteAttachment.update({
        where: { id: attachmentId, projectId },
        data: {
          ...(description !== undefined && { description }),
          ...(type !== undefined && { type })
        }
      })

      return NextResponse.json({ success: true, attachment })
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating quote attachment:', error)
    return NextResponse.json(
      { error: 'Failed to update quote attachment' },
      { status: 500 }
    )
  }
}

// DELETE: Remove a quote attachment
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'Attachment ID required' },
        { status: 400 }
      )
    }

    // Fetch attachment to get filename
    const attachment = await prisma.quoteAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        projectId
      }
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      )
    }

    // Delete file from disk
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'quote-attachments',
      String(projectId),
      attachment.filename
    )

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete database record
    await prisma.quoteAttachment.delete({
      where: { id: parseInt(attachmentId) }
    })

    return NextResponse.json({ success: true, message: 'Attachment deleted' })
  } catch (error) {
    console.error('Error deleting quote attachment:', error)
    return NextResponse.json(
      { error: 'Failed to delete quote attachment' },
      { status: 500 }
    )
  }
}

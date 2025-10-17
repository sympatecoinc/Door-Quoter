import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

// GET /api/quote-documents/[id] - Get a single quote document
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const document = await prisma.quoteDocument.findUnique({
      where: { id },
      include: {
        productDocuments: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, document })
  } catch (error) {
    console.error('Error fetching quote document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

// PUT /api/quote-documents/[id] - Update a quote document's metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()

    const { name, description, category, isGlobal, displayOrder } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Document name is required' },
        { status: 400 }
      )
    }

    // Check if document exists
    const existingDocument = await prisma.quoteDocument.findUnique({
      where: { id },
    })

    if (!existingDocument) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Update document
    const updatedDocument = await prisma.quoteDocument.update({
      where: { id },
      data: {
        name,
        description: description || null,
        category: category || 'general',
        isGlobal: isGlobal !== undefined ? isGlobal : existingDocument.isGlobal,
        displayOrder: displayOrder !== undefined ? displayOrder : existingDocument.displayOrder,
      },
      include: {
        productDocuments: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ success: true, document: updatedDocument })
  } catch (error) {
    console.error('Error updating quote document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update document' },
      { status: 500 }
    )
  }
}

// DELETE /api/quote-documents/[id] - Delete a quote document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    // Get document to find file path
    const document = await prisma.quoteDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete file from filesystem
    const filepath = join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      document.id.toString(),
      document.filename
    )

    if (existsSync(filepath)) {
      await unlink(filepath)
    }

    // Delete database record (will cascade delete ProductQuoteDocument entries)
    await prisma.quoteDocument.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}

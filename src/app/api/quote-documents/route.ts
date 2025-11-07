import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

// GET /api/quote-documents - List all quote documents
export async function GET(request: NextRequest) {
  try {
    const documents = await prisma.quoteDocument.findMany({
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
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ success: true, documents })
  } catch (error) {
    console.error('Error fetching quote documents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quote documents' },
      { status: 500 }
    )
  }
}

// POST /api/quote-documents - Upload a new quote document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const category = formData.get('category') as string
    const isGlobal = formData.get('isGlobal') === 'true'
    const displayOrder = parseInt(formData.get('displayOrder') as string) || 0
    const uploadedBy = formData.get('uploadedBy') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Document name is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PDF, PNG, and JPG are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Create document record first to get the ID
    const document = await prisma.quoteDocument.create({
      data: {
        name,
        description: description || null,
        filename: '', // Will update after we save the file
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        category: category || 'general',
        isGlobal,
        displayOrder,
        uploadedBy: uploadedBy || null,
      },
    })

    // Generate unique filename using document ID and timestamp
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `${document.id}-${timestamp}.${extension}`

    // Create directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'quote-documents', document.id.toString())
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // Update document with filename
    const updatedDocument = await prisma.quoteDocument.update({
      where: { id: document.id },
      data: { filename },
    })

    return NextResponse.json({ success: true, document: updatedDocument })
  } catch (error) {
    console.error('Error uploading quote document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

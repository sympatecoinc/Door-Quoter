import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const prisma = new PrismaClient()

// GET /api/quote-documents/[id]/download - Download a quote document file
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    // Get document from database
    const document = await prisma.quoteDocument.findUnique({
      where: { id },
    })

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Build file path
    const filepath = join(
      process.cwd(),
      'public',
      'uploads',
      'quote-documents',
      document.id.toString(),
      document.filename
    )

    // Check if file exists
    if (!existsSync(filepath)) {
      return NextResponse.json(
        { success: false, error: 'File not found on server' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await readFile(filepath)

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename="${document.originalName}"`,
        'Content-Length': document.size.toString(),
      },
    })
  } catch (error) {
    console.error('Error downloading quote document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to download document' },
      { status: 500 }
    )
  }
}

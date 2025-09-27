import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const fileId = parseInt(params.fileId)

    if (isNaN(customerId) || isNaN(fileId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or file ID' },
        { status: 400 }
      )
    }

    // Get file record
    const file = await prisma.customerFile.findUnique({
      where: {
        id: fileId,
        customerId: customerId
      }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read file from filesystem
    try {
      const filePath = join(process.cwd(), 'uploads', 'customers', customerId.toString(), file.filename)
      const fileBuffer = await readFile(filePath)

      // Create response with appropriate headers
      const response = new NextResponse(fileBuffer)

      response.headers.set('Content-Type', file.mimeType)
      response.headers.set('Content-Length', file.size.toString())
      response.headers.set('Content-Disposition', `attachment; filename="${file.originalName}"`)

      // For images, allow inline display
      if (file.mimeType.startsWith('image/')) {
        response.headers.set('Content-Disposition', `inline; filename="${file.originalName}"`)
      }

      return response
    } catch (fsError) {
      console.error('File system error:', fsError)
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error downloading customer file:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
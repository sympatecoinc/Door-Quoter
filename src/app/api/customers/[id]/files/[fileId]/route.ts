import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { unlink } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

export async function DELETE(
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

    // Get file record first
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

    // Delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'uploads', 'customers', customerId.toString(), file.filename)
      await unlink(filePath)
    } catch (fsError) {
      console.warn('Could not delete file from filesystem:', fsError)
      // Continue with database deletion even if file removal fails
    }

    // Delete file record from database
    await prisma.customerFile.delete({
      where: { id: fileId }
    })

    return NextResponse.json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer file:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}
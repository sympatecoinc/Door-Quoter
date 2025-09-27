import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const files = await prisma.customerFile.findMany({
      where: { customerId: customerId },
      orderBy: { createdAt: 'desc' }
    })

    // Add file URLs for download/preview
    const filesWithUrls = files.map(file => ({
      ...file,
      url: `/api/customers/${customerId}/files/${file.id}/download`
    }))

    return NextResponse.json(filesWithUrls)
  } catch (error) {
    console.error('Error fetching customer files:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer files' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const uploadedFiles = []

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'customers', customerId.toString())
    await mkdir(uploadsDir, { recursive: true })

    for (const file of files) {
      if (file.size === 0) continue

      // Generate unique filename
      const fileExtension = file.name.split('.').pop() || ''
      const uniqueFilename = `${uuidv4()}.${fileExtension}`
      const filePath = join(uploadsDir, uniqueFilename)

      // Convert file to buffer and save
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Save file metadata to database
      const fileRecord = await prisma.customerFile.create({
        data: {
          customerId: customerId,
          filename: uniqueFilename,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          uploadedBy: 'Current User' // TODO: Get from auth context
        }
      })

      uploadedFiles.push({
        ...fileRecord,
        url: `/api/customers/${customerId}/files/${fileRecord.id}/download`
      })
    }

    return NextResponse.json(uploadedFiles, { status: 201 })
  } catch (error) {
    console.error('Error uploading customer files:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
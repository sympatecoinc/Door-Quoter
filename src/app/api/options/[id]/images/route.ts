import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { writeFile, mkdir, unlink } from 'fs/promises'

// GET: Fetch option with images
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)

    const option = await prisma.individualOption.findUnique({
      where: { id: optionId },
      include: {
        category: {
          select: { name: true }
        }
      }
    })

    if (!option) {
      return NextResponse.json(
        { error: 'Option not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, option })
  } catch (error) {
    console.error('Error fetching option:', error)
    return NextResponse.json(
      { error: 'Failed to fetch option' },
      { status: 500 }
    )
  }
}

// POST: Upload an image (elevation or plan)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)

    // Verify option exists
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId }
    })

    if (!option) {
      return NextResponse.json(
        { error: 'Option not found' },
        { status: 404 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageType = formData.get('imageType') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!imageType || !['elevation', 'plan'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Must be "elevation" or "plan".' },
        { status: 400 }
      )
    }

    // Validate file type (PNG, JPEG, and SVG)
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPEG, and SVG images are allowed.' },
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

    // Create option-specific directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'uploads', 'option-images', String(optionId))
    if (!fs.existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Delete existing image if there is one
    const existingPath = imageType === 'elevation' ? option.elevationImagePath : option.planImagePath
    if (existingPath) {
      const existingFilePath = path.join(uploadDir, existingPath)
      if (fs.existsSync(existingFilePath)) {
        await unlink(existingFilePath)
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = path.extname(file.name)
    const filename = `${imageType}-${timestamp}${extension}`
    const filePath = path.join(uploadDir, filename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Update database record
    const updateData = imageType === 'elevation'
      ? { elevationImagePath: filename, elevationImageOriginalName: file.name }
      : { planImagePath: filename, planImageOriginalName: file.name }

    const updatedOption = await prisma.individualOption.update({
      where: { id: optionId },
      data: updateData,
      include: {
        category: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({ success: true, option: updatedOption })
  } catch (error) {
    console.error('Error uploading option image:', error)
    return NextResponse.json(
      { error: 'Failed to upload option image' },
      { status: 500 }
    )
  }
}

// DELETE: Remove an image
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const optionId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const imageType = searchParams.get('imageType')

    if (!imageType || !['elevation', 'plan'].includes(imageType)) {
      return NextResponse.json(
        { error: 'Invalid image type. Must be "elevation" or "plan".' },
        { status: 400 }
      )
    }

    // Fetch option to get filename
    const option = await prisma.individualOption.findUnique({
      where: { id: optionId }
    })

    if (!option) {
      return NextResponse.json(
        { error: 'Option not found' },
        { status: 404 }
      )
    }

    // Get the file path based on image type
    const filename = imageType === 'elevation' ? option.elevationImagePath : option.planImagePath

    if (!filename) {
      return NextResponse.json(
        { error: 'No image to delete' },
        { status: 404 }
      )
    }

    // Delete file from disk
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'option-images',
      String(optionId),
      filename
    )

    if (fs.existsSync(filePath)) {
      await unlink(filePath)
    }

    // Clear database fields
    const updateData = imageType === 'elevation'
      ? { elevationImagePath: null, elevationImageOriginalName: null }
      : { planImagePath: null, planImageOriginalName: null }

    const updatedOption = await prisma.individualOption.update({
      where: { id: optionId },
      data: updateData,
      include: {
        category: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({ success: true, option: updatedOption, message: 'Image deleted' })
  } catch (error) {
    console.error('Error deleting option image:', error)
    return NextResponse.json(
      { error: 'Failed to delete option image' },
      { status: 500 }
    )
  }
}

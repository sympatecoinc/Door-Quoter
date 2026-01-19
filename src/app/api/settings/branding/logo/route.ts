import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'branding')

// GET - Serve the company logo
export async function GET() {
  try {
    const setting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })

    if (!setting?.value) {
      return NextResponse.json(
        { error: 'No logo configured' },
        { status: 404 }
      )
    }

    const filename = setting.value
    const filePath = path.join(UPLOAD_DIR, filename)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Logo file not found' },
        { status: 404 }
      )
    }

    const fileBuffer = await readFile(filePath)

    // Determine content type from extension
    const ext = path.extname(filename).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Error serving logo:', error)
    return NextResponse.json(
      { error: 'Failed to serve logo' },
      { status: 500 }
    )
  }
}

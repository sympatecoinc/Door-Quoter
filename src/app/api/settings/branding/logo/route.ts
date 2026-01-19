import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadFile } from '@/lib/gcs-storage'

// GET - Serve the company logo from GCS
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

    // Parse the stored JSON containing GCS path and mime type
    let logoData: { gcsPath: string; mimeType: string }
    try {
      logoData = JSON.parse(setting.value)
    } catch {
      // Handle legacy storage format
      return NextResponse.json(
        { error: 'Logo needs to be re-uploaded' },
        { status: 404 }
      )
    }

    if (!logoData.gcsPath) {
      return NextResponse.json(
        { error: 'Logo needs to be re-uploaded' },
        { status: 404 }
      )
    }

    // Download from GCS
    const buffer = await downloadFile(logoData.gcsPath)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': logoData.mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=3600'
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

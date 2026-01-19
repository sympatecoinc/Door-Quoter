import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Get project name for filename
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Construct base URL for internal API calls
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const cookieHeader = request.headers.get('cookie') || ''

    const fetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    }

    // Fetch logistics documents in parallel
    const [packingListResponse, stickersResponse, boxListResponse] = await Promise.all([
      // Packing List PDF
      fetch(`${baseUrl}/api/projects/${projectId}/packing-list/pdf`, fetchOptions),
      // Labels/Stickers PDF
      fetch(`${baseUrl}/api/projects/${projectId}/packing-list/stickers`, fetchOptions),
      // Box Cut List PDF
      fetch(`${baseUrl}/api/projects/${projectId}/bom?boxlist=true&format=pdf`, fetchOptions)
    ])

    // Create the ZIP
    const zip = new JSZip()

    // Add Packing List PDF if available
    if (packingListResponse.ok) {
      const packingListBuffer = await packingListResponse.arrayBuffer()
      if (packingListBuffer.byteLength > 0) {
        zip.file('packing-list.pdf', packingListBuffer)
      }
    } else {
      console.error('Failed to fetch packing list:', await packingListResponse.text())
    }

    // Add Stickers PDF if available
    if (stickersResponse.ok) {
      const stickersBuffer = await stickersResponse.arrayBuffer()
      if (stickersBuffer.byteLength > 0) {
        zip.file('packing-stickers.pdf', stickersBuffer)
      }
    } else {
      console.error('Failed to fetch stickers:', await stickersResponse.text())
    }

    // Add Box Cut List PDF if available
    if (boxListResponse.ok) {
      const boxListBuffer = await boxListResponse.arrayBuffer()
      if (boxListBuffer.byteLength > 0) {
        zip.file('box-cut-list.pdf', boxListBuffer)
      }
    } else {
      console.error('Failed to fetch box list:', await boxListResponse.text())
    }

    // Check if we have any files
    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json(
        { error: 'No logistics documents available for this project' },
        { status: 404 }
      )
    }

    // Generate the final ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const dateStr = new Date().toISOString().slice(0, 10)
    const sanitizedName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-')
    const filename = `${sanitizedName}-Logistics-${dateStr}.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error generating logistics ZIP:', error)
    return NextResponse.json(
      { error: 'Failed to generate logistics package' },
      { status: 500 }
    )
  }
}

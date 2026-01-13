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

    // Fetch all three document types in parallel
    const [summaryResponse, cutlistResponse, bomsResponse] = await Promise.all([
      // Purchasing Summary CSV
      fetch(`${baseUrl}/api/projects/${projectId}/bom?summary=true&format=csv`, fetchOptions),
      // Cutlist CSV (batch=1 is default)
      fetch(`${baseUrl}/api/projects/${projectId}/bom?cutlist=true&format=csv`, fetchOptions),
      // Unique BOMs ZIP
      fetch(`${baseUrl}/api/projects/${projectId}/bom/csv?zip=true&unique=true`, fetchOptions)
    ])

    // Check for errors
    if (!summaryResponse.ok) {
      console.error('Failed to fetch purchasing summary:', await summaryResponse.text())
      return NextResponse.json(
        { error: 'Failed to fetch purchasing summary' },
        { status: 500 }
      )
    }

    if (!cutlistResponse.ok) {
      console.error('Failed to fetch cutlist:', await cutlistResponse.text())
      return NextResponse.json(
        { error: 'Failed to fetch cutlist' },
        { status: 500 }
      )
    }

    if (!bomsResponse.ok) {
      console.error('Failed to fetch BOMs:', await bomsResponse.text())
      return NextResponse.json(
        { error: 'Failed to fetch BOMs' },
        { status: 500 }
      )
    }

    // Get response data
    const summaryCSV = await summaryResponse.text()
    const cutlistCSV = await cutlistResponse.text()
    const bomsBuffer = await bomsResponse.arrayBuffer()

    // Create the main ZIP
    const zip = new JSZip()

    // Add purchasing summary and cutlist
    zip.file('purchasing-summary.csv', summaryCSV)
    zip.file('cutlist.csv', cutlistCSV)

    // Check if BOMs response is a ZIP or single CSV
    const bomsContentType = bomsResponse.headers.get('Content-Type') || ''

    if (bomsContentType.includes('application/zip')) {
      // Extract BOMs from the returned ZIP and add to boms folder
      const bomsZip = await JSZip.loadAsync(bomsBuffer)
      const bomsFolder = zip.folder('boms')

      if (bomsFolder) {
        for (const [filename, file] of Object.entries(bomsZip.files)) {
          if (!file.dir) {
            const content = await file.async('string')
            bomsFolder.file(filename, content)
          }
        }
      }
    } else {
      // Single CSV file - add it directly to boms folder
      const bomsFolder = zip.folder('boms')
      if (bomsFolder) {
        // Get filename from Content-Disposition header or use default
        const contentDisposition = bomsResponse.headers.get('Content-Disposition') || ''
        let filename = 'bom.csv'
        if (contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '').trim()
        }
        bomsFolder.file(filename, Buffer.from(bomsBuffer).toString('utf-8'))
      }
    }

    // Generate the final ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const dateStr = new Date().toISOString().slice(0, 10)
    const sanitizedName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-')
    const filename = `${sanitizedName}-PrintAll-${dateStr}.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('Error generating print-all ZIP:', error)
    return NextResponse.json(
      { error: 'Failed to generate print-all package' },
      { status: 500 }
    )
  }
}

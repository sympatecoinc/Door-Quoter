import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import JSZip from 'jszip'

// Natural sort comparison for opening names (handles "2" before "10", "Office 1" before "Office 10")
function naturalSortCompare(a: string, b: string): number {
  const aParts = a.split(/(\d+)/)
  const bParts = b.split(/(\d+)/)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || ''
    const bPart = bParts[i] || ''

    const aNum = parseInt(aPart, 10)
    const bNum = parseInt(bPart, 10)

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum
    } else {
      const cmp = aPart.localeCompare(bPart, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

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

    const { searchParams } = new URL(request.url)
    const listOnly = searchParams.get('listOnly') === 'true'
    const zip = searchParams.get('zip') === 'true'
    const selected = searchParams.get('selected')

    // Get project with openings
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        openings: {
          include: {
            panels: true
          },
          orderBy: {
            id: 'asc'
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Mode 1: List openings for modal display
    if (listOnly) {
      const openings = [...project.openings]
        .sort((a, b) => naturalSortCompare(a.name || '', b.name || ''))
        .map(opening => {
          // Calculate total width and height from panels
          const totalWidth = opening.panels.reduce((sum, panel) => sum + panel.width, 0)
          const totalHeight = opening.panels.length > 0
            ? Math.max(...opening.panels.map(panel => panel.height))
            : 0

          return {
            id: opening.id,
            name: opening.name || `Opening ${opening.id}`,
            totalWidth,
            totalHeight,
            panelCount: opening.panels.length
          }
        })

      return NextResponse.json({ openings })
    }

    // Mode 2: Generate ZIP of selected opening PDFs
    if (zip && selected) {
      const selectedIds = selected.split('|').map(id => parseInt(id)).filter(id => !isNaN(id))

      if (selectedIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid opening IDs provided' },
          { status: 400 }
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

      // Create ZIP file
      const zipFile = new JSZip()

      // Fetch PDFs for each selected opening
      for (const openingId of selectedIds) {
        try {
          const pdfResponse = await fetch(
            `${baseUrl}/api/drawings/pdf/${openingId}`,
            fetchOptions
          )

          if (pdfResponse.ok) {
            const pdfBuffer = await pdfResponse.arrayBuffer()

            // Find opening name for filename
            const opening = project.openings.find(o => o.id === openingId)
            const openingName = opening?.name || `Opening-${openingId}`
            const safeOpeningName = openingName.replace(/[^a-zA-Z0-9-_]/g, '-')

            zipFile.file(`${safeOpeningName}-Shop-Drawings.pdf`, pdfBuffer)
          } else {
            console.error(`Failed to fetch PDF for opening ${openingId}:`, await pdfResponse.text())
          }
        } catch (error) {
          console.error(`Error fetching PDF for opening ${openingId}:`, error)
        }
      }

      // Generate the ZIP
      const zipBuffer = await zipFile.generateAsync({ type: 'nodebuffer' })
      const sanitizedProjectName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-')
      const filename = `${sanitizedProjectName}-shop-drawings.zip`

      return new NextResponse(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }

    // Invalid request
    return NextResponse.json(
      { error: 'Invalid request. Use listOnly=true or zip=true&selected=ids' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in shop-drawings API:', error)
    return NextResponse.json(
      { error: 'Failed to process shop drawings request' },
      { status: 500 }
    )
  }
}

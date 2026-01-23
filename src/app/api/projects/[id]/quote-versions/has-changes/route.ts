import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Check if there are pending changes since the last quote version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Get the project with current settings and attachments
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pricingMode: true,
        quoteAttachments: {
          orderBy: { id: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if project has any openings
    const openingsCount = await prisma.opening.count({
      where: { projectId },
    })

    if (openingsCount === 0) {
      return NextResponse.json({
        hasChanges: false,
        reason: 'Cannot generate quote: Project has no openings',
        details: {
          hasNoOpenings: true,
        },
      })
    }

    // Get the most recent quote version
    const lastVersion = await prisma.quoteVersion.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    })

    // If no versions exist yet, always allow generating the first quote
    if (!lastVersion) {
      return NextResponse.json({
        hasChanges: true,
        reason: 'No quote versions exist yet',
        details: {
          isFirstQuote: true,
        },
      })
    }

    // Fetch the current quote data (with markups applied) to compare properly
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const cookieHeader = request.headers.get('cookie') || ''

    const quoteResponse = await fetch(`${baseUrl}/api/projects/${projectId}/quote`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
    })

    if (!quoteResponse.ok) {
      // If we can't fetch the quote, allow generating (fail open)
      return NextResponse.json({
        hasChanges: true,
        reason: 'Unable to verify current quote state',
        details: {
          isFirstQuote: false,
        },
      })
    }

    const currentQuote = await quoteResponse.json()
    const changes: string[] = []
    const snapshot = lastVersion.snapshot as any

    // 1. Check for opening/item changes
    const currentItems = currentQuote.quoteItems || []
    const snapshotItems = snapshot.quoteItems || []

    // Check if opening count changed
    if (currentItems.length !== snapshotItems.length) {
      const diff = currentItems.length - snapshotItems.length
      changes.push(
        `${Math.abs(diff)} opening${Math.abs(diff) !== 1 ? 's' : ''} ${diff > 0 ? 'added' : 'removed'}`
      )
    } else {
      // Check if opening IDs have changed
      const currentIds = currentItems.map((i: any) => i.openingId).sort()
      const snapshotIds = snapshotItems.map((i: any) => i.openingId).sort()

      if (JSON.stringify(currentIds) !== JSON.stringify(snapshotIds)) {
        changes.push('Opening configuration changed')
      } else {
        // Check each opening for changes
        for (const currentItem of currentItems) {
          const snapshotItem = snapshotItems.find(
            (s: any) => s.openingId === currentItem.openingId
          )
          if (snapshotItem) {
            // Compare prices (these are the final marked-up prices)
            if (Math.abs((currentItem.price || 0) - (snapshotItem.price || 0)) > 0.01) {
              changes.push('Opening prices have changed')
              break
            }
            // Compare cost prices (internal costs before markup)
            if (Math.abs((currentItem.costPrice || 0) - (snapshotItem.costPrice || 0)) > 0.01) {
              changes.push('Component costs have changed')
              break
            }
            // Compare dimensions
            if (currentItem.dimensions !== snapshotItem.dimensions) {
              changes.push('Opening dimensions have changed')
              break
            }
            // Compare description (includes panel/component info)
            if (currentItem.description !== snapshotItem.description) {
              changes.push('Opening components have changed')
              break
            }
          }
        }
      }
    }

    // 2. Check for settings changes
    // Check pricing mode
    if ((project.pricingModeId || null) !== (lastVersion.pricingModeId || null)) {
      changes.push('Pricing mode changed')
    }

    // Check tax rate
    if (Math.abs((project.taxRate || 0) - (lastVersion.taxRate || 0)) > 0.0001) {
      changes.push('Tax rate changed')
    }

    // Check installation settings from snapshot
    if (snapshot.installationMethod !== undefined) {
      if (project.installationMethod !== snapshot.installationMethod) {
        changes.push('Installation method changed')
      }
      if (project.installationComplexity !== snapshot.installationComplexity) {
        changes.push('Installation complexity changed')
      }
      if (
        Math.abs(
          (project.manualInstallationCost || 0) - (snapshot.manualInstallationCost || 0)
        ) > 0.01
      ) {
        changes.push('Manual installation cost changed')
      }
    }

    // Check quote drawing view setting
    const currentDrawingView = project.quoteDrawingView || 'ELEVATION'
    const snapshotDrawingView = snapshot.quoteDrawingView || 'ELEVATION'
    if (currentDrawingView !== snapshotDrawingView) {
      changes.push('Quote drawing view changed')
    }

    // 3. Check for quote document changes
    const currentAttachmentSignature = project.quoteAttachments
      .map((a) => `${a.id}:${a.position}:${a.displayOrder}`)
      .join(',')
    const snapshotAttachmentSignature = (snapshot.attachments || [])
      .map((a: any) => `${a.id}:${a.position}:${a.displayOrder}`)
      .join(',')

    if (currentAttachmentSignature !== snapshotAttachmentSignature) {
      const currentCount = project.quoteAttachments.length
      const snapshotCount = (snapshot.attachments || []).length
      if (currentCount !== snapshotCount) {
        changes.push(
          `Quote documents ${currentCount > snapshotCount ? 'added' : 'removed'}`
        )
      } else {
        changes.push('Quote document settings changed')
      }
    }

    return NextResponse.json({
      hasChanges: changes.length > 0,
      reason: changes.length > 0 ? changes.join(', ') : 'No changes since last quote version',
      details: {
        isFirstQuote: false,
        changeCount: changes.length,
        changes,
        lastVersionId: lastVersion.id,
        lastVersionNumber: lastVersion.version,
        lastVersionCreatedAt: lastVersion.createdAt,
      },
    })
  } catch (error) {
    console.error('Error checking for quote changes:', error)
    return NextResponse.json(
      { error: 'Failed to check for quote changes' },
      { status: 500 }
    )
  }
}

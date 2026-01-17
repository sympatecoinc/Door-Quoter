import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch all quote versions for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    const versions = await prisma.quoteVersion.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Error fetching quote versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote versions' },
      { status: 500 }
    )
  }
}

// POST - Create a new quote version (snapshot)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Fetch the current quote data using the existing quote API logic
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
      return NextResponse.json(
        { error: 'Failed to fetch current quote data' },
        { status: 500 }
      )
    }

    const quoteData = await quoteResponse.json()

    // Get the project for pricing mode info and attachments
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        pricingMode: true,
        quoteAttachments: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get the next version number
    const lastVersion = await prisma.quoteVersion.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (lastVersion?.version || 0) + 1

    // Generate change notes by comparing to previous version
    let changeNotes: string | null = null
    if (lastVersion) {
      const changes: string[] = []
      const lastSnapshot = lastVersion.snapshot as any
      const currentItems = quoteData.quoteItems || []
      const lastItems = lastSnapshot?.quoteItems || []

      // Check for price changes
      if (Math.abs(quoteData.totalPrice - lastVersion.totalPrice) > 0.01) {
        const diff = quoteData.totalPrice - lastVersion.totalPrice
        changes.push(
          `Total price ${diff > 0 ? 'increased' : 'decreased'} by $${Math.abs(diff).toLocaleString()}`
        )
      }

      // Check for item count changes
      if (currentItems.length !== lastItems.length) {
        const diff = currentItems.length - lastItems.length
        changes.push(
          `${Math.abs(diff)} opening${Math.abs(diff) !== 1 ? 's' : ''} ${diff > 0 ? 'added' : 'removed'}`
        )
      }

      // Check for pricing mode changes
      if (project.pricingMode?.name !== lastVersion.pricingModeName) {
        changes.push(
          `Pricing mode changed from "${lastVersion.pricingModeName || 'none'}" to "${project.pricingMode?.name || 'none'}"`
        )
      }

      // Check for document changes
      const lastAttachments = lastSnapshot?.attachments || []
      const currentAttachmentCount = project.quoteAttachments.length
      const lastAttachmentCount = lastAttachments.length
      if (currentAttachmentCount !== lastAttachmentCount) {
        const diff = currentAttachmentCount - lastAttachmentCount
        changes.push(
          `${Math.abs(diff)} quote document${Math.abs(diff) !== 1 ? 's' : ''} ${diff > 0 ? 'added' : 'removed'}`
        )
      }

      if (changes.length > 0) {
        changeNotes = changes.join('. ')
      }
    } else {
      changeNotes = 'Initial quote version'
    }

    // Create the snapshot
    const snapshot = {
      openings: quoteData.quoteItems?.map((item: any) => ({
        id: item.openingId,
        name: item.name,
        dimensions: item.dimensions,
        panels: [], // Simplified - full panel data not needed for display
        price: item.price,
        costBreakdown: item.costBreakdown || {
          extrusion: 0,
          hardware: 0,
          glass: 0,
          packaging: 0,
          other: 0,
        },
      })) || [],
      pricingMode: project.pricingMode
        ? {
            name: project.pricingMode.name,
            markup: project.pricingMode.markup,
            discount: project.pricingMode.discount,
            extrusionMarkup: project.pricingMode.extrusionMarkup,
            hardwareMarkup: project.pricingMode.hardwareMarkup,
            glassMarkup: project.pricingMode.glassMarkup,
            packagingMarkup: project.pricingMode.packagingMarkup,
          }
        : null,
      installationMethod: project.installationMethod,
      installationComplexity: project.installationComplexity,
      manualInstallationCost: project.manualInstallationCost,
      quoteItems: quoteData.quoteItems || [],
      // Include attachment info for change detection
      attachments: project.quoteAttachments.map((a) => ({
        id: a.id,
        originalName: a.originalName,
        position: a.position,
        displayOrder: a.displayOrder,
      })),
    }

    // Create the quote version record
    const quoteVersion = await prisma.quoteVersion.create({
      data: {
        projectId,
        version: nextVersion,
        subtotal: quoteData.subtotal || 0,
        markupAmount: quoteData.markupAmount || 0,
        discountAmount: quoteData.discountAmount || 0,
        taxAmount: quoteData.taxAmount || 0,
        installationCost: quoteData.installationCost || 0,
        totalPrice: quoteData.totalPrice || 0,
        pricingModeId: project.pricingModeId,
        pricingModeName: project.pricingMode?.name || null,
        taxRate: project.taxRate || 0,
        snapshot,
        changeNotes,
      },
    })

    return NextResponse.json({ version: quoteVersion })
  } catch (error) {
    console.error('Error creating quote version:', error)
    return NextResponse.json(
      { error: 'Failed to create quote version' },
      { status: 500 }
    )
  }
}

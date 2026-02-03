import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch cached quote data from the latest QuoteVersion (no regeneration)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Get project basic info and latest quote version in parallel
    const [project, latestQuote] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              address: true,
              city: true,
              state: true,
              zipCode: true
            }
          }
        }
      }),
      prisma.quoteVersion.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          version: true,
          subtotal: true,
          markupAmount: true,
          discountAmount: true,
          taxAmount: true,
          installationCost: true,
          totalPrice: true,
          snapshot: true,
          createdAt: true
        }
      })
    ])

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (!latestQuote) {
      return NextResponse.json(
        { error: 'No quote found for this project. Please generate a quote first.' },
        { status: 404 }
      )
    }

    // Parse the snapshot to get quoteItems
    const snapshot = latestQuote.snapshot as any
    const quoteItems = snapshot?.quoteItems || []

    if (quoteItems.length === 0) {
      return NextResponse.json(
        { error: 'Quote has no items. Please regenerate the quote.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        customerId: project.customerId,
        customer: project.customer
      },
      quoteId: latestQuote.id,
      version: latestQuote.version,
      subtotal: latestQuote.subtotal,
      markupAmount: latestQuote.markupAmount,
      discountAmount: latestQuote.discountAmount,
      taxAmount: latestQuote.taxAmount,
      installationCost: latestQuote.installationCost,
      totalPrice: latestQuote.totalPrice,
      quoteItems,
      createdAt: latestQuote.createdAt
    })
  } catch (error) {
    console.error('Error fetching cached quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote data' },
      { status: 500 }
    )
  }
}

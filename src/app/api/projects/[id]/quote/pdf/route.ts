import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createQuotePDF, QuoteData } from '@/lib/quote-pdf-generator'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    // Call the quote API to get fresh pricing data (includes price recalculation)
    // This ensures PDF uses the same accurate pricing as the Quote view
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`
    const cookieHeader = request.headers.get('cookie') || ''

    const quoteResponse = await fetch(`${baseUrl}/api/projects/${projectId}/quote`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader
      }
    })

    if (!quoteResponse.ok) {
      const errorData = await quoteResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch quote data' },
        { status: quoteResponse.status }
      )
    }

    const quoteApiData = await quoteResponse.json()

    // Fetch project for attachments and product IDs (minimal query)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        quoteAttachments: {
          orderBy: { displayOrder: 'asc' }
        },
        openings: {
          include: {
            panels: {
              include: {
                componentInstance: {
                  select: { productId: true }
                }
              }
            }
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

    // Build QuoteData object from the quote API response
    const quoteData: QuoteData = {
      project: {
        id: quoteApiData.project.id,
        name: quoteApiData.project.name,
        status: quoteApiData.project.status,
        createdAt: quoteApiData.project.createdAt,
        updatedAt: quoteApiData.project.updatedAt,
        pricingMode: quoteApiData.project.pricingMode ? {
          name: quoteApiData.project.pricingMode.name,
          markup: quoteApiData.project.pricingMode.markup,
          discount: quoteApiData.project.pricingMode.discount
        } : null
      },
      quoteItems: quoteApiData.quoteItems,
      subtotal: quoteApiData.subtotal,
      markupAmount: quoteApiData.markupAmount,
      discountAmount: quoteApiData.discountAmount,
      adjustedSubtotal: quoteApiData.adjustedSubtotal,
      installationCost: quoteApiData.installationCost,
      taxRate: quoteApiData.taxRate,
      taxAmount: quoteApiData.taxAmount,
      totalPrice: quoteApiData.totalPrice
    }

    // Fetch persistent quote documents
    // 1. Get all global documents
    const globalDocuments = await prisma.quoteDocument.findMany({
      where: { isGlobal: true },
      orderBy: { displayOrder: 'asc' }
    })

    // 2. Get all unique products used in this quote
    const productIds = new Set<number>()
    for (const opening of project.openings) {
      for (const panel of opening.panels) {
        if (panel.componentInstance?.productId) {
          productIds.add(panel.componentInstance.productId)
        }
      }
    }

    // 3. Get product-specific documents for those products
    const productSpecificDocuments = await prisma.quoteDocument.findMany({
      where: {
        productDocuments: {
          some: {
            productId: { in: Array.from(productIds) }
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    })

    // 4. Combine and deduplicate documents
    const documentMap = new Map()

    // Add global documents first
    for (const doc of globalDocuments) {
      documentMap.set(doc.id, {
        id: doc.id,
        filename: doc.filename,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        type: doc.category,
        displayOrder: doc.displayOrder,
        description: doc.description,
        isGlobal: true
      })
    }

    // Add product-specific documents (won't overwrite if already added as global)
    for (const doc of productSpecificDocuments) {
      if (!documentMap.has(doc.id)) {
        documentMap.set(doc.id, {
          id: doc.id,
          filename: doc.filename,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          type: doc.category,
          displayOrder: doc.displayOrder,
          description: doc.description,
          isGlobal: false
        })
      }
    }

    // 5. Convert to array and sort by displayOrder
    const persistentDocuments = Array.from(documentMap.values()).sort((a, b) => a.displayOrder - b.displayOrder)

    // 6. Combine and order attachments with proper positioning
    // The order should be:
    // 1. Beginning attachments (position='beginning' or legacy 'before')
    // 2. Quote page(s) with grand total (handled by createQuotePDF)
    // 3. After-quote attachments (position='after_quote' or legacy 'after' or no position)
    // 4. Persistent documents (global + product-specific)
    // 5. End attachments (position='end')

    const beginningAttachments = project.quoteAttachments
      .filter(a => a.position === 'beginning' || a.position === 'before')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const afterQuoteAttachments = project.quoteAttachments
      .filter(a => a.position === 'after_quote' || a.position === 'after' || !a.position)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const endAttachments = project.quoteAttachments
      .filter(a => a.position === 'end')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    // Combine in the correct order for PDF generation
    // Note: The PDF generator will handle the ordering based on position values
    const allAttachments = [
      ...beginningAttachments.map(a => ({ ...a, position: 'beginning' })),
      ...afterQuoteAttachments.map(a => ({ ...a, position: 'after_quote' })),
      ...persistentDocuments.map(doc => ({
        ...doc,
        isPersistent: true,
        position: 'persistent' // Special position for persistent docs (between after_quote and end)
      })),
      ...endAttachments.map(a => ({ ...a, position: 'end' }))
    ]

    // Generate PDF with all attachments (now returns Buffer directly)
    const pdfBuffer = await createQuotePDF(quoteData, allAttachments as any)

    const filename = `Quote_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Error generating quote PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote PDF' },
      { status: 500 }
    )
  }
}

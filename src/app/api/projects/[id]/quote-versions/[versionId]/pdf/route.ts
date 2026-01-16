import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createQuotePDF, QuoteData } from '@/lib/quote-pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params
    const projectId = parseInt(id)
    const versionIdNum = parseInt(versionId)

    // Fetch the quote version
    const version = await prisma.quoteVersion.findFirst({
      where: {
        id: versionIdNum,
        projectId,
      },
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Quote version not found' },
        { status: 404 }
      )
    }

    // Fetch project for basic info and customer data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        customer: {
          select: {
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true
          }
        },
        quoteAttachments: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    })

    // Fetch company logo from branding settings
    const logoSetting = await prisma.globalSetting.findUnique({
      where: { key: 'company_logo' }
    })
    const companyLogo = logoSetting?.value || null

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Get snapshot data
    const snapshot = version.snapshot as any

    // Build QuoteData from the snapshot
    // Include version number in project name for clear identification
    const quoteData: QuoteData = {
      project: {
        id: project.id,
        name: `${project.name} (Quote v${version.version})`,
        status: project.status,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.createdAt.toISOString(),
        pricingMode: version.pricingModeName
          ? {
              name: version.pricingModeName,
              markup: snapshot.pricingMode?.markup || 0,
              discount: snapshot.pricingMode?.discount || 0,
            }
          : null,
      },
      customer: project.customer ? {
        companyName: project.customer.companyName,
        contactName: project.customer.contactName,
        email: project.customer.email,
        phone: project.customer.phone,
        address: project.customer.address,
        city: project.customer.city,
        state: project.customer.state,
        zip: project.customer.zipCode
      } : null,
      companyLogo: companyLogo,
      quoteItems: snapshot.quoteItems || [],
      subtotal: version.subtotal,
      markupAmount: version.markupAmount,
      discountAmount: version.discountAmount,
      adjustedSubtotal: version.subtotal + version.markupAmount - version.discountAmount,
      installationCost: version.installationCost,
      taxRate: version.taxRate,
      taxAmount: version.taxAmount,
      totalPrice: version.totalPrice,
    }

    // Fetch global quote documents
    const globalDocuments = await prisma.quoteDocument.findMany({
      where: { isGlobal: true },
      orderBy: { displayOrder: 'asc' },
    })

    // Combine attachments in the correct order for PDF generation
    const beginningAttachments = project.quoteAttachments
      .filter(a => a.position === 'beginning' || a.position === 'before')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const afterQuoteAttachments = project.quoteAttachments
      .filter(a => a.position === 'after_quote' || a.position === 'after' || !a.position)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    const endAttachments = project.quoteAttachments
      .filter(a => a.position === 'end')
      .sort((a, b) => a.displayOrder - b.displayOrder)

    // Convert global documents to attachment format
    const persistentDocuments = globalDocuments.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      type: doc.category,
      displayOrder: doc.displayOrder,
      description: doc.description,
      isPersistent: true,
      position: 'persistent',
    }))

    const allAttachments = [
      ...beginningAttachments.map(a => ({ ...a, position: 'beginning' })),
      ...afterQuoteAttachments.map(a => ({ ...a, position: 'after_quote' })),
      ...persistentDocuments,
      ...endAttachments.map(a => ({ ...a, position: 'end' })),
    ]

    // Generate the PDF
    const pdfBuffer = await createQuotePDF(quoteData, allAttachments as any)

    const filename = `Quote_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${version.version}_${version.createdAt.toISOString().split('T')[0]}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error generating quote version PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

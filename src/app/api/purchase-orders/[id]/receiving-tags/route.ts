import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createReceivingTagsPDF, ReceivingTagItem } from '@/lib/receiving-tag-pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const poId = parseInt(id)

    // Get totalBoxes from query params (default to 1)
    const searchParams = request.nextUrl.searchParams
    const totalBoxes = Math.max(1, parseInt(searchParams.get('boxes') || '1'))

    if (isNaN(poId)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      )
    }

    // Fetch purchase order with vendor and lines
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        vendor: true,
        lines: {
          include: {
            quickbooksItem: true
          },
          orderBy: { lineNum: 'asc' }
        }
      }
    })

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    // Build items list
    const items: ReceivingTagItem[] = purchaseOrder.lines.map(line => ({
      name: line.quickbooksItem?.name || line.description || 'Unnamed Item',
      sku: line.quickbooksItem?.sku || null,
      quantity: line.quantity
    }))

    // Generate PDF with multiple pages (one per box)
    const pdfBuffer = await createReceivingTagsPDF(
      purchaseOrder.poNumber,
      purchaseOrder.vendor.displayName,
      items,
      totalBoxes
    )

    const filename = `Receiving_Tags_${purchaseOrder.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      }
    })

  } catch (error) {
    console.error('Error generating receiving tags PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate receiving tags' },
      { status: 500 }
    )
  }
}

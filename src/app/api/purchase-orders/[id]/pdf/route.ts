import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPurchaseOrderPDF, POPDFData } from '@/lib/po-pdf-generator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const poId = parseInt(id)

    if (isNaN(poId)) {
      return NextResponse.json(
        { error: 'Invalid purchase order ID' },
        { status: 400 }
      )
    }

    // Fetch purchase order with all related data
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

    // Fetch company info from global settings (if available)
    const companySettings = await prisma.globalSetting.findMany({
      where: {
        key: {
          in: ['company_name', 'company_address', 'company_phone', 'company_email']
        }
      }
    })

    const companyInfo: POPDFData['companyInfo'] = {
      name: companySettings.find(s => s.key === 'company_name')?.value || 'Your Company',
      address: companySettings.find(s => s.key === 'company_address')?.value,
      phone: companySettings.find(s => s.key === 'company_phone')?.value,
      email: companySettings.find(s => s.key === 'company_email')?.value
    }

    // Build PDF data
    const pdfData: POPDFData = {
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      txnDate: purchaseOrder.txnDate?.toISOString() || new Date().toISOString(),
      expectedDate: purchaseOrder.expectedDate?.toISOString() || null,
      dueDate: purchaseOrder.dueDate?.toISOString() || null,
      vendor: {
        displayName: purchaseOrder.vendor.displayName,
        companyName: purchaseOrder.vendor.companyName,
        primaryEmail: purchaseOrder.vendor.primaryEmail,
        primaryPhone: purchaseOrder.vendor.primaryPhone,
        billAddressLine1: purchaseOrder.vendor.billAddressLine1,
        billAddressLine2: purchaseOrder.vendor.billAddressLine2,
        billAddressCity: purchaseOrder.vendor.billAddressCity,
        billAddressState: purchaseOrder.vendor.billAddressState,
        billAddressZip: purchaseOrder.vendor.billAddressZip
      },
      shipTo: purchaseOrder.shipAddrLine1 ? {
        line1: purchaseOrder.shipAddrLine1,
        line2: purchaseOrder.shipAddrLine2,
        city: purchaseOrder.shipAddrCity,
        state: purchaseOrder.shipAddrState,
        zip: (purchaseOrder as any).shipAddrZip ?? purchaseOrder.shipAddrPostalCode,
        country: purchaseOrder.shipAddrCountry
      } : undefined,
      lines: purchaseOrder.lines.map(line => ({
        lineNum: line.lineNum,
        itemName: line.quickbooksItem?.name || null,
        itemSku: line.quickbooksItem?.sku || null,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount
      })),
      subtotal: purchaseOrder.subtotal,
      taxAmount: purchaseOrder.taxAmount,
      shippingAmount: purchaseOrder.shippingAmount,
      totalAmount: purchaseOrder.totalAmount,
      memo: purchaseOrder.memo,
      companyInfo
    }

    // Generate PDF
    const pdfBuffer = createPurchaseOrderPDF(pdfData)

    const filename = `PO_${purchaseOrder.poNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      }
    })

  } catch (error) {
    console.error('Error generating PO PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

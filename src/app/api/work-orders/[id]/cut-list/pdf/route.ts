import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCutListPDF, CutListPdfData, CutListPdfGroup, CutListPdfItem } from '@/lib/cutlist-pdf-generator'

// GET /api/work-orders/[id]/cut-list/pdf - Generate cut list PDF for a work order
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workOrderId } = await context.params

    // Get work order with items and project info
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            productionColor: true,
            customer: {
              select: {
                companyName: true
              }
            },
            openings: {
              select: {
                name: true,
                finishColor: true
              }
            }
          }
        },
        items: {
          where: {
            partType: 'Extrusion'
          },
          orderBy: [
            { partNumber: 'asc' },
            { cutLength: 'asc' }
          ]
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Create a map of opening names to finish colors
    const openingFinishMap = new Map(
      workOrder.project?.openings?.map(o => [o.name, o.finishColor]) || []
    )

    // Group items by part number for the cut list
    const itemsByPartNumber: Record<string, typeof workOrder.items> = {}
    for (const item of workOrder.items) {
      if (!itemsByPartNumber[item.partNumber]) {
        itemsByPartNumber[item.partNumber] = []
      }
      itemsByPartNumber[item.partNumber].push(item)
    }

    // Create cut list groups - one group per part number
    const groups: CutListPdfGroup[] = Object.entries(itemsByPartNumber).map(([partNumber, items]) => {
      const firstItem = items[0]
      const finishColor = firstItem.openingName ? openingFinishMap.get(firstItem.openingName) : null

      // Aggregate items by cut length
      const itemsByCutLength: Record<string, CutListPdfItem> = {}
      for (const item of items) {
        const cutKey = item.cutLength?.toFixed(3) || 'null'
        if (!itemsByCutLength[cutKey]) {
          itemsByCutLength[cutKey] = {
            partNumber: item.partNumber,
            partName: item.partName,
            cutLength: item.cutLength,
            qtyPerUnit: 1,
            totalQty: 0,
            isMilled: item.metadata?.isMilled ?? true,
            binLocation: item.binLocation,
            stockLength: item.stockLength,
            color: finishColor || undefined
          }
        }
        itemsByCutLength[cutKey].totalQty += item.quantity
      }

      return {
        productName: firstItem.partName,
        sizeKey: partNumber,
        unitCount: items.reduce((sum, i) => sum + i.quantity, 0),
        items: Object.values(itemsByCutLength).sort((a, b) =>
          (a.cutLength || 0) - (b.cutLength || 0)
        )
      }
    })

    // Sort groups by part number
    groups.sort((a, b) => a.sizeKey.localeCompare(b.sizeKey))

    // Build cut list data
    const cutListData: CutListPdfData = {
      projectName: `${workOrder.project?.name || 'Unknown Project'} - Batch ${workOrder.batchNumber}`,
      customerName: workOrder.project?.customer?.companyName,
      companyLogo: null, // Could add logo path here
      groups,
      generatedDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      batchSize: 1,
      totalUnits: workOrder.items.reduce((sum, i) => sum + i.quantity, 0)
    }

    // Generate the PDF
    const pdfBuffer = await createCutListPDF(cutListData)

    // Return PDF with appropriate headers
    const sanitizedProjectName = (workOrder.project?.name || 'project')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizedProjectName}_batch${workOrder.batchNumber}_cutlist.pdf"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error generating cut list PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate cut list PDF' },
      { status: 500 }
    )
  }
}

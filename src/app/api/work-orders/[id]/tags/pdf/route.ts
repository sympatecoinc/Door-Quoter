import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createExtrusionTagsPDF } from '@/lib/extrusion-tag-pdf-generator'

// GET /api/work-orders/[id]/tags/pdf - Generate extrusion tag PDF for a work order
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
            name: true,
            productionColor: true
          }
        },
        items: {
          where: {
            partType: 'Extrusion'
          }
        }
      }
    })

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Get total batch count for this project
    const totalBatches = await prisma.workOrder.count({
      where: { projectId: workOrder.project ? workOrder.projectId : undefined }
    })

    // Default color if project doesn't have one assigned
    const projectColor = workOrder.project?.productionColor || '#3B82F6'

    // Generate the PDF
    const pdfBuffer = await createExtrusionTagsPDF(
      workOrder.id,
      workOrder.project?.name || 'Unknown Project',
      projectColor,
      workOrder.items.map(item => ({
        partNumber: item.partNumber,
        partName: item.partName,
        partType: item.partType,
        quantity: item.quantity,
        cutLength: item.cutLength,
        stockLength: item.stockLength,
        binLocation: item.binLocation,
        openingName: item.openingName
      })),
      workOrder.batchNumber,
      totalBatches
    )

    // Return PDF with appropriate headers
    const sanitizedProjectName = (workOrder.project?.name || 'project')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizedProjectName}_batch${workOrder.batchNumber}_tags.pdf"`,
        'Cache-Control': 'no-cache'
      }
    })
  } catch (error) {
    console.error('Error generating extrusion tags PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate tags PDF' },
      { status: 500 }
    )
  }
}

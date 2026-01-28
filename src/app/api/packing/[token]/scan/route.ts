import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { qrData } = await request.json()

    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR data', success: false },
        { status: 400 }
      )
    }

    // Find project by packing access token
    const project = await prisma.project.findUnique({
      where: { packingAccessToken: token },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Packing list not found or link expired', success: false },
        { status: 404 }
      )
    }

    // Parse QR data: format is "partNumber|openingName|itemName" or "JAMB-KIT|openingName"
    const parts = qrData.split('|')
    let partNumber: string | null = null
    let openingName: string | null = null
    let itemName: string | null = null

    if (parts[0] === 'JAMB-KIT') {
      // Jamb kit format: JAMB-KIT|openingName
      openingName = parts[1] || null
      itemName = 'Jamb Kit'
    } else if (parts.length >= 2) {
      // Hardware/component format: partNumber|openingName|itemName
      // Note: partNumber might be empty string for components
      partNumber = parts[0] || null
      openingName = parts[1] || null
      itemName = parts[2] || null
    }

    if (!openingName) {
      return NextResponse.json(
        {
          error: 'Invalid QR code format',
          success: false,
          scannedData: qrData
        },
        { status: 400 }
      )
    }

    // Find matching SalesOrderPart
    // First, try to find by exact match
    const whereClause: {
      salesOrder: { projectId: number }
      openingName: string
      status: { not: string }
      partNumber?: string | null
      partName?: string
    } = {
      salesOrder: { projectId: project.id },
      openingName: openingName,
      status: { not: 'PACKED' }
    }

    if (partNumber) {
      whereClause.partNumber = partNumber
    }
    if (itemName) {
      whereClause.partName = itemName
    }

    let salesOrderPart = await prisma.salesOrderPart.findFirst({
      where: whereClause,
      include: {
        salesOrder: true
      }
    })

    // If no match found with exact criteria, try fuzzy matching
    if (!salesOrderPart) {
      // Try to find any unpacked part in this opening
      const matchingParts = await prisma.salesOrderPart.findMany({
        where: {
          salesOrder: { projectId: project.id },
          openingName: openingName,
          status: { not: 'PACKED' }
        },
        include: {
          salesOrder: true
        }
      })

      // Try to find best match
      for (const part of matchingParts) {
        const partQrData = [part.partNumber || '', part.openingName || '', part.partName || '']
          .filter(Boolean)
          .join('|')

        if (partQrData === qrData) {
          salesOrderPart = part
          break
        }
      }

      // If still no match, check if it's a jamb kit
      if (!salesOrderPart && parts[0] === 'JAMB-KIT') {
        salesOrderPart = matchingParts.find(p =>
          p.partName?.toLowerCase().includes('jamb') ||
          p.partName?.toLowerCase().includes('kit')
        ) || null
      }
    }

    // Check if item was already packed
    const alreadyPackedPart = await prisma.salesOrderPart.findFirst({
      where: {
        salesOrder: { projectId: project.id },
        openingName: openingName,
        status: 'PACKED',
        ...(partNumber ? { partNumber } : {}),
        ...(itemName ? { partName: itemName } : {})
      }
    })

    if (alreadyPackedPart) {
      // Get updated stats
      const stats = await getPackingStats(project.id)

      return NextResponse.json({
        success: false,
        alreadyPacked: true,
        message: 'Item already packed',
        item: {
          partNumber: alreadyPackedPart.partNumber,
          itemName: alreadyPackedPart.partName,
          openingName: alreadyPackedPart.openingName,
          packedAt: alreadyPackedPart.packedAt?.toISOString()
        },
        stats
      })
    }

    if (!salesOrderPart) {
      // Get updated stats
      const stats = await getPackingStats(project.id)

      return NextResponse.json(
        {
          success: false,
          error: 'Item not found in packing list',
          scannedData: qrData,
          parsedData: { partNumber, openingName, itemName },
          stats
        },
        { status: 404 }
      )
    }

    // Update the SalesOrderPart status to PACKED
    const updatedPart = await prisma.salesOrderPart.update({
      where: { id: salesOrderPart.id },
      data: {
        status: 'PACKED',
        packedAt: new Date(),
        qtyPacked: salesOrderPart.quantity
      }
    })

    // Get updated stats
    const stats = await getPackingStats(project.id)

    return NextResponse.json({
      success: true,
      message: 'Item packed successfully',
      item: {
        id: updatedPart.id,
        partNumber: updatedPart.partNumber,
        itemName: updatedPart.partName,
        openingName: updatedPart.openingName,
        status: 'packed',
        packedAt: updatedPart.packedAt?.toISOString()
      },
      stats
    })

  } catch (error) {
    console.error('Error scanning item:', error)
    return NextResponse.json(
      { error: 'Failed to process scan', success: false },
      { status: 500 }
    )
  }
}

async function getPackingStats(projectId: number) {
  const allParts = await prisma.salesOrderPart.findMany({
    where: {
      salesOrder: { projectId }
    },
    select: { status: true }
  })

  const total = allParts.length
  const packed = allParts.filter(p => p.status === 'PACKED').length

  return {
    total,
    packed,
    remaining: total - packed
  }
}

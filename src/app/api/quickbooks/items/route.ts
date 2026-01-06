import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoredRealmId, syncItemsFromQB } from '@/lib/quickbooks'

// GET - List all synced QB items or trigger sync
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') // Filter by item type
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    // If action is 'sync', trigger sync from QuickBooks
    if (action === 'sync') {
      const realmId = await getStoredRealmId()
      if (!realmId) {
        return NextResponse.json(
          { error: 'QuickBooks not connected. Please connect to QuickBooks first.' },
          { status: 400 }
        )
      }

      const result = await syncItemsFromQB(realmId)
      return NextResponse.json({
        message: 'Items synced from QuickBooks',
        ...result
      })
    }

    // Otherwise, return local items list
    const where: any = {}

    if (activeOnly) {
      where.active = true
    }

    if (type) {
      where.type = type
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const items = await prisma.quickBooksItem.findMany({
      where,
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('Error fetching QB items:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch items' },
      { status: 500 }
    )
  }
}

// POST - Link a MasterPart to a QB Item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quickbooksItemId, masterPartId } = body

    if (!quickbooksItemId || !masterPartId) {
      return NextResponse.json(
        { error: 'quickbooksItemId and masterPartId are required' },
        { status: 400 }
      )
    }

    // Check if the QB item exists
    const qbItem = await prisma.quickBooksItem.findUnique({
      where: { id: quickbooksItemId }
    })

    if (!qbItem) {
      return NextResponse.json(
        { error: 'QuickBooks item not found' },
        { status: 404 }
      )
    }

    // Check if MasterPart exists
    const masterPart = await prisma.masterPart.findUnique({
      where: { id: masterPartId }
    })

    if (!masterPart) {
      return NextResponse.json(
        { error: 'MasterPart not found' },
        { status: 404 }
      )
    }

    // Update the link
    const updatedItem = await prisma.quickBooksItem.update({
      where: { id: quickbooksItemId },
      data: { masterPartId },
      include: {
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true
          }
        }
      }
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Error linking QB item to MasterPart:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link item' },
      { status: 500 }
    )
  }
}

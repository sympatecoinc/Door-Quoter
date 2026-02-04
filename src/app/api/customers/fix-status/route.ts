import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST - Fix customers with 'Inactive' status to 'Archived'
export async function POST() {
  try {
    // First, let's see what statuses exist
    const statusCounts = await prisma.customer.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    console.log('Current status counts:', statusCounts)

    // Update all 'Inactive' customers to 'Archived'
    const updateResult = await prisma.customer.updateMany({
      where: { status: 'Inactive' },
      data: { status: 'Archived' }
    })

    // Get new counts
    const newStatusCounts = await prisma.customer.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${updateResult.count} customers from 'Inactive' to 'Archived'`,
      before: statusCounts,
      after: newStatusCounts
    })
  } catch (error) {
    console.error('Error fixing customer status:', error)
    return NextResponse.json(
      { error: 'Failed to fix customer status' },
      { status: 500 }
    )
  }
}

// GET - Just show current status counts (for debugging)
export async function GET() {
  try {
    const statusCounts = await prisma.customer.groupBy({
      by: ['status'],
      _count: { id: true }
    })

    const total = await prisma.customer.count()

    return NextResponse.json({
      total,
      statusCounts
    })
  } catch (error) {
    console.error('Error getting status counts:', error)
    return NextResponse.json(
      { error: 'Failed to get status counts' },
      { status: 500 }
    )
  }
}

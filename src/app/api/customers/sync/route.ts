import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  syncCustomersFromQB,
  pushCustomerToQB
} from '@/lib/quickbooks'

// GET - Sync all customers from QuickBooks
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 400 }
      )
    }

    const results = await syncCustomersFromQB(realmId)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error syncing customers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync customers' },
      { status: 500 }
    )
  }
}

// POST - Push a single customer to QuickBooks
export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json()

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const updatedCustomer = await pushCustomerToQB(customerId)

    return NextResponse.json({
      success: true,
      customer: updatedCustomer
    })
  } catch (error) {
    console.error('Error pushing customer to QB:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to push customer' },
      { status: 500 }
    )
  }
}

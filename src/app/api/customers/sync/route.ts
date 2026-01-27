import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getStoredRealmId,
  syncCustomersFromQB,
  pushCustomerToQB
} from '@/lib/quickbooks'

// GET - 2-way sync: Push local customers to QB, then pull QB customers to local
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      pushed: 0,
      errors: [] as string[]
    }

    // Step 1: Push local customers without quickbooksId to QuickBooks
    // Exclude Leads - they should only be pushed when status changes to Active
    const localOnlyCustomers = await prisma.customer.findMany({
      where: {
        quickbooksId: null,
        status: { notIn: ['Lead'] }
      }
    })

    console.log(`[QB 2-Way Sync] Found ${localOnlyCustomers.length} local customers to push to QuickBooks`)

    for (const customer of localOnlyCustomers) {
      try {
        await pushCustomerToQB(customer.id)
        results.pushed++
        console.log(`[QB 2-Way Sync] Pushed customer "${customer.companyName}" to QuickBooks`)
      } catch (error) {
        const errorMsg = `Failed to push customer ${customer.companyName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    // Step 2: Pull customers from QuickBooks to local
    const pullResults = await syncCustomersFromQB(realmId)
    results.created = pullResults.created
    results.updated = pullResults.updated
    results.errors.push(...pullResults.errors)

    console.log(`[QB 2-Way Sync] Complete: Pushed ${results.pushed}, Created ${results.created}, Updated ${results.updated}`)

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

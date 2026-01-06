import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncVendorsFromQB, getStoredRealmId, pushVendorToQB } from '@/lib/quickbooks'

// GET: 2-way sync - Push local vendors to QB, then pull QB vendors to local
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()

    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Please connect to QuickBooks first.' },
        { status: 400 }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      pushed: 0,
      errors: [] as string[]
    }

    // Step 1: Push local vendors without quickbooksId to QuickBooks
    const localOnlyVendors = await prisma.vendor.findMany({
      where: { quickbooksId: null }
    })

    console.log(`[QB 2-Way Sync] Found ${localOnlyVendors.length} local vendors to push to QuickBooks`)

    for (const vendor of localOnlyVendors) {
      try {
        await pushVendorToQB(vendor.id)
        results.pushed++
        console.log(`[QB 2-Way Sync] Pushed vendor "${vendor.displayName}" to QuickBooks`)
      } catch (error) {
        const errorMsg = `Failed to push vendor ${vendor.displayName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    // Step 2: Pull vendors from QuickBooks to local
    const pullResults = await syncVendorsFromQB(realmId)
    results.created = pullResults.created
    results.updated = pullResults.updated
    results.errors.push(...pullResults.errors)

    console.log(`[QB 2-Way Sync] Complete: Pushed ${results.pushed}, Created ${results.created}, Updated ${results.updated}`)

    return NextResponse.json({
      success: true,
      message: `2-way sync complete. Pushed: ${results.pushed}, Created: ${results.created}, Updated: ${results.updated}`,
      ...results
    })
  } catch (error) {
    console.error('Error syncing vendors:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vendors' },
      { status: 500 }
    )
  }
}

// POST: Push a specific vendor to QuickBooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vendorId } = body

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      )
    }

    const updatedVendor = await pushVendorToQB(vendorId)

    return NextResponse.json({
      success: true,
      message: 'Vendor synced to QuickBooks',
      vendor: updatedVendor
    })
  } catch (error) {
    console.error('Error pushing vendor to QuickBooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vendor to QuickBooks' },
      { status: 500 }
    )
  }
}

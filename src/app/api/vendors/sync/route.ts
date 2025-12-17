import { NextRequest, NextResponse } from 'next/server'
import { syncVendorsFromQB, getStoredRealmId, pushVendorToQB } from '@/lib/quickbooks'

// GET: Sync all vendors from QuickBooks
export async function GET(request: NextRequest) {
  try {
    const realmId = await getStoredRealmId()

    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Please connect to QuickBooks first.' },
        { status: 400 }
      )
    }

    const results = await syncVendorsFromQB(realmId)

    return NextResponse.json({
      success: true,
      message: `Sync complete. Created: ${results.created}, Updated: ${results.updated}`,
      ...results
    })
  } catch (error) {
    console.error('Error syncing vendors from QuickBooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vendors from QuickBooks' },
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

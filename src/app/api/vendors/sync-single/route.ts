import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStoredRealmId, fetchQBVendor, qbVendorToLocal } from '@/lib/quickbooks'

// POST: Sync a single vendor from QuickBooks by their QB ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quickbooksId, vendorId } = body

    if (!quickbooksId && !vendorId) {
      return NextResponse.json(
        { error: 'Either quickbooksId or vendorId is required' },
        { status: 400 }
      )
    }

    const realmId = await getStoredRealmId()
    if (!realmId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 400 }
      )
    }

    // If we have vendorId, look up the quickbooksId
    let qbId = quickbooksId
    let localVendorId = vendorId

    if (vendorId && !quickbooksId) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId }
      })
      if (!vendor?.quickbooksId) {
        return NextResponse.json(
          { error: 'Vendor is not linked to QuickBooks' },
          { status: 400 }
        )
      }
      qbId = vendor.quickbooksId
      localVendorId = vendor.id
    }

    // Fetch the vendor from QuickBooks
    const qbVendor = await fetchQBVendor(realmId, qbId)
    const localData = qbVendorToLocal(qbVendor)

    // Find the local vendor
    const existingVendor = await prisma.vendor.findUnique({
      where: { quickbooksId: qbId }
    })

    let updatedVendor
    if (existingVendor) {
      // Update existing vendor (preserve local-only fields)
      updatedVendor = await prisma.vendor.update({
        where: { id: existingVendor.id },
        data: {
          ...localData,
          // Preserve local-only fields
          category: existingVendor.category,
          code: existingVendor.code
        },
        include: { contacts: true }
      })
    } else {
      // Create new vendor
      updatedVendor = await prisma.vendor.create({
        data: localData,
        include: { contacts: true }
      })
    }

    return NextResponse.json({
      success: true,
      vendor: updatedVendor
    })
  } catch (error) {
    console.error('Error syncing single vendor from QuickBooks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync vendor from QuickBooks' },
      { status: 500 }
    )
  }
}

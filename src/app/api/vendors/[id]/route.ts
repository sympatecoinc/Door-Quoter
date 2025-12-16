import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      )
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { name: 'asc' }
          ]
        }
      }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      )
    }

    const existingVendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    })

    if (!existingVendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      displayName,
      companyName,
      givenName,
      familyName,
      printOnCheckName,
      primaryEmail,
      primaryPhone,
      alternatePhone,
      mobile,
      fax,
      website,
      billAddressLine1,
      billAddressLine2,
      billAddressCity,
      billAddressState,
      billAddressZip,
      billAddressCountry,
      taxIdentifier,
      acctNum,
      vendor1099,
      termRefId,
      termRefName,
      notes,
      category,
      code,
      isActive,
      // QuickBooks sync fields
      quickbooksId,
      syncToken,
      balance,
      lastSyncedAt
    } = body

    if (displayName !== undefined && (!displayName || !displayName.trim())) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate quickbooksId if changed
    if (quickbooksId && quickbooksId !== existingVendor.quickbooksId) {
      const duplicateVendor = await prisma.vendor.findUnique({
        where: { quickbooksId }
      })
      if (duplicateVendor) {
        return NextResponse.json(
          { error: 'Another vendor with this QuickBooks ID already exists' },
          { status: 409 }
        )
      }
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(displayName !== undefined && { displayName: displayName.trim() }),
        ...(companyName !== undefined && { companyName: companyName?.trim() || null }),
        ...(givenName !== undefined && { givenName: givenName?.trim() || null }),
        ...(familyName !== undefined && { familyName: familyName?.trim() || null }),
        ...(printOnCheckName !== undefined && { printOnCheckName: printOnCheckName?.trim() || null }),
        ...(primaryEmail !== undefined && { primaryEmail: primaryEmail?.trim() || null }),
        ...(primaryPhone !== undefined && { primaryPhone: primaryPhone?.trim() || null }),
        ...(alternatePhone !== undefined && { alternatePhone: alternatePhone?.trim() || null }),
        ...(mobile !== undefined && { mobile: mobile?.trim() || null }),
        ...(fax !== undefined && { fax: fax?.trim() || null }),
        ...(website !== undefined && { website: website?.trim() || null }),
        ...(billAddressLine1 !== undefined && { billAddressLine1: billAddressLine1?.trim() || null }),
        ...(billAddressLine2 !== undefined && { billAddressLine2: billAddressLine2?.trim() || null }),
        ...(billAddressCity !== undefined && { billAddressCity: billAddressCity?.trim() || null }),
        ...(billAddressState !== undefined && { billAddressState: billAddressState?.trim() || null }),
        ...(billAddressZip !== undefined && { billAddressZip: billAddressZip?.trim() || null }),
        ...(billAddressCountry !== undefined && { billAddressCountry: billAddressCountry?.trim() || null }),
        ...(taxIdentifier !== undefined && { taxIdentifier: taxIdentifier?.trim() || null }),
        ...(acctNum !== undefined && { acctNum: acctNum?.trim() || null }),
        ...(vendor1099 !== undefined && { vendor1099 }),
        ...(termRefId !== undefined && { termRefId: termRefId?.trim() || null }),
        ...(termRefName !== undefined && { termRefName: termRefName?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(code !== undefined && { code: code?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(quickbooksId !== undefined && { quickbooksId: quickbooksId || null }),
        ...(syncToken !== undefined && { syncToken: syncToken || null }),
        ...(balance !== undefined && { balance: balance ?? null }),
        ...(lastSyncedAt !== undefined && { lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt) : null })
      },
      include: {
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { name: 'asc' }
          ]
        }
      }
    })

    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error updating vendor:', error)
    return NextResponse.json(
      { error: 'Failed to update vendor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: 'Invalid vendor ID' },
        { status: 400 }
      )
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // If vendor has QuickBooks ID, just mark as inactive instead of deleting
    // (QB vendors cannot be deleted if they have transactions)
    if (vendor.quickbooksId) {
      const updatedVendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { isActive: false },
        include: { contacts: true }
      })
      return NextResponse.json({
        message: 'Vendor marked as inactive (QuickBooks vendors cannot be deleted)',
        vendor: updatedVendor
      })
    }

    // Delete vendor (cascades to contacts)
    await prisma.vendor.delete({
      where: { id: vendorId }
    })

    return NextResponse.json({ message: 'Vendor deleted successfully' })
  } catch (error) {
    console.error('Error deleting vendor:', error)
    return NextResponse.json(
      { error: 'Failed to delete vendor' },
      { status: 500 }
    )
  }
}

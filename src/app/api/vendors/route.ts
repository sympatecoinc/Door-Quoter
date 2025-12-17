import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const status = searchParams.get('status') // 'active', 'inactive', or 'all'

    const skip = (page - 1) * limit

    const where: any = {}

    // Search filter
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { primaryEmail: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Category filter
    if (category && category !== 'all') {
      where.category = category
    }

    // Status filter (active/inactive)
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }
    // 'all' or undefined = no status filter

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          contacts: {
            orderBy: [
              { isPrimary: 'desc' },
              { name: 'asc' }
            ]
          }
        },
        orderBy: { displayName: 'asc' },
        skip,
        take: limit
      }),
      prisma.vendor.count({ where })
    ])

    return NextResponse.json({
      vendors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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
      // QuickBooks fields (optional, for sync)
      quickbooksId,
      syncToken,
      balance
    } = body

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      )
    }

    // Check for duplicate quickbooksId if provided
    if (quickbooksId) {
      const existingVendor = await prisma.vendor.findUnique({
        where: { quickbooksId }
      })
      if (existingVendor) {
        return NextResponse.json(
          { error: 'Vendor with this QuickBooks ID already exists' },
          { status: 409 }
        )
      }
    }

    const vendor = await prisma.vendor.create({
      data: {
        displayName: displayName.trim(),
        companyName: companyName?.trim() || null,
        givenName: givenName?.trim() || null,
        familyName: familyName?.trim() || null,
        printOnCheckName: printOnCheckName?.trim() || null,
        primaryEmail: primaryEmail?.trim() || null,
        primaryPhone: primaryPhone?.trim() || null,
        alternatePhone: alternatePhone?.trim() || null,
        mobile: mobile?.trim() || null,
        fax: fax?.trim() || null,
        website: website?.trim() || null,
        billAddressLine1: billAddressLine1?.trim() || null,
        billAddressLine2: billAddressLine2?.trim() || null,
        billAddressCity: billAddressCity?.trim() || null,
        billAddressState: billAddressState?.trim() || null,
        billAddressZip: billAddressZip?.trim() || null,
        billAddressCountry: billAddressCountry?.trim() || null,
        taxIdentifier: taxIdentifier?.trim() || null,
        acctNum: acctNum?.trim() || null,
        vendor1099: vendor1099 ?? false,
        termRefId: termRefId?.trim() || null,
        termRefName: termRefName?.trim() || null,
        notes: notes?.trim() || null,
        category: category?.trim() || null,
        code: code?.trim() || null,
        isActive: isActive ?? true,
        quickbooksId: quickbooksId || null,
        syncToken: syncToken || null,
        balance: balance ?? null,
        lastSyncedAt: quickbooksId ? new Date() : null
      },
      include: {
        contacts: true
      }
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor:', error)
    return NextResponse.json(
      { error: 'Failed to create vendor' },
      { status: 500 }
    )
  }
}

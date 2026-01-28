import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POStatus } from '@prisma/client'
import {
  getStoredRealmId,
  createQBPurchaseOrder,
  localPOToQB,
  localPOLineToQB,
  generatePONumber,
  createQBItemForPOLine,
  getVendorExpenseAccount,
  pushVendorToQB,
  QBPOLine
} from '@/lib/quickbooks'

// GET - List purchase orders with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as POStatus | null
    const vendorId = searchParams.get('vendorId')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: any = {}

    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { docNumber: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
        { vendor: { displayName: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId, 10)
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              displayName: true,
              companyName: true,
              primaryEmail: true,
              quickbooksId: true
            }
          },
          lines: {
            include: {
              quickbooksItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              lines: true,
              receivings: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.purchaseOrder.count({ where })
    ])

    return NextResponse.json({
      purchaseOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

// POST - Create a new purchase order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      vendorId,
      txnDate,
      expectedDate,
      dueDate,
      memo,
      privateNote,
      shipAddrLine1,
      shipAddrLine2,
      shipAddrCity,
      shipAddrState,
      shipAddrPostalCode,
      shipAddrCountry,
      lines,
      pushToQuickBooks = true, // Default to pushing to QB
      createdById
    } = body

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor is required' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      )
    }

    // Get the vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    // Generate PO number
    const poNumber = await generatePONumber()

    // Calculate totals from lines
    let subtotal = 0
    const processedLines = lines.map((line: any, index: number) => {
      const amount = (line.quantity || 1) * (line.unitPrice || 0)
      subtotal += amount
      return {
        lineNum: index + 1,
        quickbooksItemId: line.quickbooksItemId || null,
        itemRefId: line.itemRefId || null,
        itemRefName: line.itemRefName || null,
        description: line.description || null,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice || 0,
        amount,
        quantityReceived: 0,
        quantityRemaining: line.quantity || 1,
        notes: line.notes || null
      }
    })

    // Create the local PO first (as Draft)
    let purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        vendorId,
        status: 'DRAFT',
        txnDate: txnDate ? new Date(txnDate) : new Date(),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        memo: memo || null,
        privateNote: privateNote || null,
        shipAddrLine1: shipAddrLine1 || null,
        shipAddrLine2: shipAddrLine2 || null,
        shipAddrCity: shipAddrCity || null,
        shipAddrState: shipAddrState || null,
        shipAddrPostalCode: shipAddrPostalCode || null,
        shipAddrCountry: shipAddrCountry || null,
        subtotal,
        totalAmount: subtotal, // Tax and shipping can be added later
        createdById: createdById || null,
        lines: {
          create: processedLines
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'DRAFT',
            changedById: createdById || null,
            notes: 'Purchase order created'
          }
        }
      },
      include: {
        vendor: true,
        lines: {
          include: {
            quickbooksItem: true
          }
        },
        createdBy: true
      }
    })

    // Push to QuickBooks if requested
    if (pushToQuickBooks) {
      const realmId = await getStoredRealmId()
      if (realmId) {
        try {
          // Auto-push vendor to QuickBooks if it doesn't have a QB ID
          let vendorQBId = vendor.quickbooksId
          if (!vendorQBId) {
            console.log(`[PO Create] Vendor "${vendor.displayName}" not synced to QB - pushing now...`)
            try {
              const syncedVendor = await pushVendorToQB(vendor.id)
              vendorQBId = syncedVendor.quickbooksId
              console.log(`[PO Create] Vendor synced to QB with ID: ${vendorQBId}`)
            } catch (vendorError) {
              console.error(`[PO Create] Failed to push vendor to QB:`, vendorError)
              return NextResponse.json({
                purchaseOrder,
                warning: `Purchase order created locally but vendor "${vendor.displayName}" could not be synced to QuickBooks. Error: ${vendorError instanceof Error ? vendorError.message : 'Unknown error'}`
              })
            }
          }

          // Get expense account - prefer vendor's account, then system default
          const expenseAccountId = await getVendorExpenseAccount(realmId, vendor.id)

          // Create QB items on-the-fly for lines without item references
          for (const line of purchaseOrder.lines) {
            const hasQBItem = line.quickbooksItem?.quickbooksId || line.itemRefId
            if (!hasQBItem && line.description) {
              try {
                console.log(`[PO Create] Creating QB item for line: "${line.description}"`)
                const { qbItemId, localItemId } = await createQBItemForPOLine(
                  realmId,
                  line.description,
                  line.unitPrice,
                  expenseAccountId
                )

                // Update the local line with the new item reference
                await prisma.purchaseOrderLine.update({
                  where: { id: line.id },
                  data: {
                    quickbooksItemId: localItemId,
                    itemRefId: qbItemId,
                    itemRefName: line.description
                  }
                })

                // Update the in-memory line object for QB conversion
                line.itemRefId = qbItemId
                line.itemRefName = line.description
              } catch (itemError) {
                console.error(`[PO Create] Failed to create QB item for "${line.description}":`, itemError)
                // Continue with other lines - PO will fail gracefully later
              }
            }
          }

          // Refresh the PO to get updated line data
          purchaseOrder = await prisma.purchaseOrder.findUnique({
            where: { id: purchaseOrder.id },
            include: {
              vendor: true,
              lines: { include: { quickbooksItem: true } },
              createdBy: true
            }
          }) as typeof purchaseOrder

          // Convert lines to QB format (pass expense account for lines without items)
          const qbLines: QBPOLine[] = purchaseOrder.lines.map(line => {
            // Use the QB item ID if available, otherwise just description
            const qbLine = localPOLineToQB({
              itemRefId: line.quickbooksItem?.quickbooksId || line.itemRefId,
              itemRefName: line.quickbooksItem?.name || line.itemRefName,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              amount: line.amount
            }, expenseAccountId || undefined)
            return qbLine
          })

          // Create QB PO
          const qbPO = localPOToQB(purchaseOrder, vendorQBId!, qbLines)
          qbPO.DocNumber = poNumber

          const createdQBPO = await createQBPurchaseOrder(realmId, qbPO)

          // Update local PO with QB data
          purchaseOrder = await prisma.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: {
              quickbooksId: createdQBPO.Id,
              syncToken: createdQBPO.SyncToken,
              docNumber: createdQBPO.DocNumber,
              totalAmount: createdQBPO.TotalAmt ?? subtotal,
              lastSyncedAt: new Date()
            },
            include: {
              vendor: true,
              lines: {
                include: {
                  quickbooksItem: true
                }
              },
              createdBy: true
            }
          })
        } catch (qbError) {
          console.error('Failed to push PO to QuickBooks:', qbError)
          // Parse QB error for user-friendly message
          let warningMessage = 'Purchase order created locally but failed to sync to QuickBooks.'
          const errorMsg = qbError instanceof Error ? qbError.message : 'Unknown error'

          if (errorMsg.includes('Select an account')) {
            warningMessage += ' One or more items do not have an expense account configured in QuickBooks. Please set up the expense account for these items in QuickBooks, then try syncing again.'
          } else if (errorMsg.includes('ItemRef')) {
            warningMessage += ' Line items must reference valid QuickBooks items. Please select items from the dropdown when creating line items.'
          } else {
            warningMessage += ` Error: ${errorMsg}`
          }

          return NextResponse.json({
            purchaseOrder,
            warning: warningMessage
          })
        }
      }
    }

    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}

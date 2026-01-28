import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SOStatus, InvoiceStatus, ProjectStatus } from '@prisma/client'
import { pushCustomerToQB, getStoredRealmId, fetchQBCustomer, deactivateQBCustomer } from '@/lib/quickbooks'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        contacts: true,
        leads: {
          include: {
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          }
        },
        projects: {
          include: {
            openings: {
              orderBy: { id: 'asc' },
              select: { id: true, name: true, price: true }
            }
          }
        },
        activities: {
          where: { leadId: null },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
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
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      country,
      status,
      source,
      notes
    } = body

    // Fetch existing customer to detect status change from Lead to Active
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { status: true, quickbooksId: true }
    })
    const previousStatus = existingCustomer?.status

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        companyName,
        contactName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        country,
        status,
        source,
        notes
      },
      include: {
        contacts: true,
        leads: true,
        projects: true
      }
    })

    // Sync changes to QuickBooks
    // Case 1: Transitioning from Lead to Active - create customer in QB
    if (previousStatus === 'Lead' && status === 'Active' && !existingCustomer?.quickbooksId) {
      try {
        const realmId = await getStoredRealmId()
        if (realmId) {
          await pushCustomerToQB(customer.id)
          console.log(`[QB Auto-Push] Pushed newly activated customer "${customer.companyName}" to QuickBooks`)
        }
      } catch (error) {
        console.error(`[QB Auto-Push] Failed to push customer "${customer.companyName}" to QB:`, error)
        // Don't fail the request - customer update was successful
      }
    }
    // Case 2: Customer already exists in QB - push all changes (name, contact, address, etc.)
    else if (existingCustomer?.quickbooksId) {
      try {
        const realmId = await getStoredRealmId()
        if (realmId) {
          await pushCustomerToQB(customer.id)
          console.log(`[QB Auto-Push] Synced customer "${customer.companyName}" changes to QuickBooks`)
        }
      } catch (error) {
        console.error(`[QB Auto-Push] Failed to sync customer "${customer.companyName}" to QB:`, error)
        // Don't fail the request - customer update was successful
      }
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error updating customer:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002' && 'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta && Array.isArray(error.meta.target) && error.meta.target.includes('email')) {
      return NextResponse.json(
        { error: 'Email address already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update customer' },
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
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Get the customer to check if it has a QuickBooks ID
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // If customer is synced to QuickBooks, deactivate in QB first
    let qbWarning: string | null = null
    if (customer.quickbooksId) {
      try {
        const realmId = await getStoredRealmId()
        if (realmId) {
          // Get current sync token from QB
          const qbCustomer = await fetchQBCustomer(realmId, customer.quickbooksId)
          await deactivateQBCustomer(realmId, customer.quickbooksId, qbCustomer.SyncToken!)
          console.log(`[QB Sync] Deactivated customer ${customer.companyName} in QuickBooks`)
        }
      } catch (qbError) {
        console.error(`[QB Sync] Failed to deactivate customer ${customer.companyName} in QB:`, qbError)
        qbWarning = `Customer archived locally but QuickBooks deactivation failed: ${qbError instanceof Error ? qbError.message : 'Unknown error'}`
      }
    }

    // Archive related records instead of deleting (preserves historical data)

    // Archive sales orders (set to CANCELLED)
    await prisma.salesOrder.updateMany({
      where: { customerId },
      data: { status: SOStatus.CANCELLED }
    })

    // Archive invoices (set to VOIDED)
    await prisma.invoice.updateMany({
      where: { customerId },
      data: { status: InvoiceStatus.VOIDED }
    })

    // Archive projects (set to ARCHIVE)
    await prisma.project.updateMany({
      where: { customerId },
      data: { status: ProjectStatus.ARCHIVE }
    })

    // Archive the customer (set status to Archived)
    await prisma.customer.update({
      where: { id: customerId },
      data: { status: 'Archived' }
    })

    return NextResponse.json({
      message: 'Customer archived successfully',
      warning: qbWarning
    })
  } catch (error) {
    console.error('Error archiving customer:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to archive customer' },
      { status: 500 }
    )
  }
}
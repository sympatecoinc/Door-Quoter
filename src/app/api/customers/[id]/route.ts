import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Delete related records in order (respecting foreign key constraints)
    // First, get all projects for this customer to delete their nested records
    const projects = await prisma.project.findMany({
      where: { customerId },
      select: { id: true }
    })
    const projectIds = projects.map(p => p.id)

    // Delete project-related records
    if (projectIds.length > 0) {
      const openings = await prisma.opening.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true }
      })
      const openingIds = openings.map(o => o.id)

      if (openingIds.length > 0) {
        await prisma.panel.deleteMany({
          where: { openingId: { in: openingIds } }
        })
      }

      // Delete openings
      await prisma.opening.deleteMany({
        where: { projectId: { in: projectIds } }
      })

      // Delete project notes
      await prisma.projectNote.deleteMany({
        where: { projectId: { in: projectIds } }
      })

      // Delete quote attachments
      await prisma.quoteAttachment.deleteMany({
        where: { projectId: { in: projectIds } }
      })

      // Delete project status history
      await prisma.projectStatusHistory.deleteMany({
        where: { projectId: { in: projectIds } }
      })

      // Delete project contacts
      await prisma.projectContact.deleteMany({
        where: { projectId: { in: projectIds } }
      })

      // Delete projects
      await prisma.project.deleteMany({
        where: { customerId }
      })
    }

    // Finally delete the customer
    // (Contact, Activity, CustomerFile have onDelete: Cascade so they'll be auto-deleted)
    // (Lead has onDelete: SetNull so it won't block deletion)
    await prisma.customer.delete({
      where: { id: customerId }
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
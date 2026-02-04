import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Parse status filter - support comma-separated values for multiple statuses
    const statusFilters = status ? status.split(',').filter(Boolean) : []

    const where = {
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } }
        ]
      }),
      ...(statusFilters.length > 0 && {
        status: { in: statusFilters }
      })
    }

    // Lead phase statuses (pre-acceptance) - projects in quoting phase
    const LEAD_STATUSES = ['STAGING', 'APPROVED', 'REVISE', 'QUOTE_SENT']
    // Project phase statuses (post-acceptance) - won projects
    const PROJECT_STATUSES = ['QUOTE_ACCEPTED', 'ACTIVE', 'COMPLETE']

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          contacts: true,
          projects: {
            select: { id: true, name: true, status: true }
          },
          accountOwner: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.customer.count({ where })
    ])

    // Transform customers to include leadCount and projectCount based on project status
    const customersWithCounts = customers.map(customer => {
      const leadCount = customer.projects.filter(p => LEAD_STATUSES.includes(p.status)).length
      const projectCount = customer.projects.filter(p => PROJECT_STATUSES.includes(p.status)).length
      return {
        ...customer,
        leadCount,
        projectCount,
        // Keep projects array for backward compatibility but also add leads array for display
        leads: customer.projects.filter(p => LEAD_STATUSES.includes(p.status))
      }
    })

    return NextResponse.json({
      customers: customersWithCounts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    const customer = await prisma.customer.create({
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

    // If contactName provided, create initial primary contact
    if (contactName && contactName.trim()) {
      const nameParts = contactName.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName

      await prisma.contact.create({
        data: {
          customerId: customer.id,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          isPrimary: true
        }
      })
    }

    // Fetch updated customer with the newly created contact
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        contacts: true,
        leads: true,
        projects: true
      }
    })

    return NextResponse.json(updatedCustomer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002' && 'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta && Array.isArray(error.meta.target) && error.meta.target.includes('email')) {
      return NextResponse.json(
        { error: 'Email address already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
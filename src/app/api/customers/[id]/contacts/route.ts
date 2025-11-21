import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/customers/[id]/contacts - Get all contacts for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Fetch all contacts for this customer, ordered by isPrimary DESC, then firstName
    const contacts = await prisma.contact.findMany({
      where: { customerId },
      orderBy: [
        { isPrimary: 'desc' },
        { firstName: 'asc' }
      ]
    })

    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

// POST /api/customers/[id]/contacts - Create a new contact
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, email, phone, title, isPrimary } = body

    // Validation
    if (!firstName || firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      )
    }

    if (!lastName || lastName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      )
    }

    if (firstName.length > 100) {
      return NextResponse.json(
        { error: 'First name must be 100 characters or less' },
        { status: 400 }
      )
    }

    if (lastName.length > 100) {
      return NextResponse.json(
        { error: 'Last name must be 100 characters or less' },
        { status: 400 }
      )
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    if (phone && (phone.length < 10 || phone.length > 20)) {
      return NextResponse.json(
        { error: 'Phone must be between 10 and 20 characters' },
        { status: 400 }
      )
    }

    if (title && title.length > 100) {
      return NextResponse.json(
        { error: 'Title must be 100 characters or less' },
        { status: 400 }
      )
    }

    // Check if this is the first contact for the customer
    const existingContactsCount = await prisma.contact.count({
      where: { customerId }
    })

    // Determine if this contact should be primary
    // If it's the first contact, automatically make it primary
    const shouldBePrimary = existingContactsCount === 0 ? true : (isPrimary || false)

    // If setting as primary, unset all other contacts' isPrimary
    if (shouldBePrimary) {
      await prisma.contact.updateMany({
        where: { customerId },
        data: { isPrimary: false }
      })
    }

    // Create the contact
    const contact = await prisma.contact.create({
      data: {
        customerId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        title: title?.trim() || null,
        isPrimary: shouldBePrimary
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating contact:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}

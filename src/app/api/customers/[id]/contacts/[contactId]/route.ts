import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/customers/[id]/contacts/[contactId] - Get a specific contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const contactId = parseInt(params.contactId)

    if (isNaN(customerId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or contact ID' },
        { status: 400 }
      )
    }

    // Fetch contact and verify it belongs to the customer
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        customerId
      }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id]/contacts/[contactId] - Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const contactId = parseInt(params.contactId)

    if (isNaN(customerId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or contact ID' },
        { status: 400 }
      )
    }

    // Verify contact exists and belongs to the customer
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        customerId
      }
    })

    if (!existingContact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, email, phone, title, isPrimary } = body

    // Validation
    if (firstName !== undefined && (!firstName || firstName.trim().length === 0)) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      )
    }

    if (lastName !== undefined && (!lastName || lastName.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      )
    }

    if (firstName && firstName.length > 100) {
      return NextResponse.json(
        { error: 'First name must be 100 characters or less' },
        { status: 400 }
      )
    }

    if (lastName && lastName.length > 100) {
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

    // If setting as primary, unset all other contacts' isPrimary
    if (isPrimary && !existingContact.isPrimary) {
      await prisma.contact.updateMany({
        where: {
          customerId,
          id: { not: contactId }
        },
        data: { isPrimary: false }
      })
    }

    // Build update data object with only provided fields
    const updateData: any = {}
    if (firstName !== undefined) updateData.firstName = firstName.trim()
    if (lastName !== undefined) updateData.lastName = lastName.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (phone !== undefined) updateData.phone = phone?.trim() || null
    if (title !== undefined) updateData.title = title?.trim() || null
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary

    // Update the contact
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData
    })

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id]/contacts/[contactId] - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; contactId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const contactId = parseInt(params.contactId)

    if (isNaN(customerId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or contact ID' },
        { status: 400 }
      )
    }

    // Verify contact exists and belongs to the customer
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        customerId
      }
    })

    if (!existingContact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Check how many contacts this customer has
    const contactCount = await prisma.contact.count({
      where: { customerId }
    })

    // Cannot delete the last contact
    if (contactCount === 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last contact. Each customer must have at least one contact.' },
        { status: 400 }
      )
    }

    // If deleting primary contact, set another contact as primary
    if (existingContact.isPrimary) {
      // Find the oldest non-primary contact to promote
      const nextPrimary = await prisma.contact.findFirst({
        where: {
          customerId,
          id: { not: contactId }
        },
        orderBy: { createdAt: 'asc' }
      })

      if (nextPrimary) {
        await prisma.contact.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true }
        })
      }
    }

    // Delete the contact
    await prisma.contact.delete({
      where: { id: contactId }
    })

    return NextResponse.json({ message: 'Contact deleted successfully' })
  } catch (error) {
    console.error('Error deleting contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

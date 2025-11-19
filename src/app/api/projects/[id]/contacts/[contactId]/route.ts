import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/projects/[id]/contacts/[contactId] - Update a project contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    const contactId = parseInt(resolvedParams.contactId)

    if (isNaN(projectId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid IDs' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { contactType, companyName, name, email, phone, notes } = body

    // Validate required fields
    if (!contactType || !name) {
      return NextResponse.json(
        { error: 'Contact type and name are required' },
        { status: 400 }
      )
    }

    // Validate contact type
    if (!['ARCHITECT', 'GENERAL_CONTRACTOR', 'OTHER'].includes(contactType)) {
      return NextResponse.json(
        { error: 'Invalid contact type' },
        { status: 400 }
      )
    }

    // Verify contact exists and belongs to this project
    const existingContact = await prisma.projectContact.findUnique({
      where: { id: contactId }
    })

    if (!existingContact || existingContact.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const contact = await prisma.projectContact.update({
      where: { id: contactId },
      data: {
        contactType,
        companyName: companyName || null,
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null
      }
    })

    return NextResponse.json(contact)
  } catch (error) {
    console.error('Error updating project contact:', error)
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/contacts/[contactId] - Delete a project contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    const contactId = parseInt(resolvedParams.contactId)

    if (isNaN(projectId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid IDs' },
        { status: 400 }
      )
    }

    // Verify contact exists and belongs to this project
    const existingContact = await prisma.projectContact.findUnique({
      where: { id: contactId }
    })

    if (!existingContact || existingContact.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    await prisma.projectContact.delete({
      where: { id: contactId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

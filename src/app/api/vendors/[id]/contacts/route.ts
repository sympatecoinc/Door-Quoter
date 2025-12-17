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
      where: { id: vendorId }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      )
    }

    const contacts = await prisma.vendorContact.findMany({
      where: { vendorId },
      orderBy: [
        { isPrimary: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching vendor contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vendor contacts' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const body = await request.json()
    const { name, title, email, phone, mobile, isPrimary, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Contact name is required' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await prisma.vendorContact.updateMany({
        where: { vendorId, isPrimary: true },
        data: { isPrimary: false }
      })
    }

    const contact = await prisma.vendorContact.create({
      data: {
        vendorId,
        name: name.trim(),
        title: title?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        mobile: mobile?.trim() || null,
        isPrimary: isPrimary ?? false,
        notes: notes?.trim() || null
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor contact:', error)
    return NextResponse.json(
      { error: 'Failed to create vendor contact' },
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
    const { searchParams } = new URL(request.url)
    const contactId = parseInt(searchParams.get('contactId') || '')

    if (isNaN(vendorId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid vendor or contact ID' },
        { status: 400 }
      )
    }

    const contact = await prisma.vendorContact.findFirst({
      where: { id: contactId, vendorId }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, title, email, phone, mobile, isPrimary, notes } = body

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json(
        { error: 'Contact name is required' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary && !contact.isPrimary) {
      await prisma.vendorContact.updateMany({
        where: { vendorId, isPrimary: true },
        data: { isPrimary: false }
      })
    }

    const updatedContact = await prisma.vendorContact.update({
      where: { id: contactId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(mobile !== undefined && { mobile: mobile?.trim() || null }),
        ...(isPrimary !== undefined && { isPrimary }),
        ...(notes !== undefined && { notes: notes?.trim() || null })
      }
    })

    return NextResponse.json(updatedContact)
  } catch (error) {
    console.error('Error updating vendor contact:', error)
    return NextResponse.json(
      { error: 'Failed to update vendor contact' },
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
    const { searchParams } = new URL(request.url)
    const contactId = parseInt(searchParams.get('contactId') || '')

    if (isNaN(vendorId) || isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid vendor or contact ID' },
        { status: 400 }
      )
    }

    const contact = await prisma.vendorContact.findFirst({
      where: { id: contactId, vendorId }
    })

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    await prisma.vendorContact.delete({
      where: { id: contactId }
    })

    return NextResponse.json({ message: 'Contact deleted successfully' })
  } catch (error) {
    console.error('Error deleting vendor contact:', error)
    return NextResponse.json(
      { error: 'Failed to delete vendor contact' },
      { status: 500 }
    )
  }
}

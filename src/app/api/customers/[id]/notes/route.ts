import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // For now, we'll create a simple notes structure using the activities table
    // with type 'Note' to store customer notes
    const notes = await prisma.activity.findMany({
      where: {
        customerId: customerId,
        type: 'Note',
        leadId: null
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transform activities to note format
    const transformedNotes = notes.map(note => ({
      id: note.id,
      customerId: note.customerId,
      content: note.description || note.subject,
      author: 'Current User', // TODO: Get from auth context
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }))

    return NextResponse.json(transformedNotes)
  } catch (error) {
    console.error('Error fetching customer notes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer notes' },
      { status: 500 }
    )
  }
}

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

    const body = await request.json()
    const { content, author } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Note content is required' },
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

    // Create note as an activity
    const note = await prisma.activity.create({
      data: {
        customerId: customerId,
        type: 'Note',
        subject: `Note - ${new Date().toLocaleDateString()}`,
        description: content,
        completed: true
      }
    })

    // Transform to note format
    const transformedNote = {
      id: note.id,
      customerId: note.customerId,
      content: note.description || note.subject,
      author: author || 'Current User',
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString()
    }

    return NextResponse.json(transformedNote, { status: 201 })
  } catch (error) {
    console.error('Error creating customer note:', error)
    return NextResponse.json(
      { error: 'Failed to create customer note' },
      { status: 500 }
    )
  }
}
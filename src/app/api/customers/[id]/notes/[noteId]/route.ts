import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const noteId = parseInt(params.noteId)

    if (isNaN(customerId) || isNaN(noteId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or note ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    // Update the activity that represents this note
    const updatedNote = await prisma.activity.update({
      where: {
        id: noteId,
        customerId: customerId,
        type: 'Note'
      },
      data: {
        description: content,
        updatedAt: new Date()
      }
    })

    // Transform to note format
    const transformedNote = {
      id: updatedNote.id,
      customerId: updatedNote.customerId,
      content: updatedNote.description || updatedNote.subject,
      author: 'Current User', // TODO: Get from auth context
      createdAt: updatedNote.createdAt.toISOString(),
      updatedAt: updatedNote.updatedAt.toISOString()
    }

    return NextResponse.json(transformedNote)
  } catch (error) {
    console.error('Error updating customer note:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update customer note' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  try {
    const customerId = parseInt(params.id)
    const noteId = parseInt(params.noteId)

    if (isNaN(customerId) || isNaN(noteId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID or note ID' },
        { status: 400 }
      )
    }

    // Delete the activity that represents this note
    await prisma.activity.delete({
      where: {
        id: noteId,
        customerId: customerId,
        type: 'Note'
      }
    })

    return NextResponse.json({ message: 'Note deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer note:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete customer note' },
      { status: 500 }
    )
  }
}
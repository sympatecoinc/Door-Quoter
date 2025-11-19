import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/projects/[id]/notes/[noteId] - Update a project note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    const noteId = parseInt(resolvedParams.noteId)

    if (isNaN(projectId) || isNaN(noteId)) {
      return NextResponse.json(
        { error: 'Invalid IDs' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Verify note exists and belongs to this project
    const existingNote = await prisma.projectNote.findUnique({
      where: { id: noteId }
    })

    if (!existingNote || existingNote.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    const note = await prisma.projectNote.update({
      where: { id: noteId },
      data: {
        content: content.trim()
      }
    })

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error updating project note:', error)
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/notes/[noteId] - Delete a project note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)
    const noteId = parseInt(resolvedParams.noteId)

    if (isNaN(projectId) || isNaN(noteId)) {
      return NextResponse.json(
        { error: 'Invalid IDs' },
        { status: 400 }
      )
    }

    // Verify note exists and belongs to this project
    const existingNote = await prisma.projectNote.findUnique({
      where: { id: noteId }
    })

    if (!existingNote || existingNote.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    await prisma.projectNote.delete({
      where: { id: noteId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project note:', error)
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    )
  }
}

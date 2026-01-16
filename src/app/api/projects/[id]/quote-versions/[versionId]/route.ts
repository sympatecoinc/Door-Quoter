import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch a single quote version
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params
    const projectId = parseInt(id)
    const versionIdNum = parseInt(versionId)

    const version = await prisma.quoteVersion.findFirst({
      where: {
        id: versionIdNum,
        projectId,
      },
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Quote version not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Error fetching quote version:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote version' },
      { status: 500 }
    )
  }
}

// PATCH - Update quote version (e.g., mark as sent)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params
    const projectId = parseInt(id)
    const versionIdNum = parseInt(versionId)
    const body = await request.json()

    // Verify the version exists and belongs to this project
    const existingVersion = await prisma.quoteVersion.findFirst({
      where: {
        id: versionIdNum,
        projectId,
      },
    })

    if (!existingVersion) {
      return NextResponse.json(
        { error: 'Quote version not found' },
        { status: 404 }
      )
    }

    // Only allow updating sentAt and sentTo
    const updateData: any = {}
    if (body.sentAt !== undefined) {
      updateData.sentAt = body.sentAt ? new Date(body.sentAt) : null
    }
    if (body.sentTo !== undefined) {
      updateData.sentTo = body.sentTo || null
    }
    if (body.changeNotes !== undefined) {
      updateData.changeNotes = body.changeNotes || null
    }

    const version = await prisma.quoteVersion.update({
      where: { id: versionIdNum },
      data: updateData,
    })

    return NextResponse.json({ version })
  } catch (error) {
    console.error('Error updating quote version:', error)
    return NextResponse.json(
      { error: 'Failed to update quote version' },
      { status: 500 }
    )
  }
}

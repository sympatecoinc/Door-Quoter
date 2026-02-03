import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { folderId } = await params

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()
    const response = await client.getListsInFolder(folderId)

    return NextResponse.json({
      lists: response.lists,
      folderId,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp lists:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch lists' },
      { status: 500 }
    )
  }
}

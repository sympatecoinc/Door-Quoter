import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params

    if (!spaceId) {
      return NextResponse.json(
        { error: 'Space ID is required' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()

    // Fetch both folders and folderless lists in parallel
    const [foldersResponse, folderlessListsResponse] = await Promise.all([
      client.getFolders(spaceId),
      client.getFolderlessLists(spaceId)
    ])

    return NextResponse.json({
      folders: foldersResponse.folders,
      folderlessLists: folderlessListsResponse.lists,
      spaceId,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp folders:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch folders' },
      { status: 500 }
    )
  }
}

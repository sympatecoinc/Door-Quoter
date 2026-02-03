import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      )
    }

    const client = getClickUpClient()
    const list = await client.getList(listId)

    return NextResponse.json({
      list,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp list:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch list' },
      { status: 500 }
    )
  }
}

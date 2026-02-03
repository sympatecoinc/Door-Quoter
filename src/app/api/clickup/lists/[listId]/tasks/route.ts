import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const { searchParams } = new URL(request.url)

    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      )
    }

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '0')
    const includeClosed = searchParams.get('includeClosed') !== 'false'
    const subtasks = searchParams.get('subtasks') !== 'false'
    const orderBy = searchParams.get('orderBy') as 'id' | 'created' | 'updated' | 'due_date' | undefined
    const reverse = searchParams.get('reverse') === 'true'

    const client = getClickUpClient()
    const response = await client.getTasks(listId, {
      page,
      includeClosed,
      subtasks,
      orderBy,
      reverse
    })

    return NextResponse.json({
      tasks: response.tasks,
      page,
      hasMore: response.tasks.length === 100, // ClickUp returns max 100 per page
      listId,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp tasks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

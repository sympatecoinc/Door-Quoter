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
    const response = await client.getCustomFields(listId)

    return NextResponse.json({
      fields: response.fields,
      listId,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp custom fields:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch custom fields' },
      { status: 500 }
    )
  }
}

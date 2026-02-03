import { NextRequest, NextResponse } from 'next/server'
import { getClickUpClient } from '@/lib/clickup-client'

export async function GET(request: NextRequest) {
  try {
    const teamId = process.env.CLICKUP_TEAM_ID

    if (!teamId) {
      return NextResponse.json(
        { error: 'CLICKUP_TEAM_ID not configured' },
        { status: 500 }
      )
    }

    const client = getClickUpClient()
    const response = await client.getSpaces(teamId)

    return NextResponse.json({
      spaces: response.spaces,
      teamId,
      rateLimit: client.getRateLimitInfo()
    })
  } catch (error) {
    console.error('Error fetching ClickUp spaces:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch spaces' },
      { status: 500 }
    )
  }
}

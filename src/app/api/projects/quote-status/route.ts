import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')

    if (!idsParam) {
      return NextResponse.json({ projectsWithQuotes: [] })
    }

    const projectIds = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))

    if (projectIds.length === 0) {
      return NextResponse.json({ projectsWithQuotes: [] })
    }

    // Get all projects that have at least one quote version
    const projectsWithQuotes = await prisma.quoteVersion.groupBy({
      by: ['projectId'],
      where: {
        projectId: {
          in: projectIds
        }
      }
    })

    return NextResponse.json({
      projectsWithQuotes: projectsWithQuotes.map(p => p.projectId)
    })
  } catch (error) {
    console.error('Error fetching quote status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote status' },
      { status: 500 }
    )
  }
}

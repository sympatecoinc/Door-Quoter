import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { createSalesOrderFromProject } from '@/lib/sales-order'

// POST - Create a sales order from a project quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get session for createdBy tracking
    const sessionToken = await getSessionToken()
    let userId: number | null = null
    if (sessionToken) {
      const session = await getSessionWithUser(sessionToken)
      if (session?.user) {
        userId = session.user.id
      }
    }

    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    // Check project status first
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if project status allows sales order creation
    const allowedStatuses = ['QUOTE_ACCEPTED', 'ACTIVE']
    if (!allowedStatuses.includes(project.status)) {
      return NextResponse.json(
        { error: `Cannot create sales order from project with status: ${project.status}. Project must be Quote Accepted or Active.` },
        { status: 400 }
      )
    }

    // Use shared utility to create sales order
    const result = await createSalesOrderFromProject(prisma, {
      projectId,
      userId
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ salesOrder: result.salesOrder })
  } catch (error) {
    console.error('Error creating sales order from project:', error)
    return NextResponse.json(
      { error: 'Failed to create sales order' },
      { status: 500 }
    )
  }
}

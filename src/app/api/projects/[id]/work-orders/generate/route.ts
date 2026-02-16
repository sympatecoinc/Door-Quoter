import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { generateWorkOrdersFromProject } from '@/lib/work-order-generator'
import { bulkDeductInventory } from '@/lib/sales-order-parts'

// POST - Generate work orders from project cut lists
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    // Get session for tracking
    const sessionToken = await getSessionToken()
    let userId: number | null = null
    if (sessionToken) {
      const session = await getSessionWithUser(sessionToken)
      if (session?.user) {
        userId = session.user.id
      }
    }

    // Parse body for optional batch size override
    let batchSize: number | null = null
    try {
      const body = await request.json()
      if (body.batchSize !== undefined) {
        batchSize = body.batchSize
      }
    } catch {
      // No body provided, use defaults
    }

    // Verify project exists and is in appropriate status
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
        batchSize: true,
        _count: {
          select: {
            openings: true,
            workOrders: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check project has openings
    if (project._count.openings === 0) {
      return NextResponse.json(
        { error: 'Project has no openings to generate work orders from' },
        { status: 400 }
      )
    }

    // Gate: require a confirmed sales order before generating work orders
    const confirmedSO = await prisma.salesOrder.findFirst({
      where: { projectId, status: 'CONFIRMED' }
    })

    if (!confirmedSO) {
      return NextResponse.json(
        { error: 'Cannot generate work orders: project must have a confirmed sales order' },
        { status: 400 }
      )
    }

    // Generate work orders
    const result = await generateWorkOrdersFromProject({
      projectId,
      userId,
      batchSize: batchSize ?? project.batchSize
    })

    // Deduct inventory (RESERVED → PICKED) after successful generation
    let inventoryDeducted = false
    let deductionSummary: { deductedCount: number; skippedCount: number } | null = null

    if (result.created > 0) {
      try {
        deductionSummary = await bulkDeductInventory(confirmedSO.id, userId ?? undefined)
        inventoryDeducted = true
      } catch (deductionError) {
        console.error('Inventory deduction failed (work orders still created):', deductionError)
      }
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name
      },
      workOrders: result.workOrders,
      summary: {
        created: result.created,
        skipped: result.skipped,
        total: result.workOrders.length
      },
      inventoryDeducted,
      deductionSummary
    })
  } catch (error) {
    console.error('Error generating work orders:', error)
    return NextResponse.json(
      { error: 'Failed to generate work orders' },
      { status: 500 }
    )
  }
}

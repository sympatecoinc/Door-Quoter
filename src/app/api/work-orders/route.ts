import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken } from '@/lib/auth'
import { getSessionWithUser } from '@/lib/db-session'
import { WorkOrderStage } from '@prisma/client'

// GET - List all work orders with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const projectId = searchParams.get('projectId') || ''
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { project: { customer: { companyName: { contains: search, mode: 'insensitive' } } } }
      ]
    }

    if (stage) {
      where.currentStage = stage as WorkOrderStage
    }

    if (projectId) {
      where.projectId = parseInt(projectId)
    }

    // Get total count for pagination
    const total = await prisma.workOrder.count({ where })

    // Get work orders
    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            customer: {
              select: {
                id: true,
                companyName: true
              }
            },
            shipDate: true,
            dueDate: true
          }
        },
        items: true,
        stageHistory: {
          orderBy: { enteredAt: 'desc' },
          take: 1,
          include: {
            enteredBy: {
              select: { id: true, name: true }
            }
          }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit
    })

    return NextResponse.json({
      workOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching work orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch work orders' },
      { status: 500 }
    )
  }
}

// POST - Create a new work order manually
export async function POST(request: NextRequest) {
  try {
    // Get session for tracking
    const sessionToken = await getSessionToken()
    let userId: number | null = null
    if (sessionToken) {
      const session = await getSessionWithUser(sessionToken)
      if (session?.user) {
        userId = session.user.id
      }
    }

    const body = await request.json()
    const {
      projectId,
      batchNumber,
      priority,
      notes,
      items
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }

    if (!batchNumber) {
      return NextResponse.json({ error: 'Batch number is required' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if work order with same batch already exists
    const existing = await prisma.workOrder.findFirst({
      where: { projectId, batchNumber }
    })

    if (existing) {
      return NextResponse.json(
        { error: `Work order for batch ${batchNumber} already exists` },
        { status: 409 }
      )
    }

    // Create work order with initial stage history
    const workOrder = await prisma.workOrder.create({
      data: {
        projectId,
        batchNumber,
        priority: priority || 0,
        notes: notes || null,
        currentStage: 'STAGED',
        stageHistory: {
          create: {
            stage: 'STAGED',
            enteredById: userId
          }
        },
        items: items ? {
          create: items.map((item: any) => ({
            partNumber: item.partNumber,
            partName: item.partName,
            partType: item.partType || null,
            quantity: item.quantity,
            openingName: item.openingName || null,
            productName: item.productName || null,
            metadata: item.metadata || null
          }))
        } : undefined
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            customer: {
              select: {
                id: true,
                companyName: true
              }
            }
          }
        },
        items: true,
        stageHistory: {
          orderBy: { enteredAt: 'desc' },
          include: {
            enteredBy: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    return NextResponse.json({ workOrder })
  } catch (error) {
    console.error('Error creating work order:', error)
    return NextResponse.json(
      { error: 'Failed to create work order' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const stage = searchParams.get('stage')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { customer: { companyName: { contains: search, mode: 'insensitive' as const } } }
        ]
      }),
      ...(stage && { stage }),
      ...(customerId && { customerId: parseInt(customerId) })
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          customer: {
            select: { id: true, companyName: true, contactName: true }
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.lead.count({ where })
    ])

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerId,
      title,
      description,
      value,
      probability,
      stage,
      source,
      expectedCloseDate
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const lead = await prisma.lead.create({
      data: {
        customerId: customerId ? parseInt(customerId) : null,
        title,
        description,
        value: value ? parseFloat(value) : null,
        probability: probability ? parseInt(probability) : 50,
        stage: stage || 'New',
        source,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null
      },
      include: {
        customer: {
          select: { id: true, companyName: true, contactName: true }
        },
        activities: true
      }
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json(
      { error: 'Failed to create lead' },
      { status: 500 }
    )
  }
}
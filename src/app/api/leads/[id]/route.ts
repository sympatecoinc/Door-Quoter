import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadId = parseInt(id)

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      )
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        customer: {
          include: {
            contacts: true
          }
        },
        activities: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadId = parseInt(id)

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      customerId,
      title,
      description,
      value,
      probability,
      stage,
      source,
      expectedCloseDate,
      actualCloseDate,
      lostReason
    } = body

    const updateData = {
      customerId: customerId ? parseInt(customerId) : null,
      title,
      description,
      value: value ? parseFloat(value) : null,
      probability: probability ? parseInt(probability) : undefined,
      stage,
      source,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      actualCloseDate: actualCloseDate ? new Date(actualCloseDate) : null,
      lostReason: stage === 'Lost' ? lostReason : null
    }

    // If marking as Won, set actual close date to now if not provided
    if (stage === 'Won' && !actualCloseDate) {
      updateData.actualCloseDate = new Date()
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        customer: {
          select: { id: true, companyName: true, contactName: true }
        },
        activities: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error updating lead:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadId = parseInt(id)

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Invalid lead ID' },
        { status: 400 }
      )
    }

    await prisma.lead.delete({
      where: { id: leadId }
    })

    return NextResponse.json({ message: 'Lead deleted successfully' })
  } catch (error) {
    console.error('Error deleting lead:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    )
  }
}
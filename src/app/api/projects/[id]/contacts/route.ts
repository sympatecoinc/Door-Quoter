import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/contacts - Get all contacts for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    const contacts = await prisma.projectContact.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(contacts)
  } catch (error) {
    console.error('Error fetching project contacts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/contacts - Create a new project contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const projectId = parseInt(resolvedParams.id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { contactType, companyName, name, email, phone, notes } = body

    // Validate required fields
    if (!contactType || !name) {
      return NextResponse.json(
        { error: 'Contact type and name are required' },
        { status: 400 }
      )
    }

    // Validate contact type
    if (!['ARCHITECT', 'GENERAL_CONTRACTOR', 'OTHER'].includes(contactType)) {
      return NextResponse.json(
        { error: 'Invalid contact type' },
        { status: 400 }
      )
    }

    const contact = await prisma.projectContact.create({
      data: {
        projectId,
        contactType,
        companyName: companyName || null,
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null
      }
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('Error creating project contact:', error)
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}

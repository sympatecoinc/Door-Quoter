import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked } from '@/lib/project-status'
import { createProjectRevision } from '@/lib/project-revisions'

// GET: List all versions of a project (all revisions in the same family)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const projectId = parseInt(id)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Get the current project to find the root
    const currentProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, parentProjectId: true }
    })

    if (!currentProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Find the root project (traverse up the parent chain)
    let rootId = currentProject.id
    let parentId = currentProject.parentProjectId

    while (parentId) {
      const parent = await prisma.project.findUnique({
        where: { id: parentId },
        select: { id: true, parentProjectId: true }
      })
      if (!parent) break
      rootId = parent.id
      parentId = parent.parentProjectId
    }

    // Get all projects in this revision family (root + all descendants)
    const allVersions = await prisma.project.findMany({
      where: {
        OR: [
          { id: rootId },
          { parentProjectId: rootId }
        ]
      },
      select: {
        id: true,
        name: true,
        version: true,
        status: true,
        isCurrentVersion: true,
        createdAt: true,
        _count: {
          select: { openings: true }
        }
      },
      orderBy: { version: 'asc' }
    })

    return NextResponse.json({
      currentProjectId: projectId,
      rootProjectId: rootId,
      versions: allVersions
    })
  } catch (error) {
    console.error('Error fetching project versions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project versions' },
      { status: 500 }
    )
  }
}

// POST: Create a new revision (deep copy of project)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sourceProjectId = parseInt(id)

    if (isNaN(sourceProjectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Get the source project to verify it exists and check status
    const sourceProject = await prisma.project.findUnique({
      where: { id: sourceProjectId },
      select: { id: true, status: true }
    })

    if (!sourceProject) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Verify the project is in a locked status
    if (!isProjectLocked(sourceProject.status)) {
      return NextResponse.json(
        { error: 'Can only create revisions from locked projects (Quote Sent, Quote Accepted, Active, or Complete status)' },
        { status: 400 }
      )
    }

    // Use shared utility to create the revision within a transaction
    const result = await prisma.$transaction(async (tx) => {
      return await createProjectRevision(tx, {
        sourceProjectId,
        changedBy: 'System (Revision Created)'
      })
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Fetch the complete new revision with counts
    const revision = await prisma.project.findUnique({
      where: { id: result.revision.id },
      include: {
        _count: {
          select: { openings: true }
        }
      }
    })

    return NextResponse.json({
      message: result.message,
      revision,
      sourceProjectId: result.sourceProjectId,
      rootProjectId: result.rootProjectId
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating revision:', error)
    return NextResponse.json(
      { error: 'Failed to create revision' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        openings: true,
        _count: {
          select: {
            openings: true,
            boms: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, status = 'Draft', dueDate, multiplier, taxRate } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    const projectData: any = { name, status }
    if (dueDate) {
      projectData.dueDate = new Date(dueDate)
    }
    if (multiplier !== undefined) {
      projectData.multiplier = multiplier
    }
    if (taxRate !== undefined) {
      projectData.taxRate = taxRate
    }

    const project = await prisma.project.create({
      data: projectData
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
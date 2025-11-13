import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        openings: {
          orderBy: { id: 'asc' },
          include: {
            panels: {
              include: {
                componentInstance: {
                  include: {
                    product: {
                      include: {
                        productBOMs: true // Include BOMs for category-specific markup calculation
                      }
                    }
                  }
                }
              }
            }
          }
        },
        pricingMode: true, // Include pricing mode for sale price calculation
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
    const { name, status = ProjectStatus.STAGING, dueDate, pricingModeId, customerId } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required - all projects must be associated with a customer' },
        { status: 400 }
      )
    }

    // Validate status if provided
    if (status && !Object.values(ProjectStatus).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid project status' },
        { status: 400 }
      )
    }

    const projectData: any = { name, status, customerId }
    if (dueDate) {
      projectData.dueDate = new Date(dueDate)
    }
    if (pricingModeId !== undefined) {
      projectData.pricingModeId = pricingModeId
    }

    // Create project and initial status history record in a transaction
    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: projectData,
        include: {
          openings: {
            orderBy: { id: 'asc' },
            select: { id: true, name: true, price: true }
          }
        }
      })

      // Create initial status history record
      await tx.projectStatusHistory.create({
        data: {
          projectId: newProject.id,
          status: newProject.status,
          notes: 'Project created'
        }
      })

      return newProject
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
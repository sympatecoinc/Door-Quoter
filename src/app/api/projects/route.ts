import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const { name, status = 'Draft', dueDate, pricingModeId, customerId } = await request.json()

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

    const projectData: any = { name, status, customerId }
    if (dueDate) {
      projectData.dueDate = new Date(dueDate)
    }
    if (pricingModeId !== undefined) {
      projectData.pricingModeId = pricingModeId
    }

    const project = await prisma.project.create({
      data: projectData,
      include: {
        openings: {
          orderBy: { id: 'asc' },
          select: { id: true, name: true, price: true }
        }
      }
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
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'
import { ensureProjectPricingMode } from '@/lib/pricing-mode'

export async function GET() {
  try {
    // Only return current versions (not historical revisions)
    const projects = await prisma.project.findMany({
      where: {
        isCurrentVersion: true
      },
      include: {
        openings: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            otherCost: true,
            hybridRemainingCost: true
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
    const {
      name,
      status = ProjectStatus.STAGING,
      dueDate,
      pricingModeId,
      customerId,
      // Prospect fields for leads without a customer
      prospectCompanyName,
      prospectPhone,
      prospectAddress,
      prospectCity,
      prospectState,
      prospectZipCode
    } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // Require either customerId OR prospectCompanyName (for leads without customer)
    if (!customerId && !prospectCompanyName) {
      return NextResponse.json(
        { error: 'Either Customer ID or Prospect Company Name is required' },
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

    // Ensure pricing mode is set (apply default if not provided)
    const finalPricingModeId = await ensureProjectPricingMode(pricingModeId, prisma)

    const projectData: any = {
      name,
      status,
      pricingModeId: finalPricingModeId
    }

    // Add customerId if provided
    if (customerId) {
      projectData.customerId = customerId
    }

    // Add prospect fields if provided (for leads without customer)
    if (prospectCompanyName) {
      projectData.prospectCompanyName = prospectCompanyName
    }
    if (prospectPhone) {
      projectData.prospectPhone = prospectPhone
    }
    if (prospectAddress) {
      projectData.prospectAddress = prospectAddress
    }
    if (prospectCity) {
      projectData.prospectCity = prospectCity
    }
    if (prospectState) {
      projectData.prospectState = prospectState
    }
    if (prospectZipCode) {
      projectData.prospectZipCode = prospectZipCode
    }

    if (dueDate) {
      projectData.dueDate = new Date(dueDate)
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
          status: newProject.status
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
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    // Production-ready statuses
    const productionStatuses: ProjectStatus[] = [
      ProjectStatus.APPROVED,
      ProjectStatus.QUOTE_ACCEPTED,
      ProjectStatus.ACTIVE
    ]

    // Fetch projects with production-ready statuses
    const projects = await prisma.project.findMany({
      where: {
        status: {
          in: productionStatuses
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            contactName: true
          }
        },
        openings: {
          select: {
            id: true,
            price: true,
            extrusionCost: true,
            hardwareCost: true,
            glassCost: true,
            otherCost: true,
            hybridRemainingCost: true
          }
        },
        pricingMode: {
          select: {
            markup: true,
            extrusionMarkup: true,
            hardwareMarkup: true,
            glassMarkup: true,
            discount: true
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ]
    })

    // Format the response data
    const formattedProjects = projects.map((project) => {
      // Calculate COG (cost of goods) - sum of base costs
      const costValue = project.openings.reduce((sum, opening) => sum + (opening.price || 0), 0)

      // Sum actual cost breakdown from stored values
      const totalExtrusionCost = project.openings.reduce((sum, o) => sum + (o.extrusionCost || 0), 0)
      const totalHardwareCost = project.openings.reduce((sum, o) => sum + (o.hardwareCost || 0), 0)
      const totalGlassCost = project.openings.reduce((sum, o) => sum + (o.glassCost || 0), 0)
      const totalOtherCost = project.openings.reduce((sum, o) => sum + (o.otherCost || 0), 0)

      // Apply category-specific pricing mode to get sale price
      let saleValue = costValue
      if (project.pricingMode) {
        const applyMarkup = (cost: number, categoryMarkup: number) => {
          const markup = categoryMarkup > 0 ? categoryMarkup : project.pricingMode!.markup
          let price = cost * (1 + markup / 100)
          if (project.pricingMode!.discount > 0) {
            price *= (1 - project.pricingMode!.discount / 100)
          }
          return price
        }

        const totalHybridRemainingCost = project.openings.reduce((sum, o) => sum + (o.hybridRemainingCost || 0), 0)

        saleValue =
          applyMarkup(totalExtrusionCost, project.pricingMode.extrusionMarkup) +
          applyMarkup(totalHardwareCost, project.pricingMode.hardwareMarkup) +
          applyMarkup(totalGlassCost, project.pricingMode.glassMarkup) +
          totalOtherCost +
          totalHybridRemainingCost
      }

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        dueDate: project.dueDate,
        customerId: project.customer?.id || null,
        customerName: project.customer?.companyName || 'No Customer',
        customerContact: project.customer?.contactName || null,
        openingsCount: project.openings.length,
        value: saleValue,
        batchSize: project.batchSize,
        updatedAt: project.updatedAt
      }
    })

    return NextResponse.json(formattedProjects)
  } catch (error) {
    console.error('Error fetching production projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch production projects' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

async function getPackingStats(projectId: number) {
  // Find sales order for this project
  const salesOrder = await prisma.salesOrder.findFirst({
    where: { projectId },
    select: { id: true }
  })

  if (!salesOrder) {
    return { total: 0, packed: 0, percentage: 0 }
  }

  // Get count of packed items from SalesOrderParts
  const packedParts = await prisma.salesOrderPart.findMany({
    where: { salesOrderId: salesOrder.id },
    select: { status: true }
  })

  const packed = packedParts.filter(p => p.status === 'PACKED').length

  // Get total expected items by counting from project openings/BOMs
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      openings: {
        include: {
          panels: {
            include: {
              componentInstance: {
                include: {
                  product: {
                    include: {
                      productBOMs: {
                        where: {
                          partType: 'Hardware',
                          addToPackingList: true
                        }
                      },
                      productSubOptions: {
                        include: {
                          category: {
                            include: {
                              individualOptions: {
                                where: { addToPackingList: true }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  let total = 0
  if (project) {
    for (const opening of project.openings) {
      let hasJambKitItems = false

      for (const panel of opening.panels) {
        // Count component
        total++

        // Count hardware from BOMs
        if (panel.componentInstance?.product?.productBOMs) {
          for (const bom of panel.componentInstance.product.productBOMs) {
            if (bom.addToPackingList) {
              total += bom.quantity || 1
            }
          }
        }

        // Count hardware from individual options
        if (panel.componentInstance?.subOptionSelections && panel.componentInstance.product?.productSubOptions) {
          try {
            const selections = JSON.parse(panel.componentInstance.subOptionSelections)
            for (const [categoryIdStr, optionId] of Object.entries(selections)) {
              if (!optionId) continue
              const categoryId = parseInt(categoryIdStr)
              const productSubOption = panel.componentInstance.product.productSubOptions.find(
                (pso: { category: { id: number } }) => pso.category.id === categoryId
              )
              if (productSubOption) {
                const selectedOption = productSubOption.category.individualOptions?.find(
                  (opt: { id: number; addToPackingList: boolean; partNumber: string | null }) =>
                    opt.id === Number(optionId) && opt.addToPackingList && opt.partNumber
                )
                if (selectedOption) {
                  total++
                }
              }
            }
          } catch {
            // Ignore parsing errors
          }
        }

        // Check for jamb kit items
        if (panel.componentInstance?.product) {
          const allBoms = await prisma.productBOM.findMany({
            where: { productId: panel.componentInstance.product.id },
            select: { partNumber: true }
          })
          for (const bom of allBoms) {
            if (bom.partNumber) {
              const masterPart = await prisma.masterPart.findUnique({
                where: { partNumber: bom.partNumber },
                select: { includeInJambKit: true }
              })
              if (masterPart?.includeInJambKit) {
                hasJambKitItems = true
                break
              }
            }
          }
        }
      }

      // Count jamb kit as one item per opening
      if (hasJambKitItems) {
        total++
      }
    }
  }

  const percentage = total > 0 ? Math.round((packed / total) * 100) : 0
  return { total, packed, percentage }
}

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
        },
        isCurrentVersion: true
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
        },
        workOrders: {
          select: {
            id: true,
            currentStage: true,
            items: {
              select: {
                id: true,
                isCompleted: true
              }
            }
          }
        },
        fieldVerificationUploads: {
          select: { id: true, confirmed: true }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ]
    })

    // Format the response data with packing stats
    const formattedProjects = await Promise.all(projects.map(async (project) => {
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

      // Get packing stats for this project
      const packingStats = await getPackingStats(project.id)

      // Calculate work order progress
      let workOrderProgress = undefined
      if (project.workOrders && project.workOrders.length > 0) {
        const stageDistribution: Record<string, number> = {
          STAGED: 0,
          CUTTING: 0,
          MILLING: 0,
          ASSEMBLY: 0,
          QC: 0,
          SHIP: 0,
          COMPLETE: 0
        }
        // Individual work order progress for badges
        const workOrderDetails: Array<{
          id: string
          stage: string
          progressPercent: number
        }> = []

        for (const wo of project.workOrders) {
          stageDistribution[wo.currentStage]++
          const totalItems = wo.items.length
          const completedItems = wo.items.filter(item => item.isCompleted).length
          const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
          workOrderDetails.push({
            id: wo.id,
            stage: wo.currentStage,
            progressPercent
          })
        }
        workOrderProgress = {
          total: project.workOrders.length,
          stageDistribution,
          workOrders: workOrderDetails
        }
      }

      return {
        id: project.id,
        name: project.name,
        version: project.version,
        status: project.status,
        dueDate: project.dueDate,
        customerId: project.customer?.id || null,
        customerName: project.customer?.companyName || 'No Customer',
        customerContact: project.customer?.contactName || null,
        openingsCount: project.openings.length,
        value: saleValue,
        batchSize: project.batchSize,
        updatedAt: project.updatedAt,
        packingStats,
        workOrderProgress,
        fieldVerificationCount: project.fieldVerificationUploads?.length || 0,
        fieldVerificationConfirmedCount: project.fieldVerificationUploads?.filter(u => u.confirmed).length || 0
      }
    }))

    return NextResponse.json(formattedProjects)
  } catch (error) {
    console.error('Error fetching production projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch production projects' },
      { status: 500 }
    )
  }
}

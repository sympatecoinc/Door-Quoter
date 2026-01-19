import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked, createLockedError } from '@/lib/project-status'
import { calculateProductTolerances, isToleranceEligible } from '@/lib/tolerance-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const panelId = searchParams.get('panelId')

    const where = panelId ? { panelId: parseInt(panelId) } : {}

    const componentInstances = await prisma.componentInstance.findMany({
      where,
      include: {
        product: true,
        panel: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json(componentInstances)
  } catch (error) {
    console.error('Error fetching component instances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch component instances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      panelId,
      productId,
      subOptionSelections = {},
      includedOptions = [], // Array of option IDs to mark as included (no charge)
      variantSelections = {} // Object: { [optionId]: variantId }
    } = await request.json()

    if (!panelId || !productId) {
      return NextResponse.json(
        { error: 'Panel ID and Product ID are required' },
        { status: 400 }
      )
    }

    // Check if panel exists and get project status with opening tolerance data
    const panel = await prisma.panel.findUnique({
      where: { id: parseInt(panelId) },
      include: {
        opening: {
          include: {
            project: { select: { status: true } }
          }
        }
      }
    })

    if (!panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      )
    }

    // Check if project is locked
    if (isProjectLocked(panel.opening.project.status)) {
      return NextResponse.json(createLockedError(panel.opening.project.status), { status: 403 })
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if component instance already exists for this panel
    const existingInstance = await prisma.componentInstance.findUnique({
      where: { panelId: parseInt(panelId) }
    })

    if (existingInstance) {
      return NextResponse.json(
        { error: 'Panel already has a product assigned' },
        { status: 400 }
      )
    }

    const componentInstance = await prisma.componentInstance.create({
      data: {
        panelId: parseInt(panelId),
        productId: parseInt(productId),
        subOptionSelections: JSON.stringify(subOptionSelections),
        includedOptions: JSON.stringify(includedOptions),
        variantSelections: JSON.stringify(variantSelections)
      },
      include: {
        product: true,
        panel: true
      }
    })

    // Apply product tolerances to opening if applicable (first-product-wins)
    if (isToleranceEligible(product.productType)) {
      const opening = panel.opening
      const toleranceUpdate = await calculateProductTolerances(
        {
          id: opening.id,
          roughWidth: opening.roughWidth,
          roughHeight: opening.roughHeight,
          openingType: opening.openingType,
          isFinishedOpening: opening.isFinishedOpening,
          toleranceProductId: opening.toleranceProductId,
          widthToleranceTotal: opening.widthToleranceTotal,
          heightToleranceTotal: opening.heightToleranceTotal
        },
        {
          id: product.id,
          productType: product.productType,
          widthTolerance: product.widthTolerance,
          heightTolerance: product.heightTolerance
        }
      )

      if (toleranceUpdate) {
        await prisma.opening.update({
          where: { id: opening.id },
          data: {
            widthToleranceTotal: toleranceUpdate.widthToleranceTotal,
            heightToleranceTotal: toleranceUpdate.heightToleranceTotal,
            toleranceProductId: toleranceUpdate.toleranceProductId,
            finishedWidth: toleranceUpdate.finishedWidth,
            finishedHeight: toleranceUpdate.finishedHeight
          }
        })
      }
    }

    return NextResponse.json(componentInstance, { status: 201 })
  } catch (error) {
    console.error('Error creating component instance:', error)
    return NextResponse.json(
      { error: 'Failed to create component instance' },
      { status: 500 }
    )
  }
}
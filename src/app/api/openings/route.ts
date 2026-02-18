import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isProjectLocked, createLockedError } from '@/lib/project-status'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where = projectId ? { projectId: parseInt(projectId) } : {}

    const openings = await prisma.opening.findMany({
      where,
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: { include: { productSubOptions: { include: { category: { include: { individualOptions: true } } } } } }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(openings)
  } catch (error) {
    console.error('Error fetching openings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch openings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      projectId,
      name,
      openingNumber, // Support both field names for backward compatibility
      roughWidth,
      roughHeight,
      finishedWidth,
      finishedHeight,
      width, // Support the form field name
      height, // Support the form field name
      price = 0,
      multiplier,
      finishColor,
      // Finished Opening Tolerance Fields
      isFinishedOpening = false,
      openingType,
      widthToleranceTotal,
      heightToleranceTotal,
      // Opening-level frame product
      frameProductId
      // Note: includeStarterChannels removed - now handled via category options
    } = await request.json()

    // Use name if provided, otherwise use openingNumber
    const openingName = name || openingNumber

    if (!projectId || !openingName) {
      return NextResponse.json(
        { error: 'Project ID and opening name are required' },
        { status: 400 }
      )
    }

    // Check if project is locked for editing
    const project = await prisma.project.findUnique({
      where: { id: parseInt(projectId) },
      select: { status: true }
    })

    if (project && isProjectLocked(project.status)) {
      return NextResponse.json(createLockedError(project.status), { status: 403 })
    }

    // Check if opening name already exists for this project
    const existingOpening = await prisma.opening.findFirst({
      where: {
        projectId: parseInt(projectId),
        name: openingName
      }
    })

    if (existingOpening) {
      return NextResponse.json(
        { error: 'Opening name already exists for this project' },
        { status: 400 }
      )
    }

    // Build the data object with optional size fields
    const openingData: any = {
      projectId: parseInt(projectId),
      name: openingName,
      price: parseFloat(price) || 0,
      isFinishedOpening: Boolean(isFinishedOpening)
    }

    if (multiplier !== undefined) {
      openingData.multiplier = parseFloat(multiplier) || 1.0
    }

    if (finishColor) {
      openingData.finishColor = finishColor
    }

    // Add opening type if provided
    if (openingType && ['THINWALL', 'FRAMED'].includes(openingType)) {
      openingData.openingType = openingType
    }

    // Add frame product for FRAMED openings
    if (frameProductId) {
      openingData.frameProductId = parseInt(frameProductId)
    }

    // Add tolerance overrides if provided
    if (widthToleranceTotal !== undefined && widthToleranceTotal !== null) {
      openingData.widthToleranceTotal = parseFloat(widthToleranceTotal)
    }
    if (heightToleranceTotal !== undefined && heightToleranceTotal !== null) {
      openingData.heightToleranceTotal = parseFloat(heightToleranceTotal)
    }

    // Note: includeStarterChannels removed - now handled via category options

    // Add size fields only if they have values
    let finalRoughWidth = null
    let finalRoughHeight = null

    if (roughWidth && roughWidth !== '') {
      finalRoughWidth = parseFloat(roughWidth)
      openingData.roughWidth = finalRoughWidth
    }
    if (roughHeight && roughHeight !== '') {
      finalRoughHeight = parseFloat(roughHeight)
      openingData.roughHeight = finalRoughHeight
    }

    // Support simplified width/height fields from form
    if (width && width !== '' && !roughWidth) {
      finalRoughWidth = parseFloat(width)
      openingData.roughWidth = finalRoughWidth
    }
    if (height && height !== '' && !roughHeight) {
      finalRoughHeight = parseFloat(height)
      openingData.roughHeight = finalRoughHeight
    }

    // Calculate finished dimensions
    if (Boolean(isFinishedOpening) && finalRoughWidth !== null && finalRoughHeight !== null) {
      // Resolve tolerances: use provided overrides, else fetch defaults from GlobalSetting
      let widthTol = (widthToleranceTotal !== undefined && widthToleranceTotal !== null)
        ? parseFloat(widthToleranceTotal)
        : null
      let heightTol = (heightToleranceTotal !== undefined && heightToleranceTotal !== null)
        ? parseFloat(heightToleranceTotal)
        : null

      if (widthTol === null || heightTol === null) {
        const toleranceSettings = await prisma.globalSetting.findMany({
          where: { category: 'tolerances' }
        })
        const tolMap = new Map(toleranceSettings.map(s => [s.key, parseFloat(s.value)]))
        const defaults = {
          thinwallWidthTolerance: tolMap.get('tolerance.thinwall.width') ?? 1.0,
          thinwallHeightTolerance: tolMap.get('tolerance.thinwall.height') ?? 1.5,
          framedWidthTolerance: tolMap.get('tolerance.framed.width') ?? 0.5,
          framedHeightTolerance: tolMap.get('tolerance.framed.height') ?? 0.75,
        }

        const finalOpeningType = openingType || null
        if (widthTol === null) {
          widthTol = finalOpeningType === 'FRAMED'
            ? defaults.framedWidthTolerance
            : defaults.thinwallWidthTolerance
        }
        if (heightTol === null) {
          heightTol = finalOpeningType === 'FRAMED'
            ? defaults.framedHeightTolerance
            : defaults.thinwallHeightTolerance
        }
      }

      // Persist resolved tolerances so getEffectiveOpeningSize() can access them
      openingData.widthToleranceTotal = widthTol
      openingData.heightToleranceTotal = heightTol

      // Calculate finished dimensions
      // FRAMED: finished = rough - tolerance (frame sits in the rough opening)
      // THINWALL: finished = rough (the entered size IS the finished opening; tolerance is for panel sizing only)
      if (openingType === 'THINWALL') {
        openingData.finishedWidth = finalRoughWidth
        openingData.finishedHeight = finalRoughHeight
      } else {
        openingData.finishedWidth = finalRoughWidth - widthTol
        openingData.finishedHeight = finalRoughHeight - heightTol
      }
    } else {
      // Non-finished opening: use provided values or copy from rough
      if (finishedWidth && finishedWidth !== '') {
        openingData.finishedWidth = parseFloat(finishedWidth)
      } else if (finalRoughWidth !== null) {
        openingData.finishedWidth = finalRoughWidth
      }
      if (finishedHeight && finishedHeight !== '') {
        openingData.finishedHeight = parseFloat(finishedHeight)
      } else if (finalRoughHeight !== null) {
        openingData.finishedHeight = finalRoughHeight
      }
    }

    const opening = await prisma.opening.create({
      data: openingData,
      include: {
        panels: {
          include: {
            componentInstance: {
              include: {
                product: { include: { productSubOptions: { include: { category: { include: { individualOptions: true } } } } } }
              }
            }
          }
        },
        frameProduct: {
          select: { id: true, name: true, productType: true, jambThickness: true }
        }
      }
    })

    return NextResponse.json(opening, { status: 201 })
  } catch (error) {
    console.error('Error creating opening:', error)
    return NextResponse.json(
      { error: 'Failed to create opening' },
      { status: 500 }
    )
  }
}
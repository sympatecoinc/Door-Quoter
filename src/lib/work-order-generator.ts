/**
 * Work Order Generator
 * Generates work orders from project cut list batches
 */

import { prisma } from '@/lib/prisma'
import { WorkOrderStage } from '@prisma/client'

// Production color palette for visual identification
const PRODUCTION_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#14B8A6', // Teal
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
]

interface GenerateWorkOrdersOptions {
  projectId: number
  userId?: number | null
  batchSize?: number | null // If null, creates one work order for all items
}

interface WorkOrderItemInput {
  partNumber: string
  partName: string
  partType: string
  quantity: number
  cutLength?: number | null
  stockLength?: number | null
  binLocation?: string | null
  openingName?: string
  productName?: string
  metadata?: Record<string, any>
}

interface GeneratedWorkOrder {
  batchNumber: number
  items: WorkOrderItemInput[]
}

/**
 * Auto-assign a production color to a project
 * Uses least-recently-used color from palette
 */
async function assignProjectColor(projectId: number): Promise<string> {
  // Get recently used colors (from projects with work orders in last 30 days)
  const recentProjects = await prisma.project.findMany({
    where: {
      productionColor: { not: null },
      workOrders: {
        some: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }
    },
    select: { productionColor: true },
    orderBy: {
      workOrders: {
        _count: 'desc'
      }
    },
    take: 20
  })

  const usedColors = new Set(recentProjects.map(p => p.productionColor))

  // Find first unused color, or fall back to least-used
  let selectedColor = PRODUCTION_COLORS.find(c => !usedColors.has(c))

  if (!selectedColor) {
    // All colors used recently, pick randomly
    selectedColor = PRODUCTION_COLORS[Math.floor(Math.random() * PRODUCTION_COLORS.length)]
  }

  // Update project with the selected color
  await prisma.project.update({
    where: { id: projectId },
    data: { productionColor: selectedColor }
  })

  return selectedColor
}

/**
 * Generate work orders from project cut list data
 * Creates batched work orders based on project openings and their BOM items
 */
export async function generateWorkOrdersFromProject(
  options: GenerateWorkOrdersOptions
): Promise<{ workOrders: any[]; created: number; skipped: number; projectColor: string }> {
  const { projectId, userId, batchSize } = options

  // Get project with openings and components
  const project = await prisma.project.findUnique({
    where: { id: projectId },
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
                      productBOMs: {
                        include: {
                          option: true // Include linked option for cut list items
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      workOrders: {
        select: { batchNumber: true }
      }
    }
  })

  if (!project) {
    throw new Error('Project not found')
  }

  // Auto-assign production color if not already set
  let projectColor = project.productionColor
  if (!projectColor) {
    projectColor = await assignProjectColor(projectId)
  }

  // Get master parts for bin locations and stock info
  const partNumbers = new Set<string>()
  for (const opening of project.openings) {
    for (const panel of opening.panels) {
      if (panel.componentInstance) {
        for (const bom of panel.componentInstance.product.productBOMs) {
          if (bom.partNumber) {
            partNumbers.add(bom.partNumber)
            // Also check with finish suffixes
            const basePartNumber = bom.partNumber.replace(/-[A-Z0-9]+$/, '')
            partNumbers.add(basePartNumber)
          }
        }
      }
    }
  }

  // Fetch master parts with bin locations
  const masterParts = await prisma.masterPart.findMany({
    where: {
      partNumber: { in: Array.from(partNumbers) }
    },
    include: {
      binLocationRef: true,
      stockLengthRules: true
    }
  })

  const masterPartMap = new Map(masterParts.map(mp => [mp.partNumber, mp]))

  // Get existing batch numbers
  const existingBatches = new Set(project.workOrders.map(wo => wo.batchNumber))

  // Determine batch size (from project settings or parameter)
  const effectiveBatchSize = batchSize ?? project.batchSize ?? null

  // Group items by batch
  const batches: GeneratedWorkOrder[] = []
  let currentBatch: WorkOrderItemInput[] = []
  let currentBatchOpeningCount = 0
  let batchNumber = 1

  // Find next available batch number
  while (existingBatches.has(batchNumber)) {
    batchNumber++
  }
  const startingBatchNumber = batchNumber

  for (const opening of project.openings) {
    const openingItems: WorkOrderItemInput[] = []

    for (const panel of opening.panels) {
      if (!panel.componentInstance) continue

      const product = panel.componentInstance.product

      // Create work order items from product BOMs
      for (const bom of product.productBOMs) {
        // Only include extrusions and cut stock items (things that go through cutting)
        // Hardware items can be added but may skip cutting stage
        if (!bom.partNumber) continue

        // Get master part info for bin location and stock length
        const masterPart = masterPartMap.get(bom.partNumber) ||
          masterPartMap.get(bom.partNumber.replace(/-[A-Z0-9]+$/, ''))

        // Calculate cut length from formula if it's an extrusion
        let cutLength: number | null = null
        let stockLength: number | null = bom.stockLength || null

        if (bom.partType === 'Extrusion' && bom.formula) {
          // Evaluate formula with panel dimensions
          try {
            const evalContext = {
              width: panel.width,
              height: panel.height,
              W: panel.width,
              H: panel.height
            }
            // Simple formula evaluation (safe, limited context)
            const formula = bom.formula
              .replace(/width/gi, evalContext.width.toString())
              .replace(/height/gi, evalContext.height.toString())
              .replace(/W/g, evalContext.W.toString())
              .replace(/H/g, evalContext.H.toString())

            // Only evaluate if it looks like a simple math expression
            if (/^[\d\s+\-*/().]+$/.test(formula)) {
              cutLength = eval(formula)
            }
          } catch {
            // If formula evaluation fails, leave cutLength as null
          }
        }

        // Get stock length from master part rules if not specified
        if (!stockLength && masterPart?.stockLengthRules?.length) {
          // Find best matching stock length rule
          const matchingRule = masterPart.stockLengthRules.find(rule => {
            if (!rule.isActive) return false
            if (cutLength) {
              // Check if cut length fits within rule constraints
              if (rule.stockLength && cutLength <= rule.stockLength) return true
            }
            return rule.stockLength !== null
          })
          stockLength = matchingRule?.stockLength || null
        }

        // Get bin location
        let binLocation: string | null = null
        if (masterPart?.binLocationRef) {
          binLocation = masterPart.binLocationRef.code
        } else if (masterPart?.binLocationLegacy) {
          binLocation = masterPart.binLocationLegacy
        }

        openingItems.push({
          partNumber: bom.partNumber,
          partName: bom.partName || bom.description || bom.partNumber,
          partType: bom.partType,
          quantity: bom.quantity ? Math.ceil(bom.quantity) : 1,
          cutLength,
          stockLength,
          binLocation,
          openingName: opening.name,
          productName: product.name,
          metadata: {
            panelId: panel.id,
            productId: product.id,
            width: panel.width,
            height: panel.height,
            bomId: bom.id,
            formula: bom.formula,
            // Only extrusions and cut stock can be milled - other part types should never have isMilled=true
            isMilled: (bom.partType === 'Extrusion' || bom.partType === 'CutStock') && bom.isMilled
          }
        })
      }
    }

    // Add opening items to current batch
    if (openingItems.length > 0) {
      currentBatch.push(...openingItems)
      currentBatchOpeningCount++

      // Check if we should close this batch
      if (effectiveBatchSize && currentBatchOpeningCount >= effectiveBatchSize) {
        batches.push({
          batchNumber: startingBatchNumber + batches.length,
          items: currentBatch
        })
        currentBatch = []
        currentBatchOpeningCount = 0
      }
    }
  }

  // Don't forget remaining items
  if (currentBatch.length > 0) {
    batches.push({
      batchNumber: startingBatchNumber + batches.length,
      items: currentBatch
    })
  }

  // Create work orders in database
  const createdWorkOrders: any[] = []
  let skipped = 0

  for (const batch of batches) {
    // Skip if batch already exists
    if (existingBatches.has(batch.batchNumber)) {
      skipped++
      continue
    }

    const workOrder = await prisma.workOrder.create({
      data: {
        projectId,
        batchNumber: batch.batchNumber,
        currentStage: 'STAGED',
        priority: 0,
        stageHistory: {
          create: {
            stage: 'STAGED',
            enteredById: userId
          }
        },
        items: {
          create: batch.items.map(item => ({
            partNumber: item.partNumber,
            partName: item.partName,
            partType: item.partType,
            quantity: item.quantity,
            cutLength: item.cutLength,
            stockLength: item.stockLength,
            binLocation: item.binLocation,
            openingName: item.openingName || null,
            productName: item.productName || null,
            metadata: item.metadata ? item.metadata : undefined
          }))
        }
      },
      include: {
        items: true,
        stageHistory: {
          include: {
            enteredBy: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    createdWorkOrders.push(workOrder)
  }

  return {
    workOrders: createdWorkOrders,
    created: createdWorkOrders.length,
    skipped,
    projectColor
  }
}

/**
 * Get summary of parts by type for a work order
 */
export function summarizeWorkOrderItems(items: WorkOrderItemInput[]): {
  extrusions: number
  hardware: number
  glass: number
  other: number
  total: number
} {
  const summary = {
    extrusions: 0,
    hardware: 0,
    glass: 0,
    other: 0,
    total: 0
  }

  for (const item of items) {
    const qty = item.quantity || 1
    summary.total += qty

    switch (item.partType?.toLowerCase()) {
      case 'extrusion':
      case 'cutstock':
        summary.extrusions += qty
        break
      case 'hardware':
      case 'fastener':
        summary.hardware += qty
        break
      case 'glass':
        summary.glass += qty
        break
      default:
        summary.other += qty
    }
  }

  return summary
}

/**
 * Determine if a work order can skip certain stages
 * (e.g., hardware-only orders can skip cutting)
 */
export function determineSkippableStages(items: WorkOrderItemInput[]): WorkOrderStage[] {
  const skippable: WorkOrderStage[] = []

  // Check if any items require cutting
  const requiresCutting = items.some(item => {
    const partType = item.partType?.toLowerCase()
    return partType === 'extrusion' || partType === 'cutstock'
  })

  if (!requiresCutting) {
    skippable.push('CUTTING')
  }

  return skippable
}

/**
 * Get production colors palette
 */
export function getProductionColors(): string[] {
  return [...PRODUCTION_COLORS]
}

/**
 * Get a contrasting text color for a background color
 */
export function getContrastColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

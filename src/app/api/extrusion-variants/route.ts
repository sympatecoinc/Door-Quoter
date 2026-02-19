import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper to determine stock status
function getStockStatus(qtyOnHand: number, reorderPoint: number | null): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (qtyOnHand <= 0) return 'out_of_stock'
  if (reorderPoint && qtyOnHand <= reorderPoint) return 'low_stock'
  return 'in_stock'
}

// Helper to convert inches to display feet
function inchesToFeetDisplay(inches: number): string {
  const feet = inches / 12
  return `${feet}ft`
}

// GET - Fetch extrusion variants grouped by MasterPart
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const stockStatus = searchParams.get('stockStatus') || 'all'

    // Get all extrusion and CutStock MasterParts with their variants and stock length rules
    const extrusions = await prisma.masterPart.findMany({
      where: {
        partType: { in: ['Extrusion', 'CutStock'] },
        ...(search && {
          OR: [
            { partNumber: { contains: search, mode: 'insensitive' } },
            { baseName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        extrusionVariants: {
          where: { isActive: true },
          include: {
            finishPricing: true
          },
          orderBy: [
            { stockLength: 'asc' },
            { finishPricingId: 'asc' }
          ]
        },
        stockLengthRules: {
          where: { isActive: true }
        }
      },
      orderBy: { partNumber: 'asc' }
    })

    // Get all active finishes for the UI
    const finishes = await prisma.extrusionFinishPricing.findMany({
      where: { isActive: true },
      orderBy: { finishType: 'asc' }
    })

    // Transform into grouped format
    const groups = extrusions.map(ext => {
      // Get unique lengths from both existing variants AND stock length rules
      const variantLengths = ext.extrusionVariants.map(v => v.stockLength)
      const ruleLengths = ext.stockLengthRules
        .map(r => r.stockLength)
        .filter((l): l is number => l !== null)
      const lengths = [...new Set([...variantLengths, ...ruleLengths])].sort((a, b) => a - b)

      // Build finish options including Mill (null)
      // Always show all available finishes so user can add variants for any finish type
      const finishOptions: Array<{ id: number | null; name: string; code: string | null }> = []

      if (lengths.length > 0) {
        if (ext.partType === 'CutStock' || ext.isMillFinish) {
          // CutStock and Mill-finish-only extrusions: show only Mill option (no finish codes)
          finishOptions.push({ id: null, name: 'Mill', code: null })
        } else {
          // Non-mill extrusions: show only the other finishes (no Mill option)
          finishes.forEach(f => {
            finishOptions.push({ id: f.id, name: f.finishType, code: f.finishCode })
          })
        }
      }

      // Transform variants with computed fields
      const variants = ext.extrusionVariants.map(v => {
        const stockStatus = getStockStatus(v.qtyOnHand, v.reorderPoint)
        const finishName = v.finishPricing?.finishType || 'Mill'
        const displayName = `${inchesToFeetDisplay(v.stockLength)} ${finishName}`

        return {
          ...v,
          stockStatus,
          displayName
        }
      })

      // Filter by stock status if specified
      let filteredVariants = variants
      if (stockStatus !== 'all') {
        filteredVariants = variants.filter(v => v.stockStatus === stockStatus)
      }

      return {
        masterPart: {
          id: ext.id,
          partNumber: ext.partNumber,
          baseName: ext.baseName,
          description: ext.description,
          partType: ext.partType,
          weightPerFoot: ext.weightPerFoot,
          perimeterInches: ext.perimeterInches,
          customPricePerLb: ext.customPricePerLb,
          isMillFinish: ext.isMillFinish
        },
        variants: filteredVariants,
        lengths,
        ruleLengths,
        finishes: finishOptions
      }
    })

    // Filter out groups with no variants (after stock status filter)
    const filteredGroups = stockStatus !== 'all'
      ? groups.filter(g => g.variants.length > 0)
      : groups

    // Calculate summary
    const allVariants = groups.flatMap(g => g.variants)
    const summary = {
      totalProfiles: extrusions.length,
      totalVariants: allVariants.length,
      lowStockCount: allVariants.filter(v => v.stockStatus === 'low_stock').length,
      outOfStockCount: allVariants.filter(v => v.stockStatus === 'out_of_stock').length
    }

    return NextResponse.json({
      groups: filteredGroups,
      finishes,
      summary
    })
  } catch (error) {
    console.error('Error fetching extrusion variants:', error)
    return NextResponse.json(
      { error: 'Failed to fetch extrusion variants' },
      { status: 500 }
    )
  }
}

// POST - Create new extrusion variant
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      masterPartId,
      stockLength,
      finishPricingId,
      qtyOnHand = 0,
      binLocation,
      reorderPoint,
      reorderQty,
      pricePerPiece,
      notes
    } = body

    // Validate required fields
    if (!masterPartId || !stockLength) {
      return NextResponse.json(
        { error: 'masterPartId and stockLength are required' },
        { status: 400 }
      )
    }

    // Check if variant already exists
    // Note: findUnique doesn't support null in compound keys, so use findFirst for nullable finishPricingId
    const existing = await prisma.extrusionVariant.findFirst({
      where: {
        masterPartId,
        stockLength,
        finishPricingId: finishPricingId || null
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A variant with this length and finish already exists' },
        { status: 409 }
      )
    }

    // Create the variant
    const variant = await prisma.extrusionVariant.create({
      data: {
        masterPartId,
        stockLength,
        finishPricingId: finishPricingId || null,
        qtyOnHand,
        binLocationId: binLocation ? parseInt(binLocation) : null,
        reorderPoint,
        reorderQty,
        pricePerPiece,
        notes
      },
      include: {
        finishPricing: true,
        masterPart: {
          select: {
            id: true,
            partNumber: true,
            baseName: true,
            description: true
          }
        }
      }
    })

    return NextResponse.json(variant, { status: 201 })
  } catch (error) {
    console.error('Error creating extrusion variant:', error)
    return NextResponse.json(
      { error: 'Failed to create extrusion variant' },
      { status: 500 }
    )
  }
}

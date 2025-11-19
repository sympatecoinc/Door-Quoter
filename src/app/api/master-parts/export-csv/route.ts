import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Properly escape CSV values according to RFC 4180
function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  // Convert to string
  const str = value?.toString() || ''

  // If the value contains quotes, commas, or newlines, it must be quoted
  // and internal quotes must be doubled
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  // Otherwise, just wrap in quotes for consistency
  return `"${str}"`
}

export async function GET(request: NextRequest) {
  try {
    // Fetch all master parts with their pricing rules
    const masterParts = await prisma.masterPart.findMany({
      include: {
        stockLengthRules: {
          where: { isActive: true },
          orderBy: { minHeight: 'asc' }
        },
        pricingRules: {
          where: { isActive: true }
        }
      },
      orderBy: [
        { partType: 'asc' },
        { partNumber: 'asc' }
      ]
    })

    // Build CSV content
    const csvRows: string[] = []

    // Add header
    csvRows.push([
      'partNumber',
      'baseName',
      'description',
      'unit',
      'cost',
      'weightPerUnit',
      'partType',
      'isOption',
      // Stock length rule fields (for extrusions)
      'stockRule_isMillFinish',
      'stockRule_minHeight',
      'stockRule_maxHeight',
      'stockRule_stockLength',
      'stockRule_piecesPerUnit',
      'stockRule_basePrice',
      'stockRule_basePriceBlack',
      'stockRule_basePriceClear',
      'stockRule_formula',
      // Pricing rule fields (for other parts)
      'pricingRule_basePrice',
      'pricingRule_formula'
    ].map(h => escapeCsvValue(h)).join(','))

    // Add data rows
    for (const part of masterParts) {
      // For parts without rules, add one row
      if (part.stockLengthRules.length === 0 && part.pricingRules.length === 0) {
        csvRows.push([
          part.partNumber,
          part.baseName,
          part.description || '',
          part.unit || '',
          part.cost?.toString() || '',
          part.weightPerUnit?.toString() || '',
          part.partType,
          part.isOption ? 'TRUE' : 'FALSE',
          '', '', '', '', '', '', '', '', '', // Stock rule fields (added isMillFinish, basePriceBlack, basePriceClear)
          '', '' // Pricing rule fields
        ].map(v => escapeCsvValue(v)).join(','))
      }

      // For extrusions with stock length rules, add one row per rule
      if (part.stockLengthRules.length > 0) {
        for (const rule of part.stockLengthRules) {
          csvRows.push([
            part.partNumber,
            part.baseName,
            part.description || '',
            part.unit || '',
            part.cost?.toString() || '',
            part.weightPerUnit?.toString() || '',
            part.partType,
            part.isOption ? 'TRUE' : 'FALSE',
            // Stock length rule fields
            rule.isMillFinish ? 'TRUE' : 'FALSE',
            rule.minHeight?.toString() || '',
            rule.maxHeight?.toString() || '',
            rule.stockLength?.toString() || '',
            rule.piecesPerUnit?.toString() || '',
            rule.basePrice?.toString() || '',
            rule.basePriceBlack?.toString() || '',
            rule.basePriceClear?.toString() || '',
            rule.formula || '',
            '', '' // Pricing rule fields (empty for stock rules)
          ].map(v => escapeCsvValue(v)).join(','))
        }
      }

      // For parts with pricing rules (non-extrusions), add one row per rule
      if (part.pricingRules.length > 0) {
        for (const rule of part.pricingRules) {
          csvRows.push([
            part.partNumber,
            part.baseName,
            part.description || '',
            part.unit || '',
            part.cost?.toString() || '',
            part.weightPerUnit?.toString() || '',
            part.partType,
            part.isOption ? 'TRUE' : 'FALSE',
            '', '', '', '', '', '', '', '', '', // Stock rule fields (empty for pricing rules, added isMillFinish, basePriceBlack, basePriceClear)
            // Pricing rule fields
            rule.basePrice?.toString() || '',
            rule.formula || ''
          ].map(v => escapeCsvValue(v)).join(','))
        }
      }
    }

    const csvContent = csvRows.join('\n')

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="master-parts-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  } catch (error) {
    console.error('Error exporting master parts:', error)
    return NextResponse.json(
      { error: 'Failed to export master parts' },
      { status: 500 }
    )
  }
}

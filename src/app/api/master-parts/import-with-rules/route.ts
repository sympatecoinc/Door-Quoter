import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const csvFile = formData.get('csvFile') as File

    if (!csvFile) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
    }

    // Read and parse CSV
    const text = await csvFile.text()
    const lines = text.split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('#'))

    if (lines.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

    // Detect format: enhanced (with pricing rules) or basic
    // Enhanced format has columns starting with stockRule_ or pricingRule_
    const isEnhancedFormat = headers.some(h => h.startsWith('stockRule_') || h.startsWith('pricingRule_'))

    console.log('Import format detection:', {
      isEnhancedFormat,
      headers: headers.slice(0, 10),
      hasStockRules: headers.filter(h => h.startsWith('stockRule_')),
      hasPricingRules: headers.filter(h => h.startsWith('pricingRule_'))
    })

    // Validate required headers for basic format
    const requiredHeaders = ['partNumber', 'baseName', 'partType']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

    if (missingHeaders.length > 0) {
      return NextResponse.json({
        error: `CSV must include these columns: ${missingHeaders.join(', ')}`
      }, { status: 400 })
    }

    // Parse data rows
    const dataRows = lines.slice(1)
    let imported = 0
    const errors: string[] = []
    const skipped: string[] = []

    if (isEnhancedFormat) {
      // Enhanced format: Group rows by partNumber (multiple rows per part for rules)
      const partGroups = new Map<string, any[]>()

      for (let i = 0; i < dataRows.length; i++) {
        const line = dataRows[i]
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))

        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        if (!row.partNumber || row.partNumber.trim() === '') {
          continue
        }

        if (!partGroups.has(row.partNumber)) {
          partGroups.set(row.partNumber, [])
        }
        partGroups.get(row.partNumber)!.push({ row, lineNum: i + 2 })
      }

      // Process each part group
      for (const [partNumber, entries] of partGroups) {
        try {
          // Use first row for master part data
          const firstEntry = entries[0]
          const row = firstEntry.row

          // Validate required fields
          if (!row.baseName || row.baseName.trim() === '') {
            errors.push(`Part ${partNumber}: Missing base name`)
            continue
          }

          if (!row.partType || row.partType.trim() === '') {
            errors.push(`Part ${partNumber}: Missing part type`)
            continue
          }

          // Skip Glass parts
          if (row.partType === 'Glass') {
            skipped.push(`Part ${partNumber}: Glass parts cannot be imported as master parts`)
            continue
          }

          // Check if part already exists
          const existingPart = await prisma.masterPart.findUnique({
            where: { partNumber }
          })

          if (existingPart) {
            skipped.push(`Part ${partNumber}: Already exists and was skipped`)
            continue
          }

          // Use transaction to create part and rules atomically
          await prisma.$transaction(async (tx) => {
            // Create master part
            const masterPart = await tx.masterPart.create({
              data: {
                partNumber: row.partNumber,
                baseName: row.baseName,
                description: row.description || null,
                unit: row.partType === 'Extrusion' ? 'IN' : (row.unit || null),
                cost: row.partType === 'Extrusion' ? null : (row.cost ? parseFloat(row.cost) : null),
                partType: row.partType,
                isOption: row.partType === 'Hardware' ? (row.isOption === 'TRUE' || row.isOption === 'true') : false
              }
            })

            // Create stock length rules for extrusions
            if (row.partType === 'Extrusion') {
              console.log(`Creating stock rules for ${partNumber}, entries:`, entries.length)
              for (const entry of entries) {
                const r = entry.row
                console.log(`  Entry stockLength: "${r.stockRule_stockLength}"`)
                if (r.stockRule_stockLength && r.stockRule_stockLength.trim() !== '') {
                  console.log(`  Creating rule with stockLength: ${r.stockRule_stockLength}`)
                  await tx.stockLengthRule.create({
                    data: {
                      masterPartId: masterPart.id,
                      name: `${partNumber} - ${r.stockRule_stockLength}" stock`,
                      description: null,
                      minHeight: r.stockRule_minHeight ? parseFloat(r.stockRule_minHeight) : null,
                      maxHeight: r.stockRule_maxHeight ? parseFloat(r.stockRule_maxHeight) : null,
                      minWidth: null,
                      maxWidth: null,
                      stockLength: parseFloat(r.stockRule_stockLength),
                      piecesPerUnit: r.stockRule_piecesPerUnit ? parseFloat(r.stockRule_piecesPerUnit) : 1,
                      maxLength: null,
                      maxLengthAppliesTo: null,
                      appliesTo: 'Extrusion',
                      partType: 'Extrusion',
                      isActive: true,
                      basePrice: r.stockRule_basePrice ? parseFloat(r.stockRule_basePrice) : null,
                      formula: r.stockRule_formula || null,
                      minQuantity: null,
                      maxQuantity: null
                    }
                  })
                }
              }
            } else {
              // Create pricing rules for non-extrusions
              for (const entry of entries) {
                const r = entry.row
                if (r.pricingRule_basePrice && r.pricingRule_basePrice.trim() !== '') {
                  await tx.pricingRule.create({
                    data: {
                      masterPartId: masterPart.id,
                      name: `${partNumber} pricing rule`,
                      description: null,
                      basePrice: parseFloat(r.pricingRule_basePrice),
                      formula: r.pricingRule_formula || null,
                      minQuantity: null,
                      maxQuantity: null,
                      partType: row.partType,
                      isActive: true
                    }
                  })
                }
              }
            }
          })

          imported++
        } catch (error) {
          console.error(`Error importing part ${partNumber}:`, error)
          errors.push(`Part ${partNumber}: Failed to import`)
        }
      }
    } else {
      // Basic format: One row per part, no pricing rules
      for (let i = 0; i < dataRows.length; i++) {
        const line = dataRows[i]
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))

        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })

        // Skip if missing required fields
        if (!row.partNumber || row.partNumber.trim() === '') {
          errors.push(`Row ${i + 2}: Missing part number`)
          continue
        }

        if (!row.baseName || row.baseName.trim() === '') {
          errors.push(`Row ${i + 2}: Missing base name`)
          continue
        }

        if (!row.partType || row.partType.trim() === '') {
          errors.push(`Row ${i + 2}: Missing part type`)
          continue
        }

        // Skip Glass parts
        if (row.partType === 'Glass') {
          skipped.push(`Row ${i + 2}: Glass parts cannot be imported as master parts (${row.partNumber})`)
          continue
        }

        // Validate cost requirements for Hardware
        if (row.partType === 'Hardware') {
          if (!row.cost || row.cost.trim() === '' || isNaN(parseFloat(row.cost))) {
            errors.push(`Row ${i + 2}: Hardware parts require a valid cost (${row.partNumber})`)
            continue
          }
        }

        try {
          // Check if part already exists
          const existingPart = await prisma.masterPart.findUnique({
            where: { partNumber: row.partNumber }
          })

          if (existingPart) {
            skipped.push(`Row ${i + 2}: Part number ${row.partNumber} already exists and was skipped`)
            continue
          }

          // Create new part
          await prisma.masterPart.create({
            data: {
              partNumber: row.partNumber,
              baseName: row.baseName,
              description: row.description || null,
              unit: row.partType === 'Extrusion' ? 'IN' : (row.unit || null),
              cost: row.partType === 'Extrusion' ? null : (row.cost ? parseFloat(row.cost) : null),
              partType: row.partType,
              isOption: row.partType === 'Hardware' ? (row.isOption === 'TRUE' || row.isOption === 'true') : false
            }
          })
          imported++
        } catch (error) {
          console.error(`Error importing row ${i + 2}:`, error)
          errors.push(`Row ${i + 2}: Failed to import - ${row.partNumber}`)
        }
      }
    }

    // Return results
    const response: any = {
      imported,
      format: isEnhancedFormat ? 'enhanced' : 'basic'
    }
    if (errors.length > 0) {
      response.errors = errors
    }
    if (skipped.length > 0) {
      response.skipped = skipped
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error uploading CSV:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

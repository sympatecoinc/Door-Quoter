import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const csvFile = formData.get('csvFile') as File

    if (!csvFile) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
    }

    // Read and parse CSV
    const text = await csvFile.text()
    const lines = text.split('\n').filter(line => line.trim() !== '')
    
    if (lines.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    // Validate required headers
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
    let updated = 0
    const errors: string[] = []
    const skipped: string[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const line = dataRows[i]
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      
      // Create row object
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

      // Prevent glass from being imported
      if (row.partType === 'Glass') {
        skipped.push(`Row ${i + 2}: Glass parts cannot be imported as master parts (${row.partNumber})`)
        continue
      }

      try {
        // Check if part already exists
        const existingPart = await prisma.masterPart.findUnique({
          where: { partNumber: row.partNumber }
        })

        if (existingPart) {
          // Update existing part
          await prisma.masterPart.update({
            where: { partNumber: row.partNumber },
            data: {
              baseName: row.baseName,
              description: row.description || null,
              unit: (row.partType === 'Extrusion') ? 'IN' : (row.unit || null),
              cost: (row.partType === 'Extrusion') ? null : (row.cost ? parseFloat(row.cost) : null),
              partType: row.partType,
              category: row.category || null,
              orientation: (row.partType === 'Extrusion') ? (row.orientation || null) : null,
              isOption: (row.partType === 'Hardware') ? (row.isOption === 'TRUE' || row.isOption === 'true') : false
            }
          })
          updated++
        } else {
          // Create new part
          await prisma.masterPart.create({
            data: {
              partNumber: row.partNumber,
              baseName: row.baseName,
              description: row.description || null,
              unit: (row.partType === 'Extrusion') ? 'IN' : (row.unit || null),
              cost: (row.partType === 'Extrusion') ? null : (row.cost ? parseFloat(row.cost) : null),
              partType: row.partType,
              category: row.category || null,
              orientation: (row.partType === 'Extrusion') ? (row.orientation || null) : null,
              isOption: (row.partType === 'Hardware') ? (row.isOption === 'TRUE' || row.isOption === 'true') : false
            }
          })
          imported++
        }
      } catch (error) {
        console.error(`Error importing row ${i + 2}:`, error)
        errors.push(`Row ${i + 2}: Failed to import - ${row.partNumber}`)
      }
    }

    // Return results
    const response: any = { imported, updated }
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
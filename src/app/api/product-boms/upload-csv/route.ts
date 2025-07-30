import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const csvFile = formData.get('csvFile') as File
    const productId = parseInt(formData.get('productId') as string)

    if (!csvFile) {
      return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
    }

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
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
    if (!headers.includes('partNumber')) {
      return NextResponse.json({ 
        error: 'CSV must include a "partNumber" column' 
      }, { status: 400 })
    }
    if (!headers.includes('quantity')) {
      return NextResponse.json({ 
        error: 'CSV must include a "quantity" column' 
      }, { status: 400 })
    }

    // Parse data rows
    const dataRows = lines.slice(1)
    let imported = 0
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

      // Skip if no part number
      if (!row.partNumber || row.partNumber.trim() === '') {
        errors.push(`Row ${i + 2}: Missing part number`)
        continue
      }

      // Skip if no quantity
      if (!row.quantity || row.quantity.trim() === '') {
        errors.push(`Row ${i + 2}: Missing quantity`)
        continue
      }

      try {
        // Look up the master part
        const masterPart = await prisma.masterPart.findFirst({
          where: { partNumber: row.partNumber }
        })

        if (!masterPart) {
          errors.push(`Row ${i + 2}: Part number ${row.partNumber} not found in Master Parts`)
          continue
        }

        // Skip Glass parts
        if (masterPart.partType === 'Glass') {
          skipped.push(`Row ${i + 2}: Glass parts skipped - use product options instead (${masterPart.baseName})`)
          continue
        }

        // Create the BOM entry using master part data
        await prisma.productBOM.create({
          data: {
            productId: productId,
            partType: masterPart.partType,
            partName: masterPart.baseName,
            description: masterPart.description || null,
            formula: row.formula || null,
            variable: null,
            unit: masterPart.unit || null,
            quantity: parseFloat(row.quantity),
            stockLength: null,
            partNumber: masterPart.partNumber,
            cost: masterPart.cost || null
          }
        })
        imported++
      } catch (error) {
        console.error(`Error importing row ${i + 2}:`, error)
        errors.push(`Row ${i + 2}: Failed to import - ${row.partNumber}`)
      }
    }

    // Return results
    const response: any = { imported }
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
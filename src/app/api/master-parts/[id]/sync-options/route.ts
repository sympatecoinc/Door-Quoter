import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    // Get the master part
    const masterPart = await prisma.masterPart.findUnique({
      where: { id }
    })

    if (!masterPart) {
      return NextResponse.json({ error: 'Master part not found' }, { status: 404 })
    }

    if (!masterPart.isOption) {
      return NextResponse.json({ 
        error: 'Master part is not marked as an option' 
      }, { status: 400 })
    }

    // Find all IndividualOptions that were likely created from this master part
    // We match by the pattern "PART-NUMBER - BASE-NAME" in the description
    const descriptionPattern = `${masterPart.partNumber} - `
    
    const relatedOptions = await prisma.individualOption.findMany({
      where: {
        description: {
          startsWith: descriptionPattern
        }
      },
      include: {
        category: true
      }
    })

    // Update each related option with current master part data
    const updatePromises = relatedOptions.map(option => 
      prisma.individualOption.update({
        where: { id: option.id },
        data: {
          name: masterPart.baseName,
          description: `${masterPart.partNumber} - ${masterPart.baseName}`
        },
        include: {
          category: true
        }
      })
    )

    const updatedOptions = await Promise.all(updatePromises)

    return NextResponse.json({
      message: `Synchronized ${updatedOptions.length} option(s) with master part data`,
      masterPart,
      updatedOptions
    })

  } catch (error) {
    console.error('Error syncing master part with options:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
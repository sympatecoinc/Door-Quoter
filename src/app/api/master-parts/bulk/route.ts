import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // Validate all IDs are numbers
    const validIds = ids.filter(id => typeof id === 'number' && !isNaN(id))
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
    }

    // Get all master parts to find their part numbers for cascading deletes
    const masterParts = await prisma.masterPart.findMany({
      where: { id: { in: validIds } },
      select: { id: true, partNumber: true }
    })

    if (masterParts.length === 0) {
      return NextResponse.json({ error: 'No master parts found with the provided IDs' }, { status: 404 })
    }

    const partNumbers = masterParts.map(mp => mp.partNumber)
    const foundIds = masterParts.map(mp => mp.id)

    // Delete related IndividualOptions (category options) that match these part numbers
    const deletedOptions = await prisma.individualOption.deleteMany({
      where: {
        partNumber: { in: partNumbers }
      }
    })

    // Delete related ProductBOM entries that use these part numbers
    const deletedBOMs = await prisma.productBOM.deleteMany({
      where: {
        partNumber: { in: partNumbers }
      }
    })

    // Delete the master parts themselves
    const deletedParts = await prisma.masterPart.deleteMany({
      where: { id: { in: foundIds } }
    })

    return NextResponse.json({
      message: `Successfully deleted ${deletedParts.count} master part(s)`,
      deletedCount: deletedParts.count,
      relatedOptionsDeleted: deletedOptions.count,
      relatedBOMsDeleted: deletedBOMs.count
    })
  } catch (error) {
    console.error('Error bulk deleting master parts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

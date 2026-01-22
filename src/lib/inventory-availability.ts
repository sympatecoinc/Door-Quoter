/**
 * Inventory Availability Checking
 *
 * Functions for checking part availability considering reserved quantities
 */

import { prisma } from '@/lib/prisma'

export interface PartAvailabilityInput {
  partNumber: string
  partName: string
  quantity: number
  masterPartId?: number | null
}

export interface AvailabilityResult {
  partNumber: string
  partName: string
  required: number
  available: number
  reserved: number
  onHand: number
  shortage: number
  masterPartId?: number | null
  binLocation?: string | null
}

/**
 * Check availability for a list of parts
 * Available = qtyOnHand - qtyReserved
 */
export async function checkAvailability(parts: PartAvailabilityInput[]): Promise<AvailabilityResult[]> {
  const results: AvailabilityResult[] = []

  // Group parts by base part number (without finish code and stock length)
  // to aggregate quantities needed
  const partQuantities = new Map<string, {
    partNumber: string
    partName: string
    totalRequired: number
    masterPartId?: number | null
  }>()

  for (const part of parts) {
    // Extract base part number (remove finish code and stock length suffix)
    const basePartNumber = extractBasePartNumber(part.partNumber)

    if (partQuantities.has(basePartNumber)) {
      const existing = partQuantities.get(basePartNumber)!
      existing.totalRequired += part.quantity
    } else {
      partQuantities.set(basePartNumber, {
        partNumber: part.partNumber,
        partName: part.partName,
        totalRequired: part.quantity,
        masterPartId: part.masterPartId
      })
    }
  }

  // Check availability for each unique part
  for (const [basePartNumber, partInfo] of partQuantities) {
    // Look up the master part by base part number
    const masterPart = await prisma.masterPart.findFirst({
      where: {
        OR: [
          { partNumber: basePartNumber },
          { id: partInfo.masterPartId ?? undefined }
        ]
      },
      include: {
        binLocationRef: true
      }
    })

    const onHand = masterPart?.qtyOnHand ?? 0
    const reserved = masterPart?.qtyReserved ?? 0
    const available = Math.max(0, onHand - reserved)
    const shortage = Math.max(0, partInfo.totalRequired - available)

    results.push({
      partNumber: partInfo.partNumber,
      partName: partInfo.partName,
      required: partInfo.totalRequired,
      available,
      reserved,
      onHand,
      shortage,
      masterPartId: masterPart?.id ?? partInfo.masterPartId,
      binLocation: masterPart?.binLocationRef?.code ?? null
    })
  }

  return results
}

/**
 * Check if all parts have sufficient availability
 */
export async function checkAllAvailable(parts: PartAvailabilityInput[]): Promise<{
  allAvailable: boolean
  shortages: AvailabilityResult[]
  availability: AvailabilityResult[]
}> {
  const availability = await checkAvailability(parts)
  const shortages = availability.filter(a => a.shortage > 0)

  return {
    allAvailable: shortages.length === 0,
    shortages,
    availability
  }
}

/**
 * Extract base part number from full part number
 * Removes finish code (e.g., -BL, -C2) and stock length suffix (e.g., -144)
 */
function extractBasePartNumber(fullPartNumber: string): string {
  // Common finish codes to remove
  const finishCodes = ['-BL', '-C2', '-AL', '-AN', '-MF']

  let baseNumber = fullPartNumber

  // Remove finish code if present
  for (const code of finishCodes) {
    if (baseNumber.includes(code)) {
      baseNumber = baseNumber.replace(code, '')
      break
    }
  }

  // Remove trailing stock length suffix (e.g., -144, -192)
  // Pattern: dash followed by numbers at the end
  baseNumber = baseNumber.replace(/-\d+$/, '')

  return baseNumber
}

/**
 * Get available quantity for a single part
 */
export async function getPartAvailability(partNumber: string): Promise<{
  available: number
  onHand: number
  reserved: number
  binLocation?: string | null
}> {
  const basePartNumber = extractBasePartNumber(partNumber)

  const masterPart = await prisma.masterPart.findUnique({
    where: { partNumber: basePartNumber },
    include: { binLocationRef: true }
  })

  if (!masterPart) {
    return { available: 0, onHand: 0, reserved: 0, binLocation: null }
  }

  const onHand = masterPart.qtyOnHand ?? 0
  const reserved = masterPart.qtyReserved ?? 0

  return {
    available: Math.max(0, onHand - reserved),
    onHand,
    reserved,
    binLocation: masterPart.binLocationRef?.code ?? null
  }
}

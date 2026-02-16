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
  partType?: string
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

// Cached finish codes from the database
let _finishCodesCache: string[] | null = null

async function getFinishCodes(): Promise<string[]> {
  if (!_finishCodesCache) {
    const finishes = await prisma.extrusionFinishPricing.findMany({
      where: { finishCode: { not: null } },
      select: { finishCode: true }
    })
    _finishCodesCache = finishes
      .map(f => f.finishCode!)
      .filter(Boolean)
      // Sort longest first so longer codes match before shorter substrings
      .sort((a, b) => b.length - a.length)
  }
  return _finishCodesCache
}

/**
 * Extract base part number from full extrusion part number.
 * Removes finish code (e.g., -BLA, -C2) and stock length suffix (e.g., -99, -144).
 * Uses finish codes from the database to avoid substring matching issues.
 *
 * For non-extrusions, returns the part number as-is since non-extrusion part numbers
 * don't have finish/length suffixes appended by the BOM.
 */
export async function extractBasePartNumber(fullPartNumber: string, isExtrusion: boolean = false): Promise<string> {
  if (!isExtrusion) {
    return fullPartNumber
  }

  const finishCodes = await getFinishCodes()

  // Try to strip -{finishCode}-{digits} from the end
  for (const code of finishCodes) {
    const pattern = new RegExp(`-${code}-(\\d+)$`, 'i')
    if (pattern.test(fullPartNumber)) {
      return fullPartNumber.replace(pattern, '')
    }
  }

  // No finish code found — might be mill finish: just strip trailing -digits (stock length)
  return fullPartNumber.replace(/-\d+$/, '')
}

/**
 * Find the specific ExtrusionVariant matching a full extrusion part number.
 * Instead of parsing the part number, queries all variants for the master part
 * and matches by reconstructing the expected part number suffix from variant data.
 */
export async function findExtrusionVariant(
  fullPartNumber: string,
  masterPartId: number
): Promise<{ id: number; qtyOnHand: number; qtyReserved: number } | null> {
  const variants = await prisma.extrusionVariant.findMany({
    where: { masterPartId },
    select: {
      id: true,
      qtyOnHand: true,
      qtyReserved: true,
      stockLength: true,
      finishPricing: { select: { finishCode: true } }
    }
  })

  for (const variant of variants) {
    const finishCode = variant.finishPricing?.finishCode
    // Stock length in DB is a float (e.g., 99.0); part numbers use integer form (99)
    const lengthStr = String(Math.round(variant.stockLength))

    let expectedSuffix: string
    if (finishCode) {
      expectedSuffix = `-${finishCode}-${lengthStr}`
    } else {
      expectedSuffix = `-${lengthStr}`
    }

    if (fullPartNumber.endsWith(expectedSuffix)) {
      return { id: variant.id, qtyOnHand: variant.qtyOnHand, qtyReserved: variant.qtyReserved }
    }
  }

  return null
}

/**
 * Check availability for a list of parts
 * Available = qtyOnHand - qtyReserved
 *
 * For extrusions: checks per-variant inventory (ExtrusionVariant.qtyOnHand/qtyReserved)
 * For non-extrusions: checks MasterPart inventory (MasterPart.qtyOnHand/qtyReserved)
 */
export async function checkAvailability(parts: PartAvailabilityInput[]): Promise<AvailabilityResult[]> {
  const results: AvailabilityResult[] = []

  // Group parts by grouping key
  // Extrusions: use full part number (variants are NOT interchangeable)
  // Non-extrusions: use part number as-is (no stripping needed)
  const partQuantities = new Map<string, {
    partNumber: string
    partName: string
    totalRequired: number
    masterPartId?: number | null
    isExtrusion: boolean
  }>()

  for (const part of parts) {
    const isExtrusion = part.partType?.toLowerCase() === 'extrusion'
    const groupKey = part.partNumber

    if (partQuantities.has(groupKey)) {
      const existing = partQuantities.get(groupKey)!
      existing.totalRequired += part.quantity
    } else {
      partQuantities.set(groupKey, {
        partNumber: part.partNumber,
        partName: part.partName,
        totalRequired: part.quantity,
        masterPartId: part.masterPartId,
        isExtrusion
      })
    }
  }

  // Check availability for each unique part/variant
  for (const [_groupKey, partInfo] of partQuantities) {
    const isExtrusion = partInfo.isExtrusion
    const basePartNumber = await extractBasePartNumber(partInfo.partNumber, isExtrusion)

    // Look up the master part — only include id clause when masterPartId is set
    const orConditions: any[] = [{ partNumber: basePartNumber }]
    if (partInfo.masterPartId) {
      orConditions.push({ id: partInfo.masterPartId })
    }

    const masterPart = await prisma.masterPart.findFirst({
      where: { OR: orConditions },
      include: { binLocationRef: true }
    })

    let onHand = 0
    let reserved = 0

    if (isExtrusion && masterPart) {
      // For extrusions: look up the specific variant's inventory
      const variant = await findExtrusionVariant(partInfo.partNumber, masterPart.id)
      if (variant) {
        onHand = variant.qtyOnHand
        reserved = variant.qtyReserved
      }
    } else {
      // For non-extrusions: use MasterPart inventory
      onHand = masterPart?.qtyOnHand ?? 0
      reserved = masterPart?.qtyReserved ?? 0
    }

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
 * Get available quantity for a single part
 */
export async function getPartAvailability(partNumber: string, partType?: string): Promise<{
  available: number
  onHand: number
  reserved: number
  binLocation?: string | null
}> {
  const isExtrusion = partType?.toLowerCase() === 'extrusion'
  const basePartNumber = await extractBasePartNumber(partNumber, isExtrusion)

  const masterPart = await prisma.masterPart.findUnique({
    where: { partNumber: basePartNumber },
    include: { binLocationRef: true }
  })

  if (!masterPart) {
    return { available: 0, onHand: 0, reserved: 0, binLocation: null }
  }

  // For extrusions, check the specific variant
  if (isExtrusion) {
    const variant = await findExtrusionVariant(partNumber, masterPart.id)
    if (variant) {
      const onHand = variant.qtyOnHand
      const reserved = variant.qtyReserved
      return {
        available: Math.max(0, onHand - reserved),
        onHand,
        reserved,
        binLocation: masterPart.binLocationRef?.code ?? null
      }
    }
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

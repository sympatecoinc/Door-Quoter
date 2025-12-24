'use client'

import { useState } from 'react'
import { Package, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { ExtrusionVariantGroup, ExtrusionVariantDisplay, FinishOption, ExtrusionFinishPricing } from '@/types'

interface ExtrusionVariantCardProps {
  group: ExtrusionVariantGroup
  finishPricing: ExtrusionFinishPricing[]
  materialPricePerLb: number
  onEditVariant: (variant: ExtrusionVariantDisplay) => void
  onAddVariant: (masterPartId: number, stockLength: number, finishPricingId: number | null) => void
}

// Helper to display inches
function inchesDisplay(inches: number): string {
  return `${inches}"`
}

// Get cell background color based on stock status
function getStockStatusColor(status: string): string {
  switch (status) {
    case 'in_stock':
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    case 'low_stock':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    case 'out_of_stock':
      return 'bg-red-100 text-red-800 hover:bg-red-200'
    default:
      return 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  }
}

// Calculate base price per foot
function calculateBasePricePerFoot(
  weightPerFoot: number | null | undefined,
  customPricePerLb: number | null | undefined,
  globalPricePerLb: number
): number | null {
  if (!weightPerFoot) return null
  const pricePerLb = customPricePerLb ?? globalPricePerLb
  return weightPerFoot * pricePerLb
}

// Calculate finish price per foot (base + finish cost)
function calculateFinishPrice(
  basePricePerFoot: number | null,
  finishCostPerFoot: number
): number | null {
  if (basePricePerFoot === null) return null
  return basePricePerFoot + finishCostPerFoot
}

export default function ExtrusionVariantCard({
  group,
  finishPricing,
  materialPricePerLb,
  onEditVariant,
  onAddVariant
}: ExtrusionVariantCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const { masterPart, variants, lengths, finishes: allFinishes } = group

  // If isMillFinish is true, only show Mill Finish (id: null)
  const finishes = masterPart.isMillFinish
    ? allFinishes.filter(f => f.id === null)
    : allFinishes

  // Calculate base price per foot for this extrusion
  const basePricePerFoot = calculateBasePricePerFoot(
    masterPart.weightPerFoot,
    masterPart.customPricePerLb,
    materialPricePerLb
  )

  // Create a map of finish ID to finish pricing for quick lookup
  const finishPricingMap = new Map<number, ExtrusionFinishPricing>()
  finishPricing.forEach(fp => finishPricingMap.set(fp.id, fp))

  // Create a lookup map for quick variant access
  const variantMap = new Map<string, ExtrusionVariantDisplay>()
  variants.forEach(v => {
    const key = `${v.stockLength}-${v.finishPricingId ?? 'null'}`
    variantMap.set(key, v)
  })

  // Get variant for a specific length and finish
  const getVariant = (length: number, finishId: number | null): ExtrusionVariantDisplay | undefined => {
    const key = `${length}-${finishId ?? 'null'}`
    return variantMap.get(key)
  }

  // If no variants exist yet, show empty state
  if (variants.length === 0 && lengths.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900">{masterPart.partNumber}</h3>
              <p className="text-sm text-gray-600">{masterPart.baseName}</p>
            </div>
          </div>
        </div>
        <div className="p-6 text-center text-gray-500">
          <p>No stock lengths defined for this extrusion.</p>
          <p className="text-sm mt-1">Add stock lengths in Master Parts to track inventory.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-semibold text-gray-900">{masterPart.partNumber}</h3>
              <p className="text-sm text-gray-600">{masterPart.baseName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Pricing Info */}
            {basePricePerFoot !== null && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg" title="Base price per foot">
                <DollarSign className="h-3.5 w-3.5 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  ${basePricePerFoot.toFixed(2)}/ft
                </span>
              </div>
            )}
            {masterPart.weightPerFoot && (
              <span className="text-xs text-gray-400" title="Weight per foot">
                {masterPart.weightPerFoot.toFixed(2)} lb/ft
              </span>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {masterPart.description && (
          <p className="mt-2 text-sm text-gray-500 truncate">{masterPart.description}</p>
        )}
      </div>

      {/* Grid */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Length
                </th>
                {finishes.map(finish => {
                  // Get the finish pricing for this finish
                  const fp = finish.id ? finishPricingMap.get(finish.id) : null
                  const finishCost = fp?.costPerFoot ?? 0
                  const totalPricePerFoot = calculateFinishPrice(basePricePerFoot, finishCost)

                  return (
                    <th
                      key={finish.id ?? 'mill'}
                      className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b min-w-[80px]"
                    >
                      {finish.name}
                      {finish.code && (
                        <span className="block text-[10px] text-gray-400 normal-case">
                          ({finish.code})
                        </span>
                      )}
                      {totalPricePerFoot !== null && (
                        <span className="block text-[10px] text-green-600 font-semibold normal-case">
                          ${totalPricePerFoot.toFixed(2)}/ft
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {lengths.map((length, idx) => (
                <tr key={length} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-sm font-medium text-gray-900 border-b whitespace-nowrap">
                    {inchesDisplay(length)}
                  </td>
                  {finishes.map(finish => {
                    const variant = getVariant(length, finish.id)
                    return (
                      <td key={finish.id ?? 'mill'} className="px-2 py-2 border-b">
                        {variant ? (
                          <button
                            onClick={() => onEditVariant(variant)}
                            className={`w-full px-2 py-1.5 rounded text-sm font-medium transition-colors cursor-pointer ${getStockStatusColor(variant.stockStatus)}`}
                            title={`${variant.qtyOnHand} pcs${variant.binLocation ? ` - Bin: ${variant.binLocation}` : ''}`}
                          >
                            {variant.qtyOnHand}
                          </button>
                        ) : (
                          <button
                            onClick={() => onAddVariant(masterPart.id, length, finish.id)}
                            className="w-full px-2 py-1.5 text-center text-gray-300 text-sm rounded hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                            title={`Add ${inchesDisplay(length)} ${finish.name} variant`}
                          >
                            +
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

'use client'

import { DoorOpen } from 'lucide-react'

interface OpeningProduct {
  id: number
  name: string
  productType: string
  width: number
  height: number
}

interface Opening {
  id: number
  name: string
  openingType: string | null
  roughWidth: number | null
  roughHeight: number | null
  finishedWidth: number | null
  finishedHeight: number | null
  finishColor: string | null
  finishCode: string | null
  products: OpeningProduct[]
}

interface OpeningSummaryPanelProps {
  openings: Opening[]
}

function formatDim(value: number | null): string {
  if (value === null) return '-'
  return `${value}"`
}

function getProductTypeShort(productType: string): string {
  const labels: Record<string, string> = {
    'SWING_DOOR': 'Swing',
    'SLIDING_DOOR': 'Slide',
    'FIXED_PANEL': 'Fixed',
    'CORNER_90': '90°',
    'FRAME': 'Frame'
  }
  return labels[productType] || productType
}

export default function OpeningSummaryPanel({ openings }: OpeningSummaryPanelProps) {
  if (openings.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <DoorOpen className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No openings configured</p>
      </div>
    )
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200">
          <th className="text-left py-1.5 pr-2">Opening</th>
          <th className="text-left py-1.5 px-2">Components</th>
          <th className="text-right py-1.5 pl-2">Size</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {openings.map(opening => {
          const isThinwall = opening.openingType === 'THINWALL'

          // For thinwall, show finished dimensions only
          // For trimmed/framed, show rough dimensions
          const displayWidth = isThinwall ? opening.finishedWidth : opening.roughWidth
          const displayHeight = isThinwall ? opening.finishedHeight : opening.roughHeight

          return (
            <tr key={opening.id} className="hover:bg-gray-50">
              {/* Opening name with color code and type badges */}
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-900">{opening.name}</span>
                  {opening.finishCode && (
                    <span className="px-1 py-0.5 bg-gray-200 text-gray-700 rounded text-[9px] font-semibold">
                      {opening.finishCode}
                    </span>
                  )}
                  {opening.openingType && (
                    <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${
                      isThinwall
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isThinwall ? 'TW' : 'TR'}
                    </span>
                  )}
                </div>
              </td>

              {/* Components with sizes */}
              <td className="py-1.5 px-2">
                <div className="flex flex-wrap gap-1">
                  {opening.products.map((product, idx) => (
                    <span
                      key={`${product.id}-${idx}`}
                      className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-gray-100 rounded text-[10px]"
                      title={product.name}
                    >
                      <span className="font-medium text-gray-700">
                        {getProductTypeShort(product.productType)}
                      </span>
                      <span className="text-gray-500">
                        {product.width}"×{product.height}"
                      </span>
                    </span>
                  ))}
                  {opening.products.length === 0 && (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </td>

              {/* Opening size */}
              <td className="py-1.5 pl-2 text-right whitespace-nowrap">
                <span className="font-mono text-gray-900 font-medium">
                  {formatDim(displayWidth)}×{formatDim(displayHeight)}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

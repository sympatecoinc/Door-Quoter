'use client'

import { useState, useEffect } from 'react'
import { X, Search, Package, Ruler } from 'lucide-react'
import { BinLocation, MasterPartSummary, ExtrusionVariantSummary } from '@/types/bin-location'

interface BinItemsModalProps {
  binLocation: BinLocation
  onClose: () => void
}

export default function BinItemsModal({ binLocation, onClose }: BinItemsModalProps) {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [masterParts, setMasterParts] = useState<MasterPartSummary[]>([])
  const [extrusionVariants, setExtrusionVariants] = useState<ExtrusionVariantSummary[]>([])

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          ...(search && { search })
        })

        const response = await fetch(`/api/bin-locations/${binLocation.id}/items?${params}`)
        if (!response.ok) throw new Error('Failed to fetch items')

        const data = await response.json()
        setMasterParts(data.masterParts)
        setExtrusionVariants(data.extrusionVariants)
      } catch (error) {
        console.error('Error fetching bin items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchItems()
  }, [binLocation.id, search])

  const totalItems = masterParts.length + extrusionVariants.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Items in {binLocation.code}
            </h2>
            <p className="text-sm text-gray-500">{binLocation.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading items...</div>
          ) : totalItems === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {search ? 'No items match your search' : 'No items in this bin location'}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Master Parts */}
              {masterParts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Parts ({masterParts.length})
                  </h3>
                  <div className="space-y-2">
                    {masterParts.map((part) => (
                      <div
                        key={part.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{part.partNumber}</p>
                          <p className="text-sm text-gray-600">{part.baseName}</p>
                          <span className="text-xs text-gray-500">{part.partType}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {part.qtyOnHand ?? 0}
                          </p>
                          <p className="text-xs text-gray-500">in stock</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extrusion Variants */}
              {extrusionVariants.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Extrusion Variants ({extrusionVariants.length})
                  </h3>
                  <div className="space-y-2">
                    {extrusionVariants.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {variant.masterPart.partNumber}
                          </p>
                          <p className="text-sm text-gray-600">
                            {variant.masterPart.baseName}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {variant.stockLength / 12}ft
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                              {variant.finishPricing?.finishType || 'Mill Finish'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {variant.qtyOnHand}
                          </p>
                          <p className="text-xs text-gray-500">pieces</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50 flex-shrink-0">
          <p className="text-sm text-gray-600">
            {totalItems} item{totalItems !== 1 ? 's' : ''} total
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

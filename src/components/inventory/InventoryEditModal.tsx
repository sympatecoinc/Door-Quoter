'use client'

import { useState, useEffect } from 'react'
import { X, Save, Package } from 'lucide-react'

interface BinLocation {
  id: number
  code: string
  name: string
  isActive: boolean
}

interface Vendor {
  id: number
  displayName: string
  category?: string | null
}

interface InventoryPart {
  id: number
  partNumber: string
  baseName: string
  description?: string | null
  partType: string
  unit?: string | null
  cost?: number | null
  salePrice?: number | null
  qtyOnHand?: number | null
  qtyReserved?: number | null
  binLocation?: string | null
  reorderPoint?: number | null
  reorderQty?: number | null
  vendorId?: number | null
  vendor?: Vendor | null
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface Props {
  part: InventoryPart
  vendors: Vendor[]
  onClose: () => void
  onSave: (updatedPart: InventoryPart) => void
}

export default function InventoryEditModal({ part, vendors, onClose, onSave }: Props) {
  const [cost, setCost] = useState(part.cost?.toString() ?? '')
  const [salePrice, setSalePrice] = useState(part.salePrice?.toString() ?? '')
  const [qtyOnHand, setQtyOnHand] = useState(part.qtyOnHand?.toString() ?? '0')
  const [binLocation, setBinLocation] = useState(part.binLocation ?? '')
  const [reorderPoint, setReorderPoint] = useState(part.reorderPoint?.toString() ?? '')
  const [reorderQty, setReorderQty] = useState(part.reorderQty?.toString() ?? '')
  const [vendorId, setVendorId] = useState(part.vendorId?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [binLocations, setBinLocations] = useState<BinLocation[]>([])
  const [loadingBinLocations, setLoadingBinLocations] = useState(true)

  // Fetch bin locations on mount
  useEffect(() => {
    async function fetchBinLocations() {
      try {
        const response = await fetch('/api/bin-locations?limit=100&isActive=true')
        if (response.ok) {
          const data = await response.json()
          setBinLocations(data.binLocations || [])
        }
      } catch (err) {
        console.error('Failed to fetch bin locations:', err)
      } finally {
        setLoadingBinLocations(false)
      }
    }
    fetchBinLocations()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/inventory/${part.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost: cost ? parseFloat(cost) : null,
          salePrice: salePrice ? parseFloat(salePrice) : null,
          qtyOnHand: parseFloat(qtyOnHand) || 0,
          binLocation: binLocation.trim() || null,
          reorderPoint: reorderPoint ? parseFloat(reorderPoint) : null,
          reorderQty: reorderQty ? parseFloat(reorderQty) : null,
          vendorId: vendorId ? parseInt(vendorId) : null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update inventory')
      }

      const updatedPart = await response.json()
      onSave(updatedPart)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Inventory</h2>
              <p className="text-sm text-gray-500">{part.partNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Part Info with Quantity */}
          {(() => {
            const qty = parseFloat(qtyOnHand) || 0
            const reorder = parseFloat(reorderPoint) || 0
            let bgColor = 'bg-gray-50'

            if (reorder > 0) {
              if (qty < reorder) {
                bgColor = 'bg-red-100'
              } else if (qty <= reorder * 1.2) {
                bgColor = 'bg-yellow-100'
              } else {
                bgColor = 'bg-green-100'
              }
            }

            const reserved = part.qtyReserved ?? 0
            const available = Math.max(0, qty - reserved)

            return (
              <div className={`p-3 rounded-lg ${bgColor}`}>
                <div className="flex justify-between items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-600 mb-1">Part Name</div>
                    <div className="font-medium text-gray-900">{part.baseName}</div>
                    <div className="text-sm text-gray-500 mt-1">Type: {part.partType} | Unit: {part.unit ?? 'N/A'}</div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-[15px]">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">On Hand</div>
                    <input
                      type="number"
                      step="any"
                      value={qtyOnHand}
                      onChange={(e) => setQtyOnHand(e.target.value)}
                      className="w-24 text-3xl font-bold text-gray-900 text-right bg-transparent border-none outline-none focus:ring-0 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                    />
                  </div>
                </div>
                {reserved > 0 && (
                  <div className="flex justify-end gap-6 mt-2 pt-2 border-t border-gray-200/50 text-sm">
                    <div className="text-blue-600">
                      <span className="text-gray-500">Reserved:</span> {reserved}
                    </div>
                    <div className={available > 0 ? 'text-green-600' : 'text-red-600'}>
                      <span className="text-gray-500">Available:</span> {available}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Cost & Sale Price (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost (per unit) <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sale Price <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Fixed price, no markup applied</p>
            </div>
          </div>

          {/* Bin Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bin Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={binLocation}
              onChange={(e) => setBinLocation(e.target.value)}
              disabled={loadingBinLocations}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{loadingBinLocations ? 'Loading...' : 'No bin location'}</option>
              {binLocations.map(bin => (
                <option key={bin.id} value={bin.code}>{bin.code} - {bin.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Physical storage location</p>
          </div>

          {/* Reorder Point & Quantity (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Point <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Alert when qty falls below</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Qty <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={reorderQty}
                onChange={(e) => setReorderQty(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Standard order quantity</p>
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Vendor <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No vendor assigned</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.displayName}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

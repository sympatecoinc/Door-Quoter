'use client'

import { useState, useEffect } from 'react'
import { X, Package } from 'lucide-react'
import { ExtrusionFinishPricing, MasterPart } from '@/types'

interface AddExtrusionVariantModalProps {
  masterPartId: number | null
  masterParts: MasterPart[]
  finishes: ExtrusionFinishPricing[]
  onClose: () => void
  onSave: (data: {
    masterPartId: number
    stockLength: number
    finishPricingId: number | null
    qtyOnHand: number
    binLocation: string | null
    reorderPoint: number | null
    reorderQty: number | null
    pricePerPiece: number | null
  }) => Promise<void>
}

// Common stock lengths in inches
const COMMON_LENGTHS = [
  { value: 96, label: "8ft (96\")" },
  { value: 120, label: "10ft (120\")" },
  { value: 144, label: "12ft (144\")" },
  { value: 168, label: "14ft (168\")" },
  { value: 192, label: "16ft (192\")" },
  { value: 240, label: "20ft (240\")" },
  { value: 288, label: "24ft (288\")" }
]

export default function AddExtrusionVariantModal({
  masterPartId,
  masterParts,
  finishes,
  onClose,
  onSave
}: AddExtrusionVariantModalProps) {
  const [formData, setFormData] = useState({
    masterPartId: masterPartId || '',
    stockLength: '',
    customLength: '',
    finishPricingId: '',
    qtyOnHand: 0,
    binLocation: '',
    reorderPoint: '',
    reorderQty: '',
    pricePerPiece: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (masterPartId) {
      setFormData(prev => ({ ...prev, masterPartId: masterPartId.toString() }))
    }
  }, [masterPartId])

  const selectedPart = masterParts.find(p => p.id === Number(formData.masterPartId))

  // Reset finish selection when switching to a mill-finish-only part
  useEffect(() => {
    if (selectedPart?.isMillFinish && formData.finishPricingId) {
      setFormData(prev => ({ ...prev, finishPricingId: '' }))
    }
  }, [selectedPart?.isMillFinish, formData.finishPricingId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Determine stock length
    let stockLength = Number(formData.stockLength)
    if (formData.stockLength === 'custom') {
      stockLength = Number(formData.customLength)
    }

    if (!formData.masterPartId || !stockLength) {
      setError('Please select an extrusion and stock length')
      return
    }

    setSaving(true)

    try {
      await onSave({
        masterPartId: Number(formData.masterPartId),
        stockLength,
        finishPricingId: formData.finishPricingId ? Number(formData.finishPricingId) : null,
        qtyOnHand: Number(formData.qtyOnHand),
        binLocation: formData.binLocation || null,
        reorderPoint: formData.reorderPoint ? Number(formData.reorderPoint) : null,
        reorderQty: formData.reorderQty ? Number(formData.reorderQty) : null,
        pricePerPiece: formData.pricePerPiece ? Number(formData.pricePerPiece) : null
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Add Extrusion Variant</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            {/* Extrusion Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extrusion Profile *
              </label>
              <select
                value={formData.masterPartId}
                onChange={(e) => setFormData({ ...formData, masterPartId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!!masterPartId}
              >
                <option value="">Select an extrusion...</option>
                {masterParts.map(part => (
                  <option key={part.id} value={part.id}>
                    {part.partNumber} - {part.baseName}
                  </option>
                ))}
              </select>
              {selectedPart && (
                <p className="mt-1 text-sm text-gray-500">{selectedPart.description}</p>
              )}
            </div>

            {/* Stock Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock Length *
              </label>
              <select
                value={formData.stockLength}
                onChange={(e) => setFormData({ ...formData, stockLength: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select length...</option>
                {COMMON_LENGTHS.map(len => (
                  <option key={len.value} value={len.value}>
                    {len.label}
                  </option>
                ))}
                <option value="custom">Custom length...</option>
              </select>
              {formData.stockLength === 'custom' && (
                <input
                  type="number"
                  value={formData.customLength}
                  onChange={(e) => setFormData({ ...formData, customLength: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Length in inches"
                  min="1"
                  step="1"
                />
              )}
            </div>

            {/* Finish - Hide when isMillFinish is true */}
            {!selectedPart?.isMillFinish && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Finish / Color
                </label>
                <select
                  value={formData.finishPricingId}
                  onChange={(e) => setFormData({ ...formData, finishPricingId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Mill Finish (no color)</option>
                  {finishes.map(finish => (
                    <option key={finish.id} value={finish.id}>
                      {finish.finishType}
                      {finish.finishCode && ` (${finish.finishCode})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Initial Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Quantity
              </label>
              <input
                type="number"
                value={formData.qtyOnHand}
                onChange={(e) => setFormData({ ...formData, qtyOnHand: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                step="1"
              />
            </div>

            {/* Bin Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bin Location
              </label>
              <input
                type="text"
                value={formData.binLocation}
                onChange={(e) => setFormData({ ...formData, binLocation: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., A-1-3"
              />
            </div>

            {/* Reorder Point & Qty */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Point
                </label>
                <input
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => setFormData({ ...formData, reorderPoint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="1"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reorder Qty
                </label>
                <input
                  type="number"
                  value={formData.reorderQty}
                  onChange={(e) => setFormData({ ...formData, reorderQty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="1"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Price Per Piece */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price Per Piece ($)
              </label>
              <input
                type="number"
                value={formData.pricePerPiece}
                onChange={(e) => setFormData({ ...formData, pricePerPiece: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Variant'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

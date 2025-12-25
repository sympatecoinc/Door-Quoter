'use client'

import { useState, useEffect } from 'react'
import { X, Package, Trash2 } from 'lucide-react'
import { ExtrusionVariantDisplay } from '@/types'

interface ExtrusionVariantEditModalProps {
  variant: ExtrusionVariantDisplay | null
  onClose: () => void
  onSave: (id: number, data: Partial<ExtrusionVariantDisplay>) => Promise<void>
  onDelete?: (id: number) => Promise<void>
}

// Helper to convert inches to display feet
function inchesToFeetDisplay(inches: number): string {
  const feet = inches / 12
  return `${feet}ft`
}

export default function ExtrusionVariantEditModal({
  variant,
  onClose,
  onSave,
  onDelete
}: ExtrusionVariantEditModalProps) {
  const [formData, setFormData] = useState({
    qtyOnHand: 0,
    binLocation: '',
    reorderPoint: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (variant) {
      setFormData({
        qtyOnHand: variant.qtyOnHand ?? 0,
        binLocation: variant.binLocation ?? '',
        reorderPoint: variant.reorderPoint?.toString() ?? '',
        notes: variant.notes ?? ''
      })
    }
  }, [variant])

  if (!variant) return null

  const finishName = variant.finishPricing?.finishType || 'Mill'
  const lengthDisplay = inchesToFeetDisplay(variant.stockLength)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      await onSave(variant.id, {
        qtyOnHand: Number(formData.qtyOnHand),
        binLocation: formData.binLocation || null,
        reorderPoint: formData.reorderPoint ? Number(formData.reorderPoint) : null,
        notes: formData.notes || null
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirm(`Are you sure you want to remove this variant (${lengthDisplay} ${finishName})?`)) return

    setDeleting(true)
    try {
      await onDelete(variant.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
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
              <div>
                <h2 className="font-semibold text-gray-900">Edit Variant</h2>
                <p className="text-sm text-gray-500">
                  {lengthDisplay} - {finishName}
                </p>
              </div>
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

            {/* Part Info (read-only) */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {variant.masterPart?.partNumber}
              </p>
              <p className="text-sm text-gray-500">
                {variant.masterPart?.baseName}
              </p>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity on Hand
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

            {/* Safety Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Safety Stock
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

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
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
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

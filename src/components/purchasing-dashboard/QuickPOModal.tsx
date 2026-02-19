'use client'

import { useState, useEffect } from 'react'
import { X, Package, AlertCircle, ShoppingCart, ExternalLink, Loader2, Plus, FileText } from 'lucide-react'
import type { InventoryAlert, QuickPOResponse, DraftPO, AddToExistingPOResponse } from './types'
import { useAppStore } from '@/stores/appStore'

interface Vendor {
  id: number
  displayName: string
}

type POMode = 'create' | 'addToExisting'

interface QuickPOModalProps {
  alert: InventoryAlert
  onClose: () => void
  onSuccess: () => void
}

export default function QuickPOModal({ alert, onClose, onSuccess }: QuickPOModalProps) {
  const { setCurrentMenu, setSelectedPOId } = useAppStore()
  const [mode, setMode] = useState<POMode>('create')
  const [quantity, setQuantity] = useState<number>(
    alert.shortage > 0 ? alert.shortage : (alert.reorderQty || 1)
  )
  const [vendorId, setVendorId] = useState<number | null>(alert.vendorId)
  const [notes, setNotes] = useState<string>('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPO, setCreatedPO] = useState<QuickPOResponse['purchaseOrder'] | null>(null)
  const [addedToPO, setAddedToPO] = useState<boolean>(false)

  // Add to existing PO state
  const [draftPOs, setDraftPOs] = useState<DraftPO[]>([])
  const [selectedPO, setSelectedPO] = useState<number | null>(null)
  const [loadingDraftPOs, setLoadingDraftPOs] = useState(false)

  useEffect(() => {
    fetchVendors()
  }, [])

  // Fetch draft POs when vendor changes and mode is addToExisting
  useEffect(() => {
    if (mode === 'addToExisting' && vendorId) {
      fetchDraftPOs(vendorId)
    } else {
      setDraftPOs([])
      setSelectedPO(null)
    }
  }, [mode, vendorId])

  async function fetchVendors() {
    try {
      const response = await fetch('/api/vendors?limit=100')
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  async function fetchDraftPOs(vendorIdParam: number) {
    setLoadingDraftPOs(true)
    try {
      const response = await fetch(`/api/purchase-orders?vendorId=${vendorIdParam}&status=DRAFT&limit=50`)
      if (response.ok) {
        const data = await response.json()
        const drafts: DraftPO[] = (data.purchaseOrders || []).map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber,
          vendorName: po.vendor?.displayName || 'Unknown',
          totalAmount: po.totalAmount || 0,
          lineCount: po._count?.lines || po.lines?.length || 0,
          createdAt: po.createdAt
        }))
        setDraftPOs(drafts)
        // Auto-select if only one draft
        if (drafts.length === 1) {
          setSelectedPO(drafts[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching draft POs:', error)
    } finally {
      setLoadingDraftPOs(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'addToExisting' && selectedPO) {
        // Add line to existing PO
        const response = await fetch(`/api/purchase-orders/${selectedPO}/add-line`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterPartId: alert.partId,
            quantity,
            notes: notes || undefined,
            variantId: alert.variantId || undefined
          })
        })

        const result: AddToExistingPOResponse = await response.json()

        if (!response.ok) {
          throw new Error((result as any).error || 'Failed to add to purchase order')
        }

        setCreatedPO(result.purchaseOrder)
        setAddedToPO(true)
      } else {
        // Create new PO
        const response = await fetch('/api/purchase-orders/quick-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterPartId: alert.partId,
            quantity,
            vendorId: vendorId || undefined,
            notes: notes || undefined,
            variantId: alert.variantId || undefined
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create purchase order')
        }

        setCreatedPO(result.purchaseOrder)
        setAddedToPO(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Success state
  if (createdPO) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {addedToPO ? 'Line Added Successfully' : 'PO Created Successfully'}
            </h2>
            <p className="text-gray-600 mb-4">
              {addedToPO
                ? `Item added to ${createdPO.poNumber} for ${createdPO.vendorName}`
                : `${createdPO.poNumber} has been created as a draft for ${createdPO.vendorName}`
              }
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">PO Number:</span>
                <span className="font-medium">{createdPO.poNumber}</span>
                <span className="text-gray-500">Vendor:</span>
                <span className="font-medium">{createdPO.vendorName}</span>
                <span className="text-gray-500">Status:</span>
                <span className="font-medium">{createdPO.status}</span>
                <span className="text-gray-500">Total:</span>
                <span className="font-medium">${createdPO.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedPOId(createdPO.id)
                  setCurrentMenu('purchaseOrders')
                  onClose()
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                View PO <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quick Create PO</h2>
              <p className="text-sm text-gray-500">Create purchase order from inventory alert</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Part Info */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{alert.partNumber}</div>
                <div className="text-sm text-gray-600">{alert.description}</div>
                {alert.category && (
                  <div className="text-xs text-gray-400 mt-1">Category: {alert.category}</div>
                )}
              </div>
            </div>
          </div>

          {/* Demand Breakdown */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Inventory Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500">On Hand</div>
                <div className="text-lg font-bold text-gray-900">{alert.qtyOnHand}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <div className="text-xs text-orange-600">Reserved (SO)</div>
                <div className="text-lg font-bold text-orange-600">-{alert.qtyReserved}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-xs text-blue-600">Projected Demand</div>
                <div className="text-lg font-bold text-blue-600">-{alert.projectedDemand}</div>
              </div>
              <div className={`rounded-lg p-3 ${alert.availableQty < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`text-xs ${alert.availableQty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Available
                </div>
                <div className={`text-lg font-bold ${alert.availableQty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {alert.availableQty}
                </div>
              </div>
            </div>
            {alert.shortage > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">
                  <strong>{alert.shortage}</strong> units short to meet current demand
                </span>
              </div>
            )}
          </div>

          {/* Demand Sources */}
          {alert.demandSources && alert.demandSources.length > 0 && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Demand Sources</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {alert.demandSources.map((source, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        source.type === 'reserved'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {source.type === 'reserved' ? 'Confirmed SO' : 'Pipeline'}
                      </span>
                      <span className="font-medium text-gray-700">{source.projectName}</span>
                    </div>
                    <span className="text-gray-600">{source.quantity} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Quantity */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Order Quantity</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {alert.reorderQty && alert.reorderQty !== quantity && (
                <button
                  type="button"
                  onClick={() => setQuantity(alert.reorderQty!)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium whitespace-nowrap"
                >
                  Use Reorder Qty ({alert.reorderQty})
                </button>
              )}
              {alert.shortage > 0 && alert.shortage !== quantity && (
                <button
                  type="button"
                  onClick={() => setQuantity(alert.shortage)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium whitespace-nowrap"
                >
                  Order Shortage ({alert.shortage})
                </button>
              )}
            </div>
          </div>

          {/* Vendor Selection */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Vendor</h3>
            <select
              value={vendorId || ''}
              onChange={(e) => setVendorId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a vendor...</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.displayName} {v.id === alert.vendorId ? '(Preferred)' : ''}
                </option>
              ))}
            </select>
            {!vendorId && !alert.vendorId && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                This part has no preferred vendor. Please select one.
              </p>
            )}
          </div>

          {/* PO Mode Selection */}
          {vendorId && (
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add To</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    mode === 'create'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-medium">New PO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('addToExisting')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    mode === 'addToExisting'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Existing PO</span>
                </button>
              </div>

              {/* Draft PO Selection */}
              {mode === 'addToExisting' && (
                <div className="mt-4">
                  {loadingDraftPOs ? (
                    <div className="flex items-center justify-center py-4 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading draft POs...
                    </div>
                  ) : draftPOs.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-sm text-gray-500">No draft POs found for this vendor.</p>
                      <button
                        type="button"
                        onClick={() => setMode('create')}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Create a new PO instead
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-sm text-gray-600">Select Draft PO</label>
                      {draftPOs.map(po => (
                        <label
                          key={po.id}
                          className={`block p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedPO === po.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="draftPO"
                              value={po.id}
                              checked={selectedPO === po.id}
                              onChange={() => setSelectedPO(po.id)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{po.poNumber}</div>
                              <div className="text-sm text-gray-500">
                                {po.lineCount} item{po.lineCount !== 1 ? 's' : ''} · ${po.totalAmount.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Notes (Optional)</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this purchase order..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !vendorId || (mode === 'addToExisting' && !selectedPO)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'addToExisting' ? 'Adding...' : 'Creating...'}
                </>
              ) : mode === 'addToExisting' ? (
                <>
                  <Plus className="w-4 h-4" />
                  Add to PO
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  Create Draft PO
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

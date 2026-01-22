'use client'

import { useState } from 'react'
import {
  X,
  AlertTriangle,
  CheckCircle,
  Package,
  Loader2
} from 'lucide-react'
import { SalesOrder, PartAvailability } from '@/types/sales-order'

interface SOConfirmModalProps {
  salesOrder: SalesOrder
  onClose: () => void
  onConfirm: () => void
}

export default function SOConfirmModal({ salesOrder, onClose, onConfirm }: SOConfirmModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availability, setAvailability] = useState<PartAvailability[] | null>(null)
  const [shortages, setShortages] = useState<PartAvailability[]>([])
  const [confirming, setConfirming] = useState(false)

  const checkAvailability = async () => {
    setCheckingAvailability(true)
    setError(null)

    try {
      // Call confirm endpoint without force to get availability info
      const response = await fetch(`/api/sales-orders/${salesOrder.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      })

      const data = await response.json()

      if (data.requiresConfirmation) {
        // Has shortages - show them
        setAvailability(data.availability)
        setShortages(data.shortages || [])
      } else if (data.success) {
        // No shortages - order was confirmed
        onConfirm()
      } else {
        setError(data.error || 'Failed to check availability')
      }
    } catch (err) {
      setError('Failed to check availability')
    } finally {
      setCheckingAvailability(false)
    }
  }

  const confirmOrder = async (forceConfirm: boolean = false) => {
    setConfirming(true)
    setError(null)

    try {
      const response = await fetch(`/api/sales-orders/${salesOrder.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceConfirm })
      })

      const data = await response.json()

      if (data.success) {
        onConfirm()
      } else if (data.requiresConfirmation) {
        setAvailability(data.availability)
        setShortages(data.shortages || [])
      } else {
        setError(data.error || 'Failed to confirm order')
      }
    } catch (err) {
      setError('Failed to confirm order')
    } finally {
      setConfirming(false)
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
              <h2 className="text-lg font-semibold text-gray-900">Confirm Sales Order</h2>
              <p className="text-sm text-gray-500">{salesOrder.orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Initial state - explain what will happen */}
          {!availability && !error && (
            <div className="space-y-4">
              <p className="text-gray-600">
                Confirming this order will:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                <li>Generate parts list from the project BOM</li>
                <li>Reserve inventory for all parts</li>
                <li>Update order status to CONFIRMED</li>
                {salesOrder.customer.quickbooksId && (
                  <li>Create a QuickBooks Estimate</li>
                )}
              </ul>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmOrder(false)}
                  disabled={confirming || checkingAvailability}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {confirming || checkingAvailability ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Order
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Shortages detected - show availability info */}
          {availability && shortages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Insufficient Inventory</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Some parts have insufficient stock. You can still confirm the order, but these parts will be marked as pending.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Parts with Shortages:</h3>
                <div className="max-h-60 overflow-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Part</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Required</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Available</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Short</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {shortages.map((item, index) => (
                        <tr key={index} className="text-gray-700">
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.partNumber}</div>
                            <div className="text-xs text-gray-500">{item.partName}</div>
                          </td>
                          <td className="px-3 py-2 text-right">{item.required}</td>
                          <td className="px-3 py-2 text-right">{item.available}</td>
                          <td className="px-3 py-2 text-right text-red-600 font-medium">
                            -{item.shortage}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmOrder(true)}
                  disabled={confirming}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirm Anyway
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !availability && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => confirmOrder(false)}
                  disabled={confirming}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

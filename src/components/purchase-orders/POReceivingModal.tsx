'use client'

import { useState } from 'react'
import { PurchaseOrder, PurchaseOrderLine } from '@/types/purchase-order'
import {
  X,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Printer,
  Download
} from 'lucide-react'

interface POReceivingModalProps {
  purchaseOrder: PurchaseOrder
  onClose: () => void
  onComplete: () => void
}

interface ReceivingLineData {
  purchaseOrderLineId: number
  quantityReceived: number
  quantityDamaged: number
  quantityRejected: number
  notes: string
}

export default function POReceivingModal({ purchaseOrder, onClose, onComplete }: POReceivingModalProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [qualityNotes, setQualityNotes] = useState('')
  const [totalBoxes, setTotalBoxes] = useState(1)
  const [receivingLines, setReceivingLines] = useState<ReceivingLineData[]>(
    purchaseOrder.lines
      ?.filter(line => (line.quantityRemaining ?? line.quantity) > 0)
      .map(line => ({
        purchaseOrderLineId: line.id,
        quantityReceived: line.quantityRemaining ?? line.quantity,
        quantityDamaged: 0,
        quantityRejected: 0,
        notes: ''
      })) || []
  )

  function handleLineChange(lineId: number, field: keyof ReceivingLineData, value: number | string) {
    setReceivingLines(prev => prev.map(line =>
      line.purchaseOrderLineId === lineId
        ? { ...line, [field]: value }
        : line
    ))
  }

  function getLineById(lineId: number): PurchaseOrderLine | undefined {
    return purchaseOrder.lines?.find(l => l.id === lineId)
  }

  function getMaxReceivable(lineId: number): number {
    const line = getLineById(lineId)
    if (!line) return 0
    return line.quantityRemaining ?? line.quantity
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const linesToSubmit = receivingLines.filter(line =>
      line.quantityReceived > 0 || line.quantityDamaged > 0 || line.quantityRejected > 0
    )

    if (linesToSubmit.length === 0) {
      setError('Please enter receiving quantities for at least one item')
      return
    }

    // Validate quantities
    for (const line of linesToSubmit) {
      const maxQty = getMaxReceivable(line.purchaseOrderLineId)
      const totalQty = line.quantityReceived + line.quantityDamaged + line.quantityRejected
      if (totalQty > maxQty) {
        const poLine = getLineById(line.purchaseOrderLineId)
        setError(`Total quantity for "${poLine?.description || 'item'}" exceeds remaining quantity`)
        return
      }
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || null,
          qualityNotes: qualityNotes || null,
          lines: linesToSubmit
        })
      })

      if (response.ok) {
        onComplete()
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to record receiving')
      }
    } catch {
      setError('Failed to record receiving')
    } finally {
      setSaving(false)
    }
  }

  const totalReceiving = receivingLines.reduce((sum, line) => sum + line.quantityReceived, 0)
  const totalDamaged = receivingLines.reduce((sum, line) => sum + line.quantityDamaged, 0)
  const totalRejected = receivingLines.reduce((sum, line) => sum + line.quantityRejected, 0)

  function handlePrintTags() {
    const url = `/api/purchase-orders/${purchaseOrder.id}/receiving-tags?boxes=${totalBoxes}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Receive Items</h2>
              <p className="text-sm text-gray-500">{purchaseOrder.poNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Items to Receive
              </label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Item
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-20">
                        Remaining
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                        <span className="flex items-center justify-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          Received
                        </span>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                        <span className="flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-yellow-500" />
                          Damaged
                        </span>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-24">
                        <span className="flex items-center justify-center gap-1">
                          <X className="w-3 h-3 text-red-500" />
                          Rejected
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {receivingLines.map(receivingLine => {
                      const poLine = getLineById(receivingLine.purchaseOrderLineId)
                      if (!poLine) return null
                      const maxQty = getMaxReceivable(receivingLine.purchaseOrderLineId)

                      return (
                        <tr key={receivingLine.purchaseOrderLineId}>
                          <td className="px-3 py-3">
                            <div className="font-medium text-gray-900">
                              {poLine.quickbooksItem?.name || poLine.description || 'Unnamed Item'}
                            </div>
                            {poLine.quickbooksItem?.sku && (
                              <div className="text-xs text-gray-500 font-mono">
                                {poLine.quickbooksItem.sku}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-sm font-medium text-gray-900">{maxQty}</span>
                            <span className="text-xs text-gray-500 ml-1">/ {poLine.quantity}</span>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              max={maxQty}
                              value={receivingLine.quantityReceived}
                              onChange={(e) => handleLineChange(
                                receivingLine.purchaseOrderLineId,
                                'quantityReceived',
                                Math.min(Number(e.target.value), maxQty)
                              )}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              max={maxQty}
                              value={receivingLine.quantityDamaged}
                              onChange={(e) => handleLineChange(
                                receivingLine.purchaseOrderLineId,
                                'quantityDamaged',
                                Math.min(Number(e.target.value), maxQty)
                              )}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              max={maxQty}
                              value={receivingLine.quantityRejected}
                              onChange={(e) => handleLineChange(
                                receivingLine.purchaseOrderLineId,
                                'quantityRejected',
                                Math.min(Number(e.target.value), maxQty)
                              )}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr className="font-medium">
                      <td className="px-3 py-2 text-right text-sm text-gray-700">
                        Totals:
                      </td>
                      <td></td>
                      <td className="px-3 py-2 text-center text-sm text-green-700">
                        {totalReceiving}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-yellow-700">
                        {totalDamaged}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-red-700">
                        {totalRejected}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Receiving Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="General notes about this receiving..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Notes
                </label>
                <textarea
                  value={qualityNotes}
                  onChange={(e) => setQualityNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notes about quality issues..."
                />
              </div>
            </div>

            {/* Print Box Tags */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <Printer className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Print Box Tags</span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Print tags to place inside received boxes. Each tag shows the PO number, vendor, and items.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="totalBoxes" className="text-sm text-gray-700">
                    Number of boxes:
                  </label>
                  <input
                    id="totalBoxes"
                    type="number"
                    min="1"
                    max="99"
                    value={totalBoxes}
                    onChange={(e) => setTotalBoxes(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePrintTags}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Tags ({totalBoxes} {totalBoxes === 1 ? 'page' : 'pages'})
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-500">
            {totalReceiving > 0 && (
              <span className="text-green-600 font-medium">{totalReceiving} items to receive</span>
            )}
            {totalDamaged > 0 && (
              <span className="text-yellow-600 font-medium ml-3">{totalDamaged} damaged</span>
            )}
            {totalRejected > 0 && (
              <span className="text-red-600 font-medium ml-3">{totalRejected} rejected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || totalReceiving + totalDamaged + totalRejected === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Record Receiving
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

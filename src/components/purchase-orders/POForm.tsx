'use client'

import { useState, useEffect } from 'react'
import { PurchaseOrder, PurchaseOrderLine } from '@/types/purchase-order'
import { Vendor } from '@/types'
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2
} from 'lucide-react'

interface POFormProps {
  purchaseOrder?: PurchaseOrder | null
  onClose: () => void
  onSave: (po?: PurchaseOrder, warning?: string) => void
}

interface InventoryItem {
  id: number
  partNumber: string
  baseName: string
  description?: string | null
  unitCost?: number | null
  partType?: string | null
  vendor?: { id: number; displayName: string } | null
}

interface LineItemFormData {
  id?: number
  quickbooksItemId?: number | null
  masterPartId?: number | null
  description: string
  quantity: number
  unitPrice: number
}

export default function POForm({ purchaseOrder, onClose, onSave }: POFormProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [searchingItems, setSearchingItems] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [showItemDropdown, setShowItemDropdown] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [vendorId, setVendorId] = useState<number | null>(purchaseOrder?.vendorId || null)
  const [txnDate, setTxnDate] = useState(
    purchaseOrder?.txnDate
      ? new Date(purchaseOrder.txnDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [expectedDate, setExpectedDate] = useState(
    purchaseOrder?.expectedDate
      ? new Date(purchaseOrder.expectedDate).toISOString().split('T')[0]
      : ''
  )
  const [memo, setMemo] = useState(purchaseOrder?.memo || '')
  const [privateNote, setPrivateNote] = useState(purchaseOrder?.privateNote || '')
  const [lines, setLines] = useState<LineItemFormData[]>(
    purchaseOrder?.lines?.map(l => ({
      id: l.id,
      quickbooksItemId: l.quickbooksItemId,
      masterPartId: (l as any).masterPartId || null,
      description: l.description || '',
      quantity: l.quantity,
      unitPrice: l.unitPrice
    })) || [{ description: '', quantity: 1, unitPrice: 0 }]
  )

  // Shipping address
  const [shipAddrLine1, setShipAddrLine1] = useState(purchaseOrder?.shipAddrLine1 || '')
  const [shipAddrLine2, setShipAddrLine2] = useState(purchaseOrder?.shipAddrLine2 || '')
  const [shipAddrCity, setShipAddrCity] = useState(purchaseOrder?.shipAddrCity || '')
  const [shipAddrState, setShipAddrState] = useState(purchaseOrder?.shipAddrState || '')
  const [shipAddrZip, setShipAddrZip] = useState(purchaseOrder?.shipAddrZip || '')

  useEffect(() => {
    fetchVendors()
    fetchInventoryItems()
  }, [])

  async function fetchVendors() {
    try {
      const response = await fetch('/api/vendors?active=true&limit=500')
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch (err) {
      console.error('Error fetching vendors:', err)
    }
  }

  async function fetchInventoryItems(search?: string) {
    setSearchingItems(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/inventory?${params}`)
      if (response.ok) {
        const data = await response.json()
        setInventoryItems(data.parts || [])
      }
    } catch (err) {
      console.error('Error fetching inventory:', err)
    } finally {
      setSearchingItems(false)
    }
  }

  function handleAddLine() {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function handleRemoveLine(index: number) {
    setLines(lines.filter((_, i) => i !== index))
  }

  function handleLineChange(index: number, field: keyof LineItemFormData, value: any) {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  function handleSelectItem(index: number, item: InventoryItem) {
    const newLines = [...lines]
    newLines[index] = {
      ...newLines[index],
      masterPartId: item.id,
      quickbooksItemId: null,
      description: `${item.partNumber} - ${item.baseName}`,
      unitPrice: item.unitCost || 0
    }
    setLines(newLines)
    setShowItemDropdown(null)
    setItemSearch('')

    // Auto-set vendor if part has a vendor and no vendor is selected
    if (!vendorId && item.vendor?.id) {
      setVendorId(item.vendor.id)
    }
  }

  function calculateSubtotal(): number {
    return lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!vendorId) {
      setError('Please select a vendor')
      return
    }

    if (lines.length === 0 || lines.every(l => !l.description && !l.quickbooksItemId)) {
      setError('Please add at least one line item')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const subtotal = calculateSubtotal()
      const payload = {
        vendorId,
        txnDate,
        expectedDate: expectedDate || null,
        memo: memo || null,
        privateNote: privateNote || null,
        shipAddrLine1: shipAddrLine1 || null,
        shipAddrLine2: shipAddrLine2 || null,
        shipAddrCity: shipAddrCity || null,
        shipAddrState: shipAddrState || null,
        shipAddrZip: shipAddrZip || null,
        subtotal,
        totalAmount: subtotal,
        lines: lines.filter(l => l.description || l.masterPartId).map((line, idx) => ({
          id: line.id,
          lineNum: idx + 1,
          masterPartId: line.masterPartId || null,
          quickbooksItemId: line.quickbooksItemId || null,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.quantity * line.unitPrice
        }))
      }

      const url = purchaseOrder
        ? `/api/purchase-orders/${purchaseOrder.id}`
        : '/api/purchase-orders'

      const response = await fetch(url, {
        method: purchaseOrder ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        // API returns { purchaseOrder: {...}, warning?: "..." }
        const savedPO = data.purchaseOrder || data
        const warning = data.warning
        onSave(savedPO, warning)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to save purchase order')
      }
    } catch (err) {
      setError('Failed to save purchase order')
    } finally {
      setSaving(false)
    }
  }

  // Filter items: by vendor (if selected), then by search term
  const filteredItems = inventoryItems.filter(item => {
    // If vendor is selected, only show parts for that vendor (or parts with no vendor)
    if (vendorId && item.vendor?.id && item.vendor.id !== vendorId) {
      return false
    }

    // Then filter by search term
    if (!itemSearch) return true
    return (
      item.partNumber.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.baseName.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.description?.toLowerCase().includes(itemSearch.toLowerCase())
    )
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {purchaseOrder ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Vendor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorId || ''}
                onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a vendor...</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.displayName}
                    {vendor.companyName && vendor.companyName !== vendor.displayName
                      ? ` (${vendor.companyName})`
                      : ''
                    }
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Line Items <span className="text-red-500">*</span>
              </label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/2">
                        Item / Description
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                        Unit Price
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">
                        Amount
                      </th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 relative">
                          <div className="relative">
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => {
                                handleLineChange(index, 'description', e.target.value)
                                setItemSearch(e.target.value)
                                setShowItemDropdown(index)
                              }}
                              onFocus={() => setShowItemDropdown(index)}
                              placeholder="Search items or enter description..."
                              className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {showItemDropdown === index && filteredItems.length > 0 && (
                              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {filteredItems.map(item => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectItem(index, item)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-gray-900">{item.baseName}</div>
                                      <div className="text-xs text-gray-500 font-mono">{item.partNumber}</div>
                                    </div>
                                    {item.unitCost != null && (
                                      <span className="text-sm text-gray-600">
                                        ${item.unitCost.toFixed(2)}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleLineChange(index, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => handleLineChange(index, 'unitPrice', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          ${(line.quantity * line.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(index)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={5} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={handleAddLine}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                          Add Line
                        </button>
                      </td>
                    </tr>
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={3} className="px-3 py-3 text-right font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-gray-900">
                        ${calculateSubtotal().toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Shipping Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ship To Address
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={shipAddrLine1}
                  onChange={(e) => setShipAddrLine1(e.target.value)}
                  placeholder="Address Line 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shipAddrLine2}
                  onChange={(e) => setShipAddrLine2(e.target.value)}
                  placeholder="Address Line 2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shipAddrCity}
                  onChange={(e) => setShipAddrCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={shipAddrState}
                    onChange={(e) => setShipAddrState(e.target.value)}
                    placeholder="State"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={shipAddrZip}
                    onChange={(e) => setShipAddrZip(e.target.value)}
                    placeholder="ZIP"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Memo (visible to vendor)
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Notes visible on the purchase order..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Private Notes
                </label>
                <textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Internal notes (not visible to vendor)..."
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {purchaseOrder ? 'Update' : 'Create'} Purchase Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

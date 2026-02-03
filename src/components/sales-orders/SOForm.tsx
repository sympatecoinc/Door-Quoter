'use client'

import { useState, useEffect } from 'react'
import { SalesOrder, SalesOrderFormData } from '@/types/sales-order'
import { X, Plus, Trash2, Search } from 'lucide-react'

interface Customer {
  id: number
  companyName: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  quickbooksId?: string | null
}

interface SOFormProps {
  salesOrder?: SalesOrder | null
  onClose: () => void
  onSave: (so?: SalesOrder, warning?: string) => void
  prefilledProjectId?: number | null
}

interface LineItem {
  itemRefId?: string | null
  itemRefName?: string | null
  description: string
  quantity: number
  unitPrice: number
}

// Skeleton component for loading states
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export default function SOForm({ salesOrder, onClose, onSave, prefilledProjectId }: SOFormProps) {
  const isEditing = !!salesOrder

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState<number | null>(salesOrder?.customerId || null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [projectId, setProjectId] = useState<number | null>(salesOrder?.projectId || prefilledProjectId || null)
  const [loading, setLoading] = useState(!!prefilledProjectId && !isEditing)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [txnDate, setTxnDate] = useState(
    salesOrder?.txnDate
      ? new Date(salesOrder.txnDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [dueDate, setDueDate] = useState(
    salesOrder?.dueDate
      ? new Date(salesOrder.dueDate).toISOString().split('T')[0]
      : ''
  )
  const [shipDate, setShipDate] = useState(
    salesOrder?.shipDate
      ? new Date(salesOrder.shipDate).toISOString().split('T')[0]
      : ''
  )
  const [customerMemo, setCustomerMemo] = useState(salesOrder?.customerMemo || '')
  const [privateNote, setPrivateNote] = useState(salesOrder?.privateNote || '')
  const [billAddrLine1, setBillAddrLine1] = useState(salesOrder?.billAddrLine1 || '')
  const [billAddrCity, setBillAddrCity] = useState(salesOrder?.billAddrCity || '')
  const [billAddrState, setBillAddrState] = useState(salesOrder?.billAddrState || '')
  const [billAddrPostalCode, setBillAddrPostalCode] = useState(salesOrder?.billAddrPostalCode || '')
  const [shipAddrLine1, setShipAddrLine1] = useState(salesOrder?.shipAddrLine1 || '')
  const [shipAddrCity, setShipAddrCity] = useState(salesOrder?.shipAddrCity || '')
  const [shipAddrState, setShipAddrState] = useState(salesOrder?.shipAddrState || '')
  const [shipAddrPostalCode, setShipAddrPostalCode] = useState(salesOrder?.shipAddrPostalCode || '')
  const [lines, setLines] = useState<LineItem[]>(
    salesOrder?.lines.map(l => ({
      itemRefId: l.itemRefId,
      itemRefName: l.itemRefName,
      description: l.description || '',
      quantity: l.quantity,
      unitPrice: l.unitPrice
    })) || [{ description: '', quantity: 1, unitPrice: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')

  // Fetch data on mount - run in parallel for speed
  useEffect(() => {
    const fetchData = async () => {
      const promises: Promise<void>[] = []

      // Always fetch customers (for non-prefilled projects or editing)
      promises.push(
        fetch('/api/customers?status=Active&limit=500')
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) setCustomers(data.customers || data)
          })
          .catch(err => console.error('Error fetching customers:', err))
          .finally(() => setLoadingCustomers(false))
      )

      // Fetch quote data if we have a prefilled project
      if (prefilledProjectId && !isEditing) {
        promises.push(
          fetch(`/api/projects/${prefilledProjectId}/quote-cache`)
            .then(async res => {
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || 'Failed to load quote data. Please generate a quote first.')
              }
              return res.json()
            })
            .then(quoteData => {
              if (!quoteData.quoteItems || quoteData.quoteItems.length === 0) {
                throw new Error('No quote items found. Please generate a quote first.')
              }

              const project = quoteData.project

              // Set customer from project
              if (project?.customerId) {
                setCustomerId(project.customerId)
                if (project.customer) {
                  setSelectedCustomer(project.customer)
                  // Pre-fill billing address
                  setBillAddrLine1(project.customer.address || '')
                  setBillAddrCity(project.customer.city || '')
                  setBillAddrState(project.customer.state || '')
                  setBillAddrPostalCode(project.customer.zipCode || '')
                }
              }

              // Create line items from quote
              const projectLines: LineItem[] = quoteData.quoteItems.map((item: any) => ({
                description: `${project?.name || 'Project'} - ${item.name}`,
                quantity: 1,
                unitPrice: item.price || 0
              }))
              setLines(projectLines)
            })
            .catch(err => {
              console.error('Error fetching quote data:', err)
              setError(err.message || 'Failed to load quote data')
            })
            .finally(() => setLoading(false))
        )
      }

      await Promise.all(promises)
    }

    fetchData()
  }, [prefilledProjectId, isEditing])

  // Update selected customer when customerId changes (for customer dropdown selection)
  useEffect(() => {
    if (customerId && customers.length > 0 && !selectedCustomer) {
      const customer = customers.find(c => c.id === customerId)
      if (customer) {
        setSelectedCustomer(customer)
        if (!isEditing && !prefilledProjectId) {
          // Pre-fill billing address only for manual customer selection
          setBillAddrLine1(customer.address || '')
          setBillAddrCity(customer.city || '')
          setBillAddrState(customer.state || '')
          setBillAddrPostalCode(customer.zipCode || '')
        }
      }
    }
  }, [customerId, customers])

  function addLine() {
    setLines([...lines, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function removeLine(index: number) {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  function updateLine(index: number, field: keyof LineItem, value: any) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    setLines(updated)
  }

  function calculateTotal() {
    return lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!customerId) {
      setError('Please select a customer')
      return
    }

    if (lines.length === 0 || lines.every(l => !l.description && l.unitPrice === 0)) {
      setError('Please add at least one line item')
      return
    }

    setSaving(true)

    try {
      const formData: SalesOrderFormData = {
        customerId,
        projectId: projectId || undefined,
        txnDate,
        dueDate: dueDate || undefined,
        shipDate: shipDate || undefined,
        customerMemo: customerMemo || undefined,
        privateNote: privateNote || undefined,
        billAddrLine1: billAddrLine1 || undefined,
        billAddrCity: billAddrCity || undefined,
        billAddrState: billAddrState || undefined,
        billAddrPostalCode: billAddrPostalCode || undefined,
        shipAddrLine1: shipAddrLine1 || undefined,
        shipAddrCity: shipAddrCity || undefined,
        shipAddrState: shipAddrState || undefined,
        shipAddrPostalCode: shipAddrPostalCode || undefined,
        lines: lines.filter(l => l.description || l.unitPrice > 0)
      }

      const url = isEditing ? `/api/sales-orders/${salesOrder.id}` : '/api/sales-orders'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save sales order')
      }

      onSave(data.salesOrder, data.warning)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save sales order')
    } finally {
      setSaving(false)
    }
  }

  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.companyName.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.contactName?.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? `Edit Sales Order ${salesOrder.orderNumber}` : 'New Sales Order'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Customer Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer *
            </label>
            {loading ? (
              <Skeleton className="h-11 w-full" />
            ) : !isEditing && prefilledProjectId && selectedCustomer ? (
              <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                <span className="font-medium">{selectedCustomer.companyName}</span>
                {selectedCustomer.contactName && (
                  <span className="text-gray-500"> ({selectedCustomer.contactName})</span>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={customerId || ''}
                  onChange={(e) => setCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                  className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">{loadingCustomers ? 'Loading customers...' : 'Select a customer'}</option>
                  {filteredCustomers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName}
                      {customer.contactName ? ` (${customer.contactName})` : ''}
                      {!customer.quickbooksId && ' [Not in QB]'}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ship Date
              </label>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Billing Address</h3>
              {loading ? (
                <>
                  <Skeleton className="h-10 w-full mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Address"
                    value={billAddrLine1}
                    onChange={(e) => setBillAddrLine1(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={billAddrCity}
                      onChange={(e) => setBillAddrCity(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={billAddrState}
                      onChange={(e) => setBillAddrState(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Zip"
                      value={billAddrPostalCode}
                      onChange={(e) => setBillAddrPostalCode(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Shipping Address</h3>
              {loading ? (
                <>
                  <Skeleton className="h-10 w-full mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Address"
                    value={shipAddrLine1}
                    onChange={(e) => setShipAddrLine1(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="City"
                      value={shipAddrCity}
                      onChange={(e) => setShipAddrCity(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={shipAddrState}
                      onChange={(e) => setShipAddrState(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Zip"
                      value={shipAddrPostalCode}
                      onChange={(e) => setShipAddrPostalCode(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Line Items</h3>
              <button
                type="button"
                onClick={addLine}
                disabled={loading}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Line
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Amount</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    // Skeleton loading rows
                    [1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td className="px-3 py-2"><Skeleton className="h-8 w-full" /></td>
                        <td className="px-3 py-2"><Skeleton className="h-8 w-full" /></td>
                        <td className="px-3 py-2"><Skeleton className="h-8 w-full" /></td>
                        <td className="px-3 py-2"><Skeleton className="h-8 w-full" /></td>
                        <td className="px-3 py-2"><Skeleton className="h-8 w-8" /></td>
                      </tr>
                    ))
                  ) : (
                    lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(index, 'description', e.target.value)}
                            placeholder="Item description"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="1"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          ${(line.quantity * line.unitPrice).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            disabled={lines.length === 1}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-700">Total:</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      {loading ? <Skeleton className="h-5 w-20 ml-auto" /> : `$${calculateTotal().toFixed(2)}`}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Memo
              </label>
              <textarea
                value={customerMemo}
                onChange={(e) => setCustomerMemo(e.target.value)}
                rows={3}
                placeholder="Visible to customer on invoice"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Private Note
              </label>
              <textarea
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                rows={3}
                placeholder="Internal use only"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Sales Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { PurchaseOrder, POStatus, PO_STATUS_CONFIG, PurchaseOrderLine } from '@/types/purchase-order'
import POStatusBadge from './POStatusBadge'
import POReceivingModal from './POReceivingModal'
import {
  ArrowLeft,
  Edit2,
  Printer,
  Send,
  Package,
  Building,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Truck,
  RefreshCw,
  Cloud,
  MoreVertical,
  XCircle,
  Pause,
  Play
} from 'lucide-react'

interface PODetailViewProps {
  poId: number
  onBack: () => void
  onEdit: (po: PurchaseOrder) => void
  onRefresh: () => void
}

export default function PODetailView({ poId, onBack, onEdit, onRefresh }: PODetailViewProps) {
  const [po, setPO] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReceivingModal, setShowReceivingModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    fetchPO()
  }, [poId])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  async function fetchPO() {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${poId}`)
      if (response.ok) {
        const data = await response.json()
        setPO(data.purchaseOrder)
      } else {
        setError('Failed to load purchase order')
      }
    } catch (err) {
      setError('Failed to load purchase order')
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncToQB() {
    if (!po) return
    setSyncing(true)
    try {
      const response = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...po, syncToQuickBooks: true })
      })

      if (response.ok) {
        const data = await response.json()
        setPO(data.purchaseOrder)
        setNotification({ type: 'success', message: 'Synced to QuickBooks successfully' })
      } else {
        const err = await response.json()
        setNotification({ type: 'error', message: err.error || 'Failed to sync to QuickBooks' })
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to sync to QuickBooks' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleStatusChange(newStatus: POStatus) {
    if (!po) return
    setStatusMenuOpen(false)

    try {
      const response = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        const data = await response.json()
        setPO(data.purchaseOrder)
        setNotification({ type: 'success', message: `Status updated to ${PO_STATUS_CONFIG[newStatus].label}` })
        onRefresh()
      } else {
        const err = await response.json()
        setNotification({ type: 'error', message: err.error || 'Failed to update status' })
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to update status' })
    }
  }

  function handleReceivingComplete() {
    setShowReceivingModal(false)
    fetchPO()
    onRefresh()
    setNotification({ type: 'success', message: 'Receiving recorded successfully' })
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  function formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  function getAvailableStatusTransitions(currentStatus: POStatus): POStatus[] {
    const transitions: Record<POStatus, POStatus[]> = {
      DRAFT: ['SENT', 'CANCELLED'],
      SENT: ['ACKNOWLEDGED', 'CANCELLED', 'ON_HOLD'],
      ACKNOWLEDGED: ['PARTIAL', 'COMPLETE', 'CANCELLED', 'ON_HOLD'],
      PARTIAL: ['COMPLETE', 'CANCELLED', 'ON_HOLD'],
      COMPLETE: [],
      CANCELLED: ['DRAFT'],
      ON_HOLD: ['SENT', 'ACKNOWLEDGED', 'CANCELLED']
    }
    return transitions[currentStatus] || []
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="h-8 w-48 bg-gray-200 rounded" />
          </div>
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <div className="h-6 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-64 bg-gray-100 rounded" />
            <div className="h-4 w-48 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Purchase Orders
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-800">{error || 'Purchase order not found'}</p>
        </div>
      </div>
    )
  }

  const availableTransitions = getAvailableStatusTransitions(po.status)
  const canReceive = ['SENT', 'ACKNOWLEDGED', 'PARTIAL'].includes(po.status)
  const hasUnreceivedItems = po.lines?.some(line => (line.quantityRemaining ?? line.quantity) > 0)

  return (
    <div className="p-6">
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">{po.poNumber}</h1>
              <POStatusBadge status={po.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Created {formatDate(po.createdAt)}
              {po.quickbooksId && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                  <Cloud className="w-3 h-3" /> Synced to QB
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync to QB */}
          {!po.quickbooksId && po.status !== 'DRAFT' && (
            <button
              onClick={handleSyncToQB}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              Sync to QB
            </button>
          )}

          {/* Receive Items */}
          {canReceive && hasUnreceivedItems && (
            <button
              onClick={() => setShowReceivingModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Truck className="w-4 h-4" />
              Receive Items
            </button>
          )}

          {/* Status Change Menu */}
          {availableTransitions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Change Status
                <MoreVertical className="w-4 h-4" />
              </button>
              {statusMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {availableTransitions.map(status => {
                    const config = PO_STATUS_CONFIG[status]
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${config.bgColor}`} />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Edit (only for DRAFT) */}
          {po.status === 'DRAFT' && (
            <button
              onClick={() => onEdit(po)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}

          {/* Print */}
          <button
            onClick={() => window.open(`/api/purchase-orders/${po.id}/pdf`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-400" />
              Vendor
            </h2>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{po.vendor.displayName}</h3>
                {po.vendor.companyName && po.vendor.companyName !== po.vendor.displayName && (
                  <p className="text-sm text-gray-500">{po.vendor.companyName}</p>
                )}
                {po.vendor.primaryEmail && (
                  <p className="text-sm text-gray-600 mt-1">{po.vendor.primaryEmail}</p>
                )}
                {po.vendor.primaryPhone && (
                  <p className="text-sm text-gray-600">{po.vendor.primaryPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Line Items ({po.lines?.length || 0})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Received</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {po.lines?.map((line, index) => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {line.quickbooksItem?.name || line.description || 'Unnamed Item'}
                        </div>
                        {line.description && line.quickbooksItem?.name && line.description !== line.quickbooksItem.name && (
                          <div className="text-sm text-gray-500">{line.description}</div>
                        )}
                        {line.quickbooksItem?.sku && (
                          <div className="text-xs text-gray-400 font-mono">{line.quickbooksItem.sku}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">{line.quantity}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-gray-900">{line.quantityReceived || 0}</div>
                        {line.quantity > (line.quantityReceived || 0) && (
                          <div className="text-xs text-orange-600">
                            {line.quantity - (line.quantityReceived || 0)} pending
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(line.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                      Subtotal
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(po.subtotal)}
                    </td>
                  </tr>
                  {po.taxAmount != null && po.taxAmount > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm text-gray-700">
                        Tax
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(po.taxAmount)}
                      </td>
                    </tr>
                  )}
                  {po.shippingAmount != null && po.shippingAmount > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm text-gray-700">
                        Shipping
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900">
                        {formatCurrency(po.shippingAmount)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={5} className="px-4 py-3 text-right text-base font-bold text-gray-900">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold text-gray-900">
                      {formatCurrency(po.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {(po.memo || po.privateNote) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Notes
              </h2>
              {po.memo && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Memo (visible to vendor)</h3>
                  <p className="text-gray-600">{po.memo}</p>
                </div>
              )}
              {po.privateNote && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Private Notes</h3>
                  <p className="text-gray-600">{po.privateNote}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Dates */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              Dates
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Transaction Date</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(po.txnDate)}</span>
              </div>
              {po.expectedDate && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Expected Delivery</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(po.expectedDate)}</span>
                </div>
              )}
              {po.dueDate && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Due Date</span>
                  <span className="text-sm font-medium text-gray-900">{formatDate(po.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {(po.shipAddrLine1 || po.shipAddrCity) && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400" />
                Ship To
              </h2>
              <div className="text-sm text-gray-600 space-y-1">
                {po.shipAddrLine1 && <p>{po.shipAddrLine1}</p>}
                {po.shipAddrLine2 && <p>{po.shipAddrLine2}</p>}
                {(po.shipAddrCity || po.shipAddrState || po.shipAddrZip) && (
                  <p>
                    {po.shipAddrCity}{po.shipAddrCity && po.shipAddrState ? ', ' : ''}{po.shipAddrState} {po.shipAddrZip}
                  </p>
                )}
                {po.shipAddrCountry && <p>{po.shipAddrCountry}</p>}
              </div>
            </div>
          )}

          {/* Receiving History */}
          {po.receivings && po.receivings.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-gray-400" />
                Receiving History
              </h2>
              <div className="space-y-3">
                {po.receivings.map((receiving) => (
                  <div key={receiving.id} className="border-l-2 border-green-500 pl-3 py-1">
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(receiving.receivedDate)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {receiving.lines?.reduce((sum, l) => sum + l.quantityReceived, 0) || 0} items received
                    </div>
                    {receiving.notes && (
                      <div className="text-xs text-gray-600 mt-1">{receiving.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status History */}
          {po.statusHistory && po.statusHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Status History
              </h2>
              <div className="space-y-3">
                {po.statusHistory.slice(0, 5).map((history) => (
                  <div key={history.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      {history.fromStatus && (
                        <>
                          <span className="text-gray-500">{PO_STATUS_CONFIG[history.fromStatus]?.label}</span>
                          <span className="text-gray-400">→</span>
                        </>
                      )}
                      <span className="font-medium text-gray-900">
                        {PO_STATUS_CONFIG[history.toStatus]?.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(history.changedAt)}
                      {history.changedBy && ` by ${history.changedBy.name}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receiving Modal */}
      {showReceivingModal && (
        <POReceivingModal
          purchaseOrder={po}
          onClose={() => setShowReceivingModal(false)}
          onComplete={handleReceivingComplete}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { SalesOrder } from '@/types/sales-order'
import SOStatusBadge from './SOStatusBadge'
import SOPartsTab from './SOPartsTab'
import SOConfirmModal from './SOConfirmModal'
import {
  ArrowLeft,
  Edit2,
  Building2,
  Calendar,
  MapPin,
  FileText,
  DollarSign,
  User,
  Link,
  Receipt,
  Package,
  CheckCircle,
  ClipboardList
} from 'lucide-react'

interface SODetailViewProps {
  soId: number
  onBack: () => void
  onEdit: (so: SalesOrder) => void
  onRefresh: () => void
  onGenerateInvoice?: (so: SalesOrder) => void
}

type TabType = 'overview' | 'parts' | 'invoices'

export default function SODetailView({ soId, onBack, onEdit, onRefresh, onGenerateInvoice }: SODetailViewProps) {
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  useEffect(() => {
    fetchSalesOrder()
  }, [soId])

  async function fetchSalesOrder() {
    try {
      setLoading(true)
      const response = await fetch(`/api/sales-orders/${soId}`)
      if (response.ok) {
        const data = await response.json()
        setSalesOrder(data)
      }
    } catch (error) {
      console.error('Error fetching sales order:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handleConfirmOrder = () => {
    setShowConfirmModal(false)
    fetchSalesOrder()
    onRefresh()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-3 gap-6">
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!salesOrder) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <div className="text-center py-12 text-gray-500">
          Sales order not found
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{salesOrder.orderNumber}</h1>
              <SOStatusBadge status={salesOrder.status} size="lg" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Confirm Order button for DRAFT orders */}
          {salesOrder.status === 'DRAFT' && salesOrder.projectId && (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Order
            </button>
          )}
          {/* Generate Invoice button - hidden for DRAFT, FULLY_INVOICED, VOIDED, CANCELLED */}
          {salesOrder.status !== 'DRAFT' && salesOrder.status !== 'FULLY_INVOICED' && salesOrder.status !== 'VOIDED' && salesOrder.status !== 'CANCELLED' && onGenerateInvoice && (
            <button
              onClick={async () => {
                setCreatingInvoice(true)
                try {
                  await onGenerateInvoice(salesOrder)
                } finally {
                  setCreatingInvoice(false)
                }
              }}
              disabled={creatingInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Receipt className="w-4 h-4" />
              {creatingInvoice ? 'Creating...' : 'Generate Invoice'}
            </button>
          )}
          {/* Edit button - hidden for VOIDED orders */}
          {salesOrder.status !== 'VOIDED' && (
            <button
              onClick={() => onEdit(salesOrder)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => { if (salesOrder.status !== 'DRAFT') setActiveTab('parts') }}
            disabled={salesOrder.status === 'DRAFT'}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              salesOrder.status === 'DRAFT'
                ? 'border-transparent text-gray-300 cursor-not-allowed'
                : activeTab === 'parts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-4 h-4" />
            Parts
          </button>
          <button
            onClick={() => { if (salesOrder.status !== 'DRAFT') setActiveTab('invoices') }}
            disabled={salesOrder.status === 'DRAFT'}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              salesOrder.status === 'DRAFT'
                ? 'border-transparent text-gray-300 cursor-not-allowed'
                : activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Invoices
            {salesOrder.invoices && salesOrder.invoices.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                {salesOrder.invoices.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Customer Card */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <Building2 className="w-4 h-4" />
                <span className="text-sm font-medium">Customer</span>
              </div>
              <div className="font-semibold text-gray-900">{salesOrder.customer.companyName}</div>
              {salesOrder.customer.contactName && (
                <div className="text-sm text-gray-600 mt-1">{salesOrder.customer.contactName}</div>
              )}
              {salesOrder.customer.email && (
                <div className="text-sm text-gray-500 mt-1">{salesOrder.customer.email}</div>
              )}
              {salesOrder.customer.phone && (
                <div className="text-sm text-gray-500">{salesOrder.customer.phone}</div>
              )}
            </div>

            {/* Dates Card */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Dates</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order Date:</span>
                  <span className="text-gray-900">{formatDate(salesOrder.txnDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Due Date:</span>
                  <span className="text-gray-900">{formatDate(salesOrder.dueDate)}</span>
                </div>
                {salesOrder.shipDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Ship Date:</span>
                    <span className="text-gray-900">{formatDate(salesOrder.shipDate)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Totals Card */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-medium">Totals</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(salesOrder.subtotal)}</span>
                </div>
                {salesOrder.taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax:</span>
                    <span className="text-gray-900">{formatCurrency(salesOrder.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{formatCurrency(salesOrder.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Billing Address */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Billing Address</span>
              </div>
              <div className="text-sm text-gray-700">
                {salesOrder.billAddrLine1 || '-'}
                {salesOrder.billAddrLine2 && <div>{salesOrder.billAddrLine2}</div>}
                {(salesOrder.billAddrCity || salesOrder.billAddrState || salesOrder.billAddrPostalCode) && (
                  <div>
                    {[salesOrder.billAddrCity, salesOrder.billAddrState].filter(Boolean).join(', ')} {salesOrder.billAddrPostalCode}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-3">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Shipping Address</span>
              </div>
              <div className="text-sm text-gray-700">
                {salesOrder.shipAddrLine1 || '-'}
                {salesOrder.shipAddrLine2 && <div>{salesOrder.shipAddrLine2}</div>}
                {(salesOrder.shipAddrCity || salesOrder.shipAddrState || salesOrder.shipAddrPostalCode) && (
                  <div>
                    {[salesOrder.shipAddrCity, salesOrder.shipAddrState].filter(Boolean).join(', ')} {salesOrder.shipAddrPostalCode}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Project Link */}
          {salesOrder.project && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Link className="w-4 h-4" />
                <span className="text-sm font-medium">Linked Project</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{salesOrder.project.name}</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  {salesOrder.project.status}
                </span>
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Line Items</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesOrder.lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-sm text-gray-500">{line.lineNum || index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{line.description || '-'}</div>
                      {line.itemRefName && (
                        <div className="text-xs text-gray-500">Item: {line.itemRefName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{line.quantity}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(line.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {formatCurrency(salesOrder.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {(salesOrder.customerMemo || salesOrder.privateNote) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {salesOrder.customerMemo && (
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Customer Memo</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{salesOrder.customerMemo}</p>
                </div>
              )}
              {salesOrder.privateNote && (
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Private Note</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{salesOrder.privateNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Created By */}
          {salesOrder.createdBy && (
            <div className="mt-6 text-sm text-gray-500 flex items-center gap-2">
              <User className="w-4 h-4" />
              Created by {salesOrder.createdBy.name} on {formatDate(salesOrder.createdAt)}
            </div>
          )}
        </>
      )}

      {activeTab === 'parts' && (
        <SOPartsTab
          salesOrderId={salesOrder.id}
          onPartUpdate={fetchSalesOrder}
        />
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Invoices</h2>
          </div>
          {salesOrder.invoices && salesOrder.invoices.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesOrder.invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">{formatCurrency(invoice.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No invoices have been generated yet.</p>
              {salesOrder.status === 'CONFIRMED' && (
                <p className="text-sm mt-1">Click "Generate Invoice" to create an invoice from this order.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <SOConfirmModal
          salesOrder={salesOrder}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmOrder}
        />
      )}
    </div>
  )
}

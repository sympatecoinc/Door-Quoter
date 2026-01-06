'use client'

import { useState, useEffect } from 'react'
import { Invoice } from '@/types/invoice'
import InvoiceStatusBadge from './InvoiceStatusBadge'
import {
  ArrowLeft,
  Edit2,
  Cloud,
  Building2,
  Calendar,
  MapPin,
  FileText,
  DollarSign,
  User,
  Link
} from 'lucide-react'

interface InvoiceDetailViewProps {
  invoiceId: number
  onBack: () => void
  onEdit: (invoice: Invoice) => void
  onRefresh: () => void
}

export default function InvoiceDetailView({ invoiceId, onBack, onEdit, onRefresh }: InvoiceDetailViewProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  async function fetchInvoice() {
    try {
      setLoading(true)
      const response = await fetch(`/api/invoices/${invoiceId}`)
      if (response.ok) {
        const data = await response.json()
        setInvoice(data)
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
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

  if (!invoice) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <div className="text-center py-12 text-gray-500">
          Invoice not found
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
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <InvoiceStatusBadge status={invoice.status} size="lg" />
              {invoice.quickbooksId && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Cloud className="w-4 h-4" />
                  Synced
                </span>
              )}
            </div>
            {invoice.docNumber && invoice.docNumber !== invoice.invoiceNumber && (
              <p className="text-sm text-gray-500 mt-1">QB Doc: {invoice.docNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(invoice)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Customer Card */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-3">
            <Building2 className="w-4 h-4" />
            <span className="text-sm font-medium">Customer</span>
          </div>
          <div className="font-semibold text-gray-900">{invoice.customer?.companyName || '-'}</div>
          {invoice.customer?.contactName && (
            <div className="text-sm text-gray-600 mt-1">{invoice.customer.contactName}</div>
          )}
          {invoice.customer?.email && (
            <div className="text-sm text-gray-500 mt-1">{invoice.customer.email}</div>
          )}
          {invoice.customer?.phone && (
            <div className="text-sm text-gray-500">{invoice.customer.phone}</div>
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
              <span className="text-gray-500">Invoice Date:</span>
              <span className="text-gray-900">{formatDate(invoice.txnDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Due Date:</span>
              <span className="text-gray-900">{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.shipDate && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ship Date:</span>
                <span className="text-gray-900">{formatDate(invoice.shipDate)}</span>
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
              <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax:</span>
                <span className="text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span className="text-gray-700">Total:</span>
              <span className="text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Balance:</span>
              <span className={invoice.balance > 0 ? 'text-yellow-600 font-medium' : 'text-green-600'}>
                {invoice.balance > 0 ? formatCurrency(invoice.balance) : 'Paid'}
              </span>
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
            {invoice.billAddrLine1 || '-'}
            {invoice.billAddrLine2 && <div>{invoice.billAddrLine2}</div>}
            {(invoice.billAddrCity || invoice.billAddrState || invoice.billAddrPostalCode) && (
              <div>
                {[invoice.billAddrCity, invoice.billAddrState].filter(Boolean).join(', ')} {invoice.billAddrPostalCode}
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
            {invoice.shipAddrLine1 || '-'}
            {invoice.shipAddrLine2 && <div>{invoice.shipAddrLine2}</div>}
            {(invoice.shipAddrCity || invoice.shipAddrState || invoice.shipAddrPostalCode) && (
              <div>
                {[invoice.shipAddrCity, invoice.shipAddrState].filter(Boolean).join(', ')} {invoice.shipAddrPostalCode}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales Order Link */}
      {invoice.salesOrder && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Link className="w-4 h-4" />
            <span className="text-sm font-medium">Linked Sales Order</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{invoice.salesOrder.orderNumber}</span>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {invoice.salesOrder.status}
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
            {invoice.lines?.map((line, index) => (
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
                {formatCurrency(invoice.totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {(invoice.customerMemo || invoice.privateNote) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {invoice.customerMemo && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Customer Memo</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.customerMemo}</p>
            </div>
          )}
          {invoice.privateNote && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Private Note</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.privateNote}</p>
            </div>
          )}
        </div>
      )}

      {/* Created By */}
      {invoice.createdBy && (
        <div className="mt-6 text-sm text-gray-500 flex items-center gap-2">
          <User className="w-4 h-4" />
          Created by {invoice.createdBy.name} on {formatDate(invoice.createdAt)}
        </div>
      )}
    </div>
  )
}

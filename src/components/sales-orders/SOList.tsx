'use client'

import { useState, useEffect } from 'react'
import { SalesOrder, SOStatus, SO_STATUS_CONFIG } from '@/types/sales-order'
import SOStatusBadge from './SOStatusBadge'
import { Search, ChevronLeft, ChevronRight, Edit2, ExternalLink, Cloud } from 'lucide-react'

interface SOListProps {
  onSOSelect: (so: SalesOrder) => void
  onEdit: (so: SalesOrder) => void
  onRefresh: () => void
  refreshKey?: number
}

export default function SOList({ onSOSelect, onEdit, onRefresh, refreshKey }: SOListProps) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    fetchSalesOrders()
  }, [page, search, status, sortBy, sortOrder, refreshKey])

  async function fetchSalesOrders() {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder
      })
      if (search) params.set('search', search)
      if (status) params.set('status', status)

      const response = await fetch(`/api/sales-orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSalesOrders(data.salesOrders)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  const statuses: SOStatus[] = ['DRAFT', 'CONFIRMED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED', 'CANCELLED']

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{SO_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('orderNumber')}
              >
                Order #
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('txnDate')}
              >
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('totalAmount')}
              >
                Total
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('balance')}
              >
                Balance
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                QB
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : salesOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No sales orders found
                </td>
              </tr>
            ) : (
              salesOrders.map(so => (
                <tr
                  key={so.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onSOSelect(so)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{so.orderNumber}</div>
                    {so.docNumber && so.docNumber !== so.orderNumber && (
                      <div className="text-xs text-gray-500">QB: {so.docNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(so.txnDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {so.customer.companyName}
                    </div>
                    {so.customer.contactName && (
                      <div className="text-xs text-gray-500">{so.customer.contactName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {so.project?.name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <SOStatusBadge status={so.status} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(so.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {so.balance > 0 ? (
                      <span className="text-yellow-600">{formatCurrency(so.balance)}</span>
                    ) : (
                      <span className="text-green-600">Paid</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {so.quickbooksId ? (
                      <Cloud className="w-4 h-4 text-green-500 inline" title="Synced with QuickBooks" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(so) }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

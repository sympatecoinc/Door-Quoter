'use client'

import { useState, useEffect, useRef } from 'react'
import { PurchaseOrder, POStatus, PO_STATUS_CONFIG } from '@/types/purchase-order'
import POStatusBadge from './POStatusBadge'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Building,
  MoreVertical,
  Calendar,
  DollarSign,
  Package,
  Eye
} from 'lucide-react'

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-4 text-right">
        <div className="h-6 w-6 bg-gray-200 rounded ml-auto" />
      </td>
    </tr>
  )
}

interface POListProps {
  onPOSelect: (po: PurchaseOrder) => void
  onEdit: (po: PurchaseOrder) => void
  onRefresh: () => void
  refreshKey?: number
}

export default function POList({ onPOSelect, onEdit, onRefresh, refreshKey = 0 }: POListProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const isFirstRender = useRef(true)
  const limit = 20

  // Initial fetch on mount
  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  // Refetch when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      fetchPurchaseOrders()
    }
  }, [refreshKey])

  // Fetch on filter/page changes (skip initial render)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    fetchPurchaseOrders()
  }, [page, search, status])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuOpenId && !(e.target as Element).closest('.po-menu')) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpenId])

  async function fetchPurchaseOrders() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status !== 'all' && { status })
      })

      const response = await fetch(`/api/purchase-orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrders(data.purchaseOrders)
        setTotalPages(data.totalPages)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(po: PurchaseOrder) {
    const hasReceivings = po._count?.receivings && po._count.receivings > 0
    const message = hasReceivings
      ? `This purchase order has receiving records. Are you sure you want to cancel "${po.poNumber}"?`
      : `Are you sure you want to delete "${po.poNumber}"?`

    if (!confirm(message)) {
      return
    }

    try {
      const response = await fetch(`/api/purchase-orders/${po.id}${hasReceivings ? '' : '?permanent=true'}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPurchaseOrders()
        onRefresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete purchase order')
      }
    } catch (error) {
      console.error('Error deleting purchase order:', error)
      alert('Failed to delete purchase order')
    }

    setMenuOpenId(null)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchPurchaseOrders()
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search POs, vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {Object.entries(PO_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <>
                {[...Array(8)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </>
            ) : purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No purchase orders found
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onPOSelect(po)}
                >
                  <td className="px-4 py-4">
                    <div>
                      <div className="font-medium text-gray-900 font-mono">
                        {po.poNumber}
                      </div>
                      {po._count?.lines && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {po._count.lines} items
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {po.vendor.displayName}
                        </div>
                        {po.vendor.companyName && po.vendor.companyName !== po.vendor.displayName && (
                          <div className="text-xs text-gray-500">
                            {po.vendor.companyName}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <POStatusBadge status={po.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {formatDate(po.txnDate)}
                    </div>
                    {po.expectedDate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Expected: {formatDate(po.expectedDate)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 font-medium text-gray-900">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      {formatCurrency(po.totalAmount)}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="relative po-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(menuOpenId === po.id ? null : po.id)
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>
                      {menuOpenId === po.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onPOSelect(po)
                              setMenuOpenId(null)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          {po.status === 'DRAFT' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEdit(po)
                                setMenuOpenId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(po)
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            {po._count?.receivings && po._count.receivings > 0 ? 'Cancel' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
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
            Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total} purchase orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

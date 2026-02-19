'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Filter, Package, AlertTriangle, AlertCircle, CheckCircle, X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import InventoryEditModal from '@/components/inventory/InventoryEditModal'
import ExtrusionInventoryTab from '@/components/inventory/ExtrusionInventoryTab'
import FinishPricingTab from '@/components/inventory/FinishPricingTab'
import BinLocationsTab from '@/components/inventory/BinLocationsTab'
import InventoryNotificationBanner from '@/components/inventory/InventoryNotificationBanner'

interface Vendor {
  id: number
  displayName: string
  category?: string | null
}

interface InventoryPart {
  id: number
  partNumber: string
  baseName: string
  description?: string | null
  partType: string
  unit?: string | null
  cost?: number | null
  qtyOnHand?: number | null
  qtyReserved?: number | null
  binLocation?: string | null
  reorderPoint?: number | null
  reorderQty?: number | null
  vendorId?: number | null
  vendor?: Vendor | null
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock'
}

interface Summary {
  totalParts: number
  lowStockCount: number
  outOfStockCount: number
  filteredCount: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface MasterPartRef {
  id: number
  partNumber: string
  baseName: string
  partType: string
}

interface InventoryNotification {
  id: number
  type: string
  message: string
  masterPartId: number | null
  masterPart: MasterPartRef | null
  actionType: string | null
  isDismissed: boolean
  createdAt: string
}

type InventoryTab = 'all' | 'extrusions' | 'finishPricing' | 'binLocations'

export default function InventoryView() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('all')
  const [parts, setParts] = useState<InventoryPart[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const initialLoadDone = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [partType, setPartType] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [stockStatus, setStockStatus] = useState('all')
  const [page, setPage] = useState(1)

  // Edit modal
  const [editingPart, setEditingPart] = useState<InventoryPart | null>(null)

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Inventory notifications (new parts added, etc.)
  const [inventoryNotifications, setInventoryNotifications] = useState<InventoryNotification[]>([])

  // Debounce search input - only update debouncedSearch after user stops typing
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 150)
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [search])

  const fetchInventory = useCallback(async () => {
    if (initialLoadDone.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(partType !== 'all' && { partType }),
        ...(vendorFilter !== 'all' && { vendorId: vendorFilter }),
        ...(stockStatus !== 'all' && { stockStatus })
      })

      const response = await fetch(`/api/inventory?${params}`)
      if (!response.ok) throw new Error('Failed to fetch inventory')

      const data = await response.json()
      setParts(data.parts)
      setVendors(data.vendors)
      setSummary(data.summary)
      setPagination(data.pagination)
      initialLoadDone.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [page, debouncedSearch, partType, vendorFilter, stockStatus])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  useEffect(() => {
    fetchInventoryNotifications()
  }, [])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, partType, vendorFilter, stockStatus])

  async function fetchInventoryNotifications() {
    try {
      const response = await fetch('/api/inventory/notifications?dismissed=false')
      if (response.ok) {
        const data = await response.json()
        setInventoryNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Error fetching inventory notifications:', error)
    }
  }

  async function handleDismissNotification(notificationId: number) {
    try {
      await fetch(`/api/inventory/notifications/${notificationId}`, {
        method: 'DELETE'
      })
      setInventoryNotifications(prev => prev.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  async function handleSetupPart(partId: number) {
    try {
      const response = await fetch(`/api/inventory/${partId}`)
      if (response.ok) {
        const part = await response.json()
        setEditingPart(part)
      } else {
        setNotification({ type: 'error', message: 'Failed to load part details' })
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to load part details' })
    }
  }

  async function handleInlineUpdate(partId: number, field: string, value: string | number | null) {
    try {
      const response = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: partId, [field]: value })
      })

      if (!response.ok) throw new Error('Failed to update')

      const updatedPart = await response.json()
      setParts(prev => prev.map(p => p.id === partId ? updatedPart : p))
      setNotification({ type: 'success', message: 'Updated successfully' })
    } catch {
      setNotification({ type: 'error', message: 'Failed to update' })
    }
  }

  function handleEditSave(updatedPart: InventoryPart) {
    setParts(prev => prev.map(p => p.id === updatedPart.id ? updatedPart : p))
    setEditingPart(null)
    setNotification({ type: 'success', message: 'Part inventory updated' })
  }

  function getStockStatusBadge(status: string) {
    switch (status) {
      case 'in_stock':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">In Stock</span>
      case 'low_stock':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Low Stock</span>
      case 'out_of_stock':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Out of Stock</span>
      default:
        return null
    }
  }

  function getRowBackgroundClass(status: string, qtyOnHand?: number | null, qtyReserved?: number | null, reorderPoint?: number | null) {
    const onHand = qtyOnHand ?? 0
    const reserved = qtyReserved ?? 0
    const reorder = reorderPoint ?? 0

    // Over-reserved takes priority
    if (reserved > onHand) {
      return 'bg-blue-100 hover:bg-blue-200'
    }

    // Below reorder point
    if (reorder > 0 && onHand < reorder) {
      return 'bg-red-100 hover:bg-red-200'
    }

    switch (status) {
      case 'in_stock':
        return 'bg-green-50 hover:bg-green-100'
      case 'low_stock':
        return 'bg-yellow-100 hover:bg-yellow-200'
      case 'out_of_stock':
        return 'bg-red-100 hover:bg-red-200'
      default:
        return 'hover:bg-gray-50'
    }
  }

  return (
    <div className="p-6">
      {/* Notification */}
      {notification && (
        <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-sm">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-600 mt-1">Manage part quantities, locations, and reorder levels</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Parts
          </button>
          <button
            onClick={() => setActiveTab('extrusions')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'extrusions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Extrusions
          </button>
          <button
            onClick={() => setActiveTab('finishPricing')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'finishPricing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Finish Pricing
          </button>
          <button
            onClick={() => setActiveTab('binLocations')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
              activeTab === 'binLocations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Bin Locations
          </button>
        </nav>
      </div>

      {/* Inventory Notifications Banner */}
      <InventoryNotificationBanner
        notifications={inventoryNotifications}
        onDismiss={handleDismissNotification}
        onSetupPart={handleSetupPart}
      />

      {/* Extrusions Tab Content */}
      {activeTab === 'extrusions' && <ExtrusionInventoryTab />}

      {/* Finish Pricing Tab Content */}
      {activeTab === 'finishPricing' && (
        <FinishPricingTab
          showSuccess={(message) => setNotification({ type: 'success', message })}
          showError={(message) => setNotification({ type: 'error', message })}
        />
      )}

      {/* Bin Locations Tab Content */}
      {activeTab === 'binLocations' && (
        <BinLocationsTab
          onNotification={(type, message) => setNotification({ type, message })}
        />
      )}

      {/* All Parts Tab Content */}
      {activeTab === 'all' && (
        <>
      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg w-9 h-9" />
                <div>
                  <div className="h-7 bg-gray-200 rounded w-16 mb-1" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{summary.totalParts}</div>
                <div className="text-sm text-gray-600">Total Parts</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{summary.lowStockCount}</div>
                <div className="text-sm text-gray-600">Low Stock</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{summary.outOfStockCount}</div>
                <div className="text-sm text-gray-600">Out of Stock</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search part number or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Part Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={partType}
                onChange={(e) => setPartType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="Hardware">Hardware</option>
                <option value="Glass">Glass</option>
                <option value="Packaging">Packaging</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Vendor Filter */}
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.displayName}</option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="animate-pulse">
            {/* Skeleton Table Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4">
              {[...Array(11)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded w-20" />
              ))}
            </div>
            {/* Skeleton Table Rows */}
            {[...Array(10)].map((_, rowIdx) => (
              <div key={rowIdx} className="px-4 py-3 border-b border-gray-100 flex gap-4 items-center">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-14" />
                <div className="h-6 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-12" />
                <div className="h-4 bg-gray-200 rounded w-14" />
                <div className="h-6 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-20" />
                <div className="h-6 bg-gray-200 rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : parts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No parts found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Hand</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reserved</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bin Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Point</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parts.map(part => (
                    <tr
                      key={part.id}
                      className={`${getRowBackgroundClass(part.stockStatus, part.qtyOnHand, part.qtyReserved, part.reorderPoint)} cursor-pointer`}
                      onClick={() => setEditingPart(part)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{part.partNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{part.baseName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{part.partType}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {part.cost != null ? `$${part.cost.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={part.qtyOnHand ?? 0}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleInlineUpdate(part.id, 'qtyOnHand', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600">
                        {(part.qtyReserved ?? 0) > 0 ? part.qtyReserved : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {(() => {
                          const onHand = part.qtyOnHand ?? 0
                          const reserved = part.qtyReserved ?? 0
                          const available = Math.max(0, onHand - reserved)
                          const colorClass = available > 0 ? 'text-green-600' : 'text-red-600'
                          return <span className={colorClass}>{available}</span>
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={part.binLocation ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleInlineUpdate(part.id, 'binLocation', e.target.value || null)}
                          placeholder="—"
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {part.reorderPoint ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {part.vendor?.displayName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {getStockStatusBadge(part.stockStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} parts
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingPart && (
        <InventoryEditModal
          part={editingPart}
          vendors={vendors}
          onClose={() => setEditingPart(null)}
          onSave={handleEditSave}
        />
      )}
        </>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import {
  Package,
  Truck,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  PackageOpen,
  Filter,
  CheckCircle2,
  History
} from 'lucide-react'
import POReceivingModal from '@/components/purchase-orders/POReceivingModal'
import { PurchaseOrder, PO_STATUS_CONFIG, POStatus } from '@/types/purchase-order'

type TabType = 'pending' | 'history'

interface ReceivingPO extends PurchaseOrder {
  totalItems: number
  totalQuantity: number
  receivedQuantity: number
  remainingQuantity: number
  progressPercent: number
}

interface ReceivingStats {
  totalPOs: number
  sentCount: number
  acknowledgedCount: number
  partialCount: number
  totalItemsPending: number
  completeCount?: number
}

export default function ReceivingView() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [purchaseOrders, setPurchaseOrders] = useState<ReceivingPO[]>([])
  const [stats, setStats] = useState<ReceivingStats | null>(null)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  // Fetch pending count on mount and after receiving
  useEffect(() => {
    fetchPendingCount()
  }, [])

  useEffect(() => {
    fetchReceivingData()
  }, [statusFilter, activeTab])

  async function fetchPendingCount() {
    try {
      const response = await fetch('/api/receiving')
      if (response.ok) {
        const data = await response.json()
        setPendingCount(data.stats?.totalPOs || 0)
      }
    } catch {
      // Ignore errors for count fetch
    }
  }

  async function fetchReceivingData() {
    try {
      setError(null)
      const params = new URLSearchParams()

      if (activeTab === 'history') {
        params.set('history', 'true')
      } else if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }

      const response = await fetch(`/api/receiving?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch receiving data')
      }

      const data = await response.json()
      setPurchaseOrders(data.purchaseOrders || [])
      setStats(data.stats || null)

      // Update pending count when viewing all pending
      if (activeTab === 'pending' && statusFilter === 'all') {
        setPendingCount(data.stats?.totalPOs || 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receiving data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function handleRefresh() {
    setRefreshing(true)
    fetchReceivingData()
  }

  function handleReceiveComplete() {
    setSelectedPO(null)
    fetchReceivingData()
    fetchPendingCount()
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function getStatusBadge(status: POStatus) {
    const config = PO_STATUS_CONFIG[status]
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div>
              <div className="h-7 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-48 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-10 w-24 bg-gray-200 rounded-lg" />
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div>
                  <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                  <div className="h-7 w-12 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="h-8 w-36 bg-gray-200 rounded-lg" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['PO Number', 'Vendor', 'Status', 'Expected Date', 'Progress', 'Items', 'Actions'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left">
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-4"><div className="h-5 w-24 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-4"><div className="h-5 w-32 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-4"><div className="h-6 w-20 bg-gray-200 rounded-full" /></td>
                  <td className="px-4 py-4"><div className="h-5 w-24 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 bg-gray-200 rounded-full" />
                      <div className="h-4 w-10 bg-gray-200 rounded" />
                    </div>
                  </td>
                  <td className="px-4 py-4"><div className="h-5 w-16 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-4 text-right"><div className="h-8 w-20 bg-gray-200 rounded-lg ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <PackageOpen className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Receiving</h1>
            <p className="text-sm text-gray-500">Record incoming purchase orders</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('pending')
              setStatusFilter('all')
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <PackageOpen className="w-4 h-4" />
            Pending
            {pendingCount > 0 && (
              <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs min-w-[1.5rem] text-center">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </nav>
      </div>

      {/* Stats Cards - only show for pending tab */}
      {stats && activeTab === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total POs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPOs}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sent / Acknowledged</p>
                <p className="text-2xl font-bold text-gray-900">{stats.sentCount + stats.acknowledgedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Partial Received</p>
                <p className="text-2xl font-bold text-gray-900">{stats.partialCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Items Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItemsPending}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters - only show for pending tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Receivable</option>
              <option value="SENT">Sent</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* PO Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                {activeTab === 'history' ? 'Completed Date' : 'Expected Date'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Items
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    {activeTab === 'history' ? (
                      <>
                        <History className="w-12 h-12 text-gray-300" />
                        <p className="text-gray-500 font-medium">No receiving history yet</p>
                        <p className="text-sm text-gray-400">Completed orders will appear here</p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-12 h-12 text-green-300" />
                        <p className="text-gray-500 font-medium">No purchase orders awaiting receiving</p>
                        <p className="text-sm text-gray-400">All caught up!</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <span className="font-medium text-gray-900">{po.poNumber}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-900">{po.vendor.displayName}</span>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(po.status)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-600">
                      {activeTab === 'history' ? formatDate(po.updatedAt) : formatDate(po.expectedDate)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-24">
                        <div
                          className={`h-full rounded-full ${
                            po.progressPercent === 0
                              ? 'bg-gray-300'
                              : po.progressPercent < 50
                              ? 'bg-orange-500'
                              : po.progressPercent < 100
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${po.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-12">
                        {po.progressPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-600">
                      {po.receivedQuantity} / {po.totalQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {activeTab === 'history' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        Received
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedPO(po)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <PackageOpen className="w-4 h-4" />
                        Receive
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Receiving Modal */}
      {selectedPO && (
        <POReceivingModal
          purchaseOrder={selectedPO}
          onClose={() => setSelectedPO(null)}
          onComplete={handleReceiveComplete}
        />
      )}
    </div>
  )
}

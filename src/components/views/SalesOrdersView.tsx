'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import SOList from '@/components/sales-orders/SOList'
import SODetailView from '@/components/sales-orders/SODetailView'
import SOForm from '@/components/sales-orders/SOForm'
import SOStatsWidget from '@/components/sales-orders/SOStatsWidget'
import { SalesOrder } from '@/types/sales-order'
import { Plus, CheckCircle, AlertCircle, X, RefreshCw, CloudOff } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export default function SalesOrdersView() {
  const searchParams = useSearchParams()
  const [selectedSOId, setSelectedSOId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSO, setEditingSO] = useState<SalesOrder | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const hasSyncedRef = useRef(false)

  // Auto-sync on mount
  useEffect(() => {
    if (hasSyncedRef.current) return
    hasSyncedRef.current = true

    async function autoSync() {
      setSyncStatus('syncing')
      try {
        // Sync customers first (silent)
        await fetch('/api/customers/sync')

        // Then sync sales orders (invoices)
        const response = await fetch('/api/sales-orders/sync')

        if (response.ok) {
          setSyncStatus('synced')
          setLastSyncTime(new Date())
          setRefreshKey(prev => prev + 1)
          // Reset to idle after 3 seconds
          setTimeout(() => setSyncStatus('idle'), 3000)
        } else {
          setSyncStatus('error')
        }
      } catch (error) {
        console.error('Auto-sync failed:', error)
        setSyncStatus('error')
      }
    }

    autoSync()
  }, [])

  // Check for URL parameters on load (from QB callback)
  useEffect(() => {
    const qbConnectedParam = searchParams.get('qb_connected')
    const qbError = searchParams.get('qb_error')

    if (qbConnectedParam === 'true') {
      setNotification({ type: 'success', message: 'Successfully connected to QuickBooks!' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (qbError) {
      setNotification({ type: 'error', message: `QuickBooks connection failed: ${qbError}` })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  // Auto-hide notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Cmd+N to create new SO
  useNewShortcut(
    () => {
      setEditingSO(null)
      setShowForm(true)
    },
    { disabled: showForm || selectedSOId !== null }
  )

  function handleSOSelect(so: SalesOrder) {
    setSelectedSOId(so.id)
  }

  function handleBack() {
    setSelectedSOId(null)
  }

  function handleCreateNew() {
    setEditingSO(null)
    setShowForm(true)
  }

  function handleEdit(so: SalesOrder) {
    setEditingSO(so)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingSO(null)
  }

  function handleFormSave(savedSO?: SalesOrder, warning?: string) {
    setShowForm(false)
    setEditingSO(null)
    setRefreshKey(prev => prev + 1)
    if (savedSO) {
      setSelectedSOId(savedSO.id)
    }
    // Show warning if QB sync failed
    if (warning) {
      setNotification({ type: 'error', message: warning })
    } else if (savedSO) {
      setNotification({ type: 'success', message: `Sales order ${savedSO.orderNumber || ''} saved successfully` })
    }
  }

  // Show SO detail view
  if (selectedSOId) {
    return (
      <>
        {/* Show notification in detail view too */}
        {notification && (
          <div className={`mx-6 mt-6 p-4 rounded-lg flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success'
                ? <CheckCircle className="w-5 h-5" />
                : <AlertCircle className="w-5 h-5" />
              }
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <SODetailView
          key={`${selectedSOId}-${refreshKey}`}
          soId={selectedSOId}
          onBack={handleBack}
          onEdit={handleEdit}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
        {/* SO Form Modal - must be outside detail view conditional */}
        {showForm && (
          <SOForm
            salesOrder={editingSO}
            onClose={handleFormClose}
            onSave={handleFormSave}
          />
        )}
      </>
    )
  }

  return (
    <div className="p-6">
      {/* Notifications */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success'
              ? <CheckCircle className="w-5 h-5" />
              : <AlertCircle className="w-5 h-5" />
            }
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Widget */}
      <SOStatsWidget refreshKey={refreshKey} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
            {/* Sync Status Indicator */}
            <div className="flex items-center gap-1.5" title={lastSyncTime ? `Last synced: ${lastSyncTime.toLocaleTimeString()}` : 'Syncing with QuickBooks'}>
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-blue-500">Syncing...</span>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500">Synced</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <CloudOff className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">Sync failed</span>
                </>
              )}
            </div>
          </div>
          <p className="text-gray-600 mt-1">
            Create and manage sales orders with QuickBooks integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Sales Order
          </button>
        </div>
      </div>

      {/* SO List */}
      <SOList
        key={refreshKey}
        onSOSelect={handleSOSelect}
        onEdit={handleEdit}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
        refreshKey={refreshKey}
      />

      {/* SO Form Modal */}
      {showForm && (
        <SOForm
          salesOrder={editingSO}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  )
}

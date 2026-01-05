'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import POList from '@/components/purchase-orders/POList'
import PODetailView from '@/components/purchase-orders/PODetailView'
import POForm from '@/components/purchase-orders/POForm'
import POStatsWidget from '@/components/purchase-orders/POStatsWidget'
import { PurchaseOrder } from '@/types/purchase-order'
import { Plus, CheckCircle, AlertCircle, X, RefreshCw, CloudOff } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export default function PurchaseOrdersView() {
  const searchParams = useSearchParams()
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
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
        // Sync items first (silent)
        await fetch('/api/quickbooks/items?action=sync')

        // Then sync POs
        const response = await fetch('/api/purchase-orders/sync')

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

  // Cmd+N to create new PO
  useNewShortcut(
    () => {
      setEditingPO(null)
      setShowForm(true)
    },
    { disabled: showForm || selectedPOId !== null }
  )

  function handlePOSelect(po: PurchaseOrder) {
    setSelectedPOId(po.id)
  }

  function handleBack() {
    setSelectedPOId(null)
  }

  function handleCreateNew() {
    setEditingPO(null)
    setShowForm(true)
  }

  function handleEdit(po: PurchaseOrder) {
    setEditingPO(po)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingPO(null)
  }

  function handleFormSave(savedPO?: PurchaseOrder, warning?: string) {
    setShowForm(false)
    setEditingPO(null)
    setRefreshKey(prev => prev + 1)
    if (savedPO) {
      setSelectedPOId(savedPO.id)
    }
    // Show warning if QB sync failed
    if (warning) {
      setNotification({ type: 'error', message: warning })
    } else if (savedPO) {
      setNotification({ type: 'success', message: `Purchase order ${savedPO.poNumber || ''} saved successfully` })
    }
  }

  // Show PO detail view
  if (selectedPOId) {
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
        <PODetailView
          key={`${selectedPOId}-${refreshKey}`}
          poId={selectedPOId}
          onBack={handleBack}
          onEdit={handleEdit}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
        {/* PO Form Modal - must be outside detail view conditional */}
        {showForm && (
          <POForm
            purchaseOrder={editingPO}
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
      <POStatsWidget refreshKey={refreshKey} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
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
            Create and manage purchase orders with QuickBooks integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* PO List */}
      <POList
        key={refreshKey}
        onPOSelect={handlePOSelect}
        onEdit={handleEdit}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
        refreshKey={refreshKey}
      />

      {/* PO Form Modal */}
      {showForm && (
        <POForm
          purchaseOrder={editingPO}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  )
}

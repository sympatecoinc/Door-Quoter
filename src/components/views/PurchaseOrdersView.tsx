'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import POList from '@/components/purchase-orders/POList'
import PODetailView from '@/components/purchase-orders/PODetailView'
import POForm from '@/components/purchase-orders/POForm'
import POStatsWidget from '@/components/purchase-orders/POStatsWidget'
import { PurchaseOrder } from '@/types/purchase-order'
import { Plus, CheckCircle, AlertCircle, X, RefreshCw, Cloud } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

export default function PurchaseOrdersView() {
  const searchParams = useSearchParams()
  const [selectedPOId, setSelectedPOId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSyncFromQuickBooks() {
    setSyncing(true)
    try {
      // Sync items first
      await fetch('/api/quickbooks/items?action=sync')

      // Then sync POs
      const response = await fetch('/api/purchase-orders/sync')
      const data = await response.json()

      if (response.ok) {
        setNotification({
          type: 'success',
          message: `Synced from QuickBooks: ${data.created} created, ${data.updated} updated${data.errors?.length ? `, ${data.errors.length} errors` : ''}`
        })
        setRefreshKey(prev => prev + 1)
      } else {
        setNotification({ type: 'error', message: data.error || 'Failed to sync from QuickBooks' })
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Failed to sync from QuickBooks' })
    } finally {
      setSyncing(false)
    }
  }

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
            <button
              onClick={handleSyncFromQuickBooks}
              disabled={syncing}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
              title="Sync from QuickBooks"
            >
              {syncing ? (
                <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 text-green-600" />
              )}
              <span className="text-sm text-green-600">
                {syncing ? 'Syncing...' : 'Sync QB'}
              </span>
            </button>
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

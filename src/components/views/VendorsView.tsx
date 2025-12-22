'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import VendorList from '@/components/vendors/VendorList'
import VendorDetailView from '@/components/vendors/VendorDetailView'
import VendorForm from '@/components/vendors/VendorForm'
import { Vendor } from '@/types'
import { Plus, CheckCircle, AlertCircle, X, RefreshCw, Cloud } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

export default function VendorsView() {
  const searchParams = useSearchParams()
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSyncFromQuickBooks() {
    setSyncing(true)
    try {
      const response = await fetch('/api/vendors/sync')
      const data = await response.json()

      if (response.ok) {
        setNotification({
          type: 'success',
          message: `Synced from QuickBooks: ${data.created} created, ${data.updated} updated`
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
      // Clear URL params
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

  // Cmd+N to create new vendor
  useNewShortcut(
    () => {
      setEditingVendor(null)
      setShowForm(true)
    },
    { disabled: showForm || selectedVendorId !== null }
  )

  function handleVendorSelect(vendor: Vendor) {
    setSelectedVendorId(vendor.id)
  }

  function handleBack() {
    setSelectedVendorId(null)
  }

  function handleCreateNew() {
    setEditingVendor(null)
    setShowForm(true)
  }

  function handleEdit(vendor: Vendor) {
    setEditingVendor(vendor)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingVendor(null)
  }

  function handleFormSave() {
    setShowForm(false)
    setEditingVendor(null)
    setRefreshKey(prev => prev + 1)
  }

  // Show vendor detail view
  if (selectedVendorId) {
    return (
      <>
        <VendorDetailView
          key={refreshKey}
          vendorId={selectedVendorId}
          onBack={handleBack}
          onEdit={handleEdit}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
        {/* Vendor Form Modal - must be outside detail view conditional */}
        {showForm && (
          <VendorForm
            vendor={editingVendor}
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
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
                {syncing ? 'Syncing...' : 'Synced'}
              </span>
            </button>
          </div>
          <p className="text-gray-600 mt-1">
            Manage vendor relationships and QuickBooks integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* Vendor List */}
      <VendorList
        key={refreshKey}
        onVendorSelect={handleVendorSelect}
        onEdit={handleEdit}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
      />

      {/* Vendor Form Modal */}
      {showForm && (
        <VendorForm
          vendor={editingVendor}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  )
}

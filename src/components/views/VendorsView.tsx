'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import VendorList from '@/components/vendors/VendorList'
import VendorDetailView from '@/components/vendors/VendorDetailView'
import VendorForm from '@/components/vendors/VendorForm'
import { Vendor } from '@/types'
import { Plus, RefreshCw, Link as LinkIcon, CheckCircle, AlertCircle, X } from 'lucide-react'

export default function VendorsView() {
  const searchParams = useSearchParams()
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // QuickBooks connection state
  const [qbConnected, setQbConnected] = useState(false)
  const [qbCredentialsConfigured, setQbCredentialsConfigured] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Check for URL parameters on load (from QB callback)
  useEffect(() => {
    const qbConnectedParam = searchParams.get('qb_connected')
    const qbError = searchParams.get('qb_error')

    if (qbConnectedParam === 'true') {
      setNotification({ type: 'success', message: 'Successfully connected to QuickBooks!' })
      checkQBStatus()
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname)
    } else if (qbError) {
      setNotification({ type: 'error', message: `QuickBooks connection failed: ${qbError}` })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  // Check QuickBooks status on mount
  useEffect(() => {
    checkQBStatus()
  }, [])

  // Auto-hide notifications
  useEffect(() => {
    if (notification || syncResult) {
      const timer = setTimeout(() => {
        setNotification(null)
        setSyncResult(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification, syncResult])

  async function checkQBStatus() {
    try {
      const response = await fetch('/api/quickbooks/status')
      if (response.ok) {
        const data = await response.json()
        setQbConnected(data.connected)
        setQbCredentialsConfigured(data.credentialsConfigured)
      }
    } catch (error) {
      console.error('Error checking QB status:', error)
    }
  }

  async function handleConnectQB() {
    try {
      const response = await fetch('/api/quickbooks/connect')
      if (response.ok) {
        const data = await response.json()
        // Redirect to QuickBooks authorization
        window.location.href = data.authUrl
      } else {
        const error = await response.json()
        setNotification({ type: 'error', message: error.error || 'Failed to initiate QuickBooks connection' })
      }
    } catch (error) {
      console.error('Error connecting to QuickBooks:', error)
      setNotification({ type: 'error', message: 'Failed to connect to QuickBooks' })
    }
  }

  async function handleSyncFromQB() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const response = await fetch('/api/vendors/sync')
      const data = await response.json()

      if (response.ok) {
        setSyncResult({
          type: 'success',
          message: `Sync complete! Created: ${data.created}, Updated: ${data.updated}`
        })
        setRefreshKey(prev => prev + 1)
      } else {
        setSyncResult({ type: 'error', message: data.error || 'Sync failed' })
      }
    } catch (error) {
      console.error('Error syncing from QuickBooks:', error)
      setSyncResult({ type: 'error', message: 'Failed to sync from QuickBooks' })
    } finally {
      setSyncing(false)
    }
  }

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
    if (selectedVendorId) {
      // Refresh detail view
      setSelectedVendorId(null)
      setTimeout(() => setSelectedVendorId(selectedVendorId), 0)
    }
  }

  // Show vendor detail view
  if (selectedVendorId) {
    return (
      <VendorDetailView
        vendorId={selectedVendorId}
        onBack={handleBack}
        onEdit={handleEdit}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
      />
    )
  }

  return (
    <div className="p-6">
      {/* Notifications */}
      {(notification || syncResult) && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
          (notification?.type || syncResult?.type) === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {(notification?.type || syncResult?.type) === 'success'
              ? <CheckCircle className="w-5 h-5" />
              : <AlertCircle className="w-5 h-5" />
            }
            <span>{notification?.message || syncResult?.message}</span>
          </div>
          <button
            onClick={() => { setNotification(null); setSyncResult(null); }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-600 mt-1">
            Manage vendor relationships and QuickBooks integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* QuickBooks Connection Status */}
          {qbCredentialsConfigured && (
            <>
              {qbConnected ? (
                <button
                  onClick={handleSyncFromQB}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync from QuickBooks'}
                </button>
              ) : (
                <button
                  onClick={handleConnectQB}
                  className="flex items-center gap-2 px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  Connect QuickBooks
                </button>
              )}
            </>
          )}
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      {/* QuickBooks Status Banner */}
      {!qbCredentialsConfigured && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">QuickBooks Not Configured</h3>
              <p className="text-sm text-yellow-700 mt-1">
                To enable QuickBooks integration, add your QuickBooks API credentials to the .env file:
              </p>
              <code className="block mt-2 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                QUICKBOOKS_CLIENT_ID=your_client_id<br />
                QUICKBOOKS_CLIENT_SECRET=your_client_secret<br />
                QUICKBOOKS_ENVIRONMENT=sandbox<br />
                QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
              </code>
            </div>
          </div>
        </div>
      )}

      {qbConnected && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-700">Connected to QuickBooks</span>
        </div>
      )}

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
          qbConnected={qbConnected}
        />
      )}
    </div>
  )
}

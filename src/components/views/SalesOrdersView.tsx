'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SOList from '@/components/sales-orders/SOList'
import SODetailView from '@/components/sales-orders/SODetailView'
import SOForm from '@/components/sales-orders/SOForm'
import SOStatsWidget from '@/components/sales-orders/SOStatsWidget'
import PendingQuotesList from '@/components/sales-orders/PendingQuotesList'
import { SalesOrder } from '@/types/sales-order'
import { Plus, CheckCircle, AlertCircle, X, FileText, ClipboardList } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

type TabType = 'pending' | 'orders'

export default function SalesOrdersView() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('orders')
  const [selectedSOId, setSelectedSOId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingSO, setEditingSO] = useState<SalesOrder | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [prefilledProjectId, setPrefilledProjectId] = useState<number | null>(null)

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
    setPrefilledProjectId(null)
    setRefreshKey(prev => prev + 1)
    if (savedSO) {
      setSelectedSOId(savedSO.id)
      // Switch to orders tab after creating
      setActiveTab('orders')
    }
    if (warning) {
      setNotification({ type: 'error', message: warning })
    } else if (savedSO) {
      setNotification({ type: 'success', message: `Sales order ${savedSO.orderNumber || ''} saved successfully` })
    }
  }

  // Handler for creating SO from pending quote
  async function handleCreateSOFromQuote(projectId: number) {
    setPrefilledProjectId(projectId)
    setEditingSO(null)
    setShowForm(true)
  }

  // Handler for generating invoice from SO
  async function handleGenerateInvoice(so: SalesOrder) {
    try {
      const response = await fetch(`/api/sales-orders/${so.id}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToQuickBooks: true })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      setNotification({
        type: 'success',
        message: `Invoice ${data.invoice.invoiceNumber} created${data.invoice.quickbooksId ? ' and synced to QuickBooks' : ''}`
      })
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to create invoice'
      })
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
          onGenerateInvoice={handleGenerateInvoice}
        />
        {/* SO Form Modal - must be outside detail view conditional */}
        {showForm && (
          <SOForm
            salesOrder={editingSO}
            onClose={handleFormClose}
            onSave={handleFormSave}
            prefilledProjectId={prefilledProjectId}
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
          <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
          <p className="text-gray-600 mt-1">
            Create and manage sales orders from accepted quotes
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            Pending from Quotes
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'orders'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Sales Orders
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'pending' ? (
        <PendingQuotesList
          onCreateSO={handleCreateSOFromQuote}
          refreshKey={refreshKey}
        />
      ) : (
        <SOList
          key={refreshKey}
          onSOSelect={handleSOSelect}
          onEdit={handleEdit}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
          refreshKey={refreshKey}
        />
      )}

      {/* SO Form Modal */}
      {showForm && (
        <SOForm
          salesOrder={editingSO}
          onClose={handleFormClose}
          onSave={handleFormSave}
          prefilledProjectId={prefilledProjectId}
        />
      )}
    </div>
  )
}

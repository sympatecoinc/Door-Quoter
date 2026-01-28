'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, Globe, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Portal } from '@/types'

// Available tabs for portal configuration (copied from permissions.ts)
const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard (Sales)' },
  { id: 'customers', label: 'Customers' },
  { id: 'crm', label: 'CRM' },
  { id: 'projects', label: 'Projects' },
  { id: 'production', label: 'Production' },
  { id: 'logistics', label: 'Shipping' },
  { id: 'products', label: 'Products' },
  { id: 'masterParts', label: 'Master Parts' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'purchaseOrders', label: 'Purchase Orders' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'purchasingDashboard', label: 'Purchasing Dashboard' },
  { id: 'salesOrders', label: 'Sales Orders' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quoteDocuments', label: 'Quote Settings' },
  { id: 'accounting', label: 'Pricing' },
  { id: 'settings', label: 'Settings' }
]

interface PortalFormData {
  subdomain: string
  name: string
  description: string
  tabs: string[]
  defaultTab: string
  headerTitle: string
  isActive: boolean
}

const emptyForm: PortalFormData = {
  subdomain: '',
  name: '',
  description: '',
  tabs: [],
  defaultTab: '',
  headerTitle: '',
  isActive: true
}

export default function PortalManagement() {
  const [portals, setPortals] = useState<Portal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null)
  const [formData, setFormData] = useState<PortalFormData>(emptyForm)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  useEffect(() => {
    fetchPortals()
  }, [])

  // Clear notifications after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  async function fetchPortals() {
    try {
      setLoading(true)
      const response = await fetch('/api/portals')
      if (response.ok) {
        const data = await response.json()
        setPortals(data.portals)
      } else {
        const errData = await response.json()
        setError(errData.error || 'Failed to fetch portals')
      }
    } catch (err) {
      setError('Failed to fetch portals')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingPortal(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  function openEditModal(portal: Portal) {
    setEditingPortal(portal)
    setFormData({
      subdomain: portal.subdomain,
      name: portal.name,
      description: portal.description || '',
      tabs: portal.tabs,
      defaultTab: portal.defaultTab || '',
      headerTitle: portal.headerTitle || '',
      isActive: portal.isActive
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingPortal(null)
    setFormData(emptyForm)
  }

  function handleTabToggle(tabId: string) {
    setFormData(prev => {
      const newTabs = prev.tabs.includes(tabId)
        ? prev.tabs.filter(t => t !== tabId)
        : [...prev.tabs, tabId]

      // If removing the current default tab, clear it
      const newDefaultTab = newTabs.includes(prev.defaultTab) ? prev.defaultTab : ''

      return {
        ...prev,
        tabs: newTabs,
        defaultTab: newDefaultTab
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const url = editingPortal
        ? `/api/portals/${editingPortal.id}`
        : '/api/portals'
      const method = editingPortal ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: formData.subdomain.toLowerCase(),
          name: formData.name,
          description: formData.description || null,
          tabs: formData.tabs,
          defaultTab: formData.defaultTab || null,
          headerTitle: formData.headerTitle || null,
          isActive: formData.isActive
        })
      })

      if (response.ok) {
        setSuccess(editingPortal ? 'Portal updated successfully' : 'Portal created successfully')
        closeModal()
        fetchPortals()
      } else {
        const errData = await response.json()
        setError(errData.error || 'Failed to save portal')
      }
    } catch (err) {
      setError('Failed to save portal')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(portalId: number) {
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/portals/${portalId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSuccess('Portal deleted successfully')
        setDeleteConfirm(null)
        fetchPortals()
      } else {
        const errData = await response.json()
        setError(errData.error || 'Failed to delete portal')
      }
    } catch (err) {
      setError('Failed to delete portal')
    }
  }

  async function handleToggleActive(portal: Portal) {
    try {
      const response = await fetch(`/api/portals/${portal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !portal.isActive })
      })

      if (response.ok) {
        setSuccess(`Portal ${!portal.isActive ? 'activated' : 'deactivated'}`)
        fetchPortals()
      } else {
        const errData = await response.json()
        setError(errData.error || 'Failed to update portal')
      }
    } catch (err) {
      setError('Failed to update portal')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading portals...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Portal Management</h2>
          <p className="text-sm text-gray-600">
            Configure subdomain-based portals with restricted access
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Portal
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Portal List */}
      <div className="space-y-3">
        {portals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No portals configured yet</p>
            <p className="text-sm">Create a portal to enable subdomain-based access</p>
          </div>
        ) : (
          portals.map((portal) => (
            <div
              key={portal.id}
              className={`p-4 border rounded-lg ${
                portal.isActive
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{portal.name}</h3>
                    {portal.isActive ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-600 font-mono mt-1">
                    {portal.subdomain}.lineamotion.com
                  </p>
                  {portal.description && (
                    <p className="text-sm text-gray-600 mt-1">{portal.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {portal.tabs.map((tab) => (
                      <span
                        key={tab}
                        className={`text-xs px-2 py-0.5 rounded ${
                          tab === portal.defaultTab
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ALL_TABS.find(t => t.id === tab)?.label || tab}
                        {tab === portal.defaultTab && ' (default)'}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(portal)}
                    className={`p-2 rounded-lg transition-colors ${
                      portal.isActive
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={portal.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {portal.isActive ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => openEditModal(portal)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit portal"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  {deleteConfirm === portal.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(portal.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(portal.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete portal"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingPortal ? 'Edit Portal' : 'Create Portal'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Subdomain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subdomain *
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={formData.subdomain}
                    onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase() }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="purchasing"
                    required
                    pattern="[a-z0-9-]+"
                    title="Lowercase letters, numbers, and hyphens only"
                    disabled={!!editingPortal}
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                    .lineamotion.com
                  </span>
                </div>
                {editingPortal && (
                  <p className="text-xs text-gray-500 mt-1">Subdomain cannot be changed after creation</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Portal Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Purchasing Portal"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>

              {/* Header Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Header Title (optional)
                </label>
                <input
                  type="text"
                  value={formData.headerTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, headerTitle: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Text shown in sidebar header"
                />
              </div>

              {/* Tabs Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Tabs *
                </label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_TABS.map((tab) => (
                      <label
                        key={tab.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.tabs.includes(tab.id)}
                          onChange={() => handleTabToggle(tab.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{tab.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {formData.tabs.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Select at least one tab</p>
                )}
              </div>

              {/* Default Tab */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Tab
                </label>
                <select
                  value={formData.defaultTab}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultTab: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  disabled={formData.tabs.length === 0}
                >
                  <option value="">-- Select default tab --</option>
                  {formData.tabs.map((tabId) => {
                    const tab = ALL_TABS.find(t => t.id === tabId)
                    return (
                      <option key={tabId} value={tabId}>
                        {tab?.label || tabId}
                      </option>
                    )
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The tab users see first when visiting this portal
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Portal Active
                  </label>
                  <p className="text-xs text-gray-500">
                    Inactive portals show an error message to visitors
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.isActive ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || formData.tabs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingPortal ? 'Update Portal' : 'Create Portal'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

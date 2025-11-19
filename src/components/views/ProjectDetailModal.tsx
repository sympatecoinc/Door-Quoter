'use client'

import { useState, useEffect } from 'react'
import { X, ArrowLeft, Calendar, User, FileText, Users, Truck } from 'lucide-react'
import ProjectContacts from '../projects/ProjectContacts'
import ProjectNotes from '../projects/ProjectNotes'

interface Project {
  id: number
  name: string
  status: string
  dueDate: string | null
  shipDate: string | null
  shippingAddress: string | null
  shippingCity: string | null
  shippingState: string | null
  shippingZipCode: string | null
  primaryContactId: number | null
  createdAt: string
  updatedAt: string
  customer: {
    id: number
    companyName: string
    contacts: Contact[]
  }
  primaryContact: Contact | null
}

interface Contact {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  title: string | null
  isPrimary: boolean
}

interface ProjectDetailModalProps {
  projectId: number
  onBack: () => void
}

type TabType = 'overview' | 'contacts' | 'notes' | 'shipping'

export default function ProjectDetailModal({ projectId, onBack }: ProjectDetailModalProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Overview tab state
  const [shipDate, setShipDate] = useState<string>('')
  const [primaryContactId, setPrimaryContactId] = useState<number | null>(null)

  // Shipping tab state
  const [shippingAddress, setShippingAddress] = useState<string>('')
  const [shippingCity, setShippingCity] = useState<string>('')
  const [shippingState, setShippingState] = useState<string>('')
  const [shippingZipCode, setShippingZipCode] = useState<string>('')
  const [shippingShipDate, setShippingShipDate] = useState<string>('')

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      setProject(data)

      // Set form values
      setShipDate(data.shipDate ? data.shipDate.split('T')[0] : '')
      setPrimaryContactId(data.primaryContactId)

      // Set shipping form values
      setShippingAddress(data.shippingAddress || '')
      setShippingCity(data.shippingCity || '')
      setShippingState(data.shippingState || '')
      setShippingZipCode(data.shippingZipCode || '')
      setShippingShipDate(data.shipDate ? data.shipDate.split('T')[0] : '')
    } catch (err) {
      console.error('Error fetching project:', err)
      setError('Failed to load project details')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveShipDate = async () => {
    if (!project) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipDate: shipDate || null
        })
      })

      if (!response.ok) throw new Error('Failed to update ship date')

      await fetchProject()
    } catch (err) {
      console.error('Error saving ship date:', err)
      setError('Failed to save ship date')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePrimaryContact = async () => {
    if (!project) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryContactId: primaryContactId
        })
      })

      if (!response.ok) throw new Error('Failed to update primary contact')

      await fetchProject()
    } catch (err) {
      console.error('Error saving primary contact:', err)
      setError('Failed to save primary contact')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveShippingInfo = async () => {
    if (!project) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingAddress: shippingAddress || null,
          shippingCity: shippingCity || null,
          shippingState: shippingState || null,
          shippingZipCode: shippingZipCode || null,
          shipDate: shippingShipDate || null
        })
      })

      if (!response.ok) throw new Error('Failed to update shipping information')

      await fetchProject()
    } catch (err) {
      console.error('Error saving shipping information:', err)
      setError('Failed to save shipping information')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const statusColors: Record<string, string> = {
    'STAGING': 'bg-gray-100 text-gray-700',
    'APPROVED': 'bg-blue-100 text-blue-700',
    'REVISE': 'bg-yellow-100 text-yellow-700',
    'QUOTE_SENT': 'bg-purple-100 text-purple-700',
    'QUOTE_ACCEPTED': 'bg-green-100 text-green-700',
    'ACTIVE': 'bg-indigo-100 text-indigo-700',
    'COMPLETE': 'bg-emerald-100 text-emerald-700',
  }

  const statusLabels: Record<string, string> = {
    'STAGING': 'Staging',
    'APPROVED': 'Approved',
    'REVISE': 'Revise',
    'QUOTE_SENT': 'Quote Sent',
    'QUOTE_ACCEPTED': 'Quote Accepted',
    'ACTIVE': 'Active',
    'COMPLETE': 'Complete',
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-8">
          <div className="text-center text-gray-500">Loading project details...</div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-8">
          <div className="text-center text-red-600">Project not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Back to customer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
                <span className={`text-xs px-2 py-1 rounded ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
                  {statusLabels[project.status] || project.status}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">{project.customer.companyName}</div>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span>Due: {formatDate(project.dueDate)}</span>
                <span>Created: {formatDate(project.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'contacts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contacts
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </div>
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'shipping'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Shipping
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Ship Date Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Ship Date
                  </div>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={shipDate}
                    onChange={(e) => setShipDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  />
                  <button
                    onClick={handleSaveShipDate}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {project.shipDate && (
                  <div className="mt-2 text-sm text-gray-600">
                    Current: {formatDate(project.shipDate)}
                  </div>
                )}
              </div>

              {/* Primary Contact Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Primary Contact
                  </div>
                </label>
                <div className="flex gap-2">
                  <select
                    value={primaryContactId || ''}
                    onChange={(e) => setPrimaryContactId(e.target.value ? parseInt(e.target.value) : null)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  >
                    <option value="">No primary contact</option>
                    {project.customer.contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName}
                        {contact.title ? ` - ${contact.title}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSavePrimaryContact}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {project.primaryContact && (
                  <div className="mt-2 text-sm text-gray-600">
                    Current: {project.primaryContact.firstName} {project.primaryContact.lastName}
                    {project.primaryContact.email && ` (${project.primaryContact.email})`}
                  </div>
                )}
              </div>

              {/* Documents Placeholders */}
              <div className="space-y-4">
                {/* Packing List Placeholder */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Packing List</h3>
                  </div>
                  <p className="text-sm text-blue-700">
                    Packing list will be generated automatically when the project is ready for production.
                  </p>
                </div>

                {/* Shop Drawings Placeholder */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h3 className="font-medium text-purple-900">Shop Drawings</h3>
                  </div>
                  <p className="text-sm text-purple-700">
                    Shop drawings will be generated automatically based on the project specifications.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <ProjectContacts projectId={projectId} />
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <ProjectNotes projectId={projectId} />
          )}

          {/* Shipping Tab */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              {/* Shipping Address Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Shipping Address</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Enter street address"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={saving}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">City</label>
                      <input
                        type="text"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">State</label>
                      <input
                        type="text"
                        value={shippingState}
                        onChange={(e) => setShippingState(e.target.value)}
                        placeholder="State"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">Zip Code</label>
                      <input
                        type="text"
                        value={shippingZipCode}
                        onChange={(e) => setShippingZipCode(e.target.value)}
                        placeholder="Zip"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ship Date Section */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Ship Date
                  </div>
                </label>
                <input
                  type="date"
                  value={shippingShipDate}
                  onChange={(e) => setShippingShipDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
                {project.shipDate && (
                  <div className="mt-2 text-sm text-gray-600">
                    Current: {formatDate(project.shipDate)}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveShippingInfo}
                disabled={saving}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Shipping Information'}
              </button>

              {/* Packing List Placeholder */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Packing List</h3>
                </div>
                <p className="text-sm text-blue-700">
                  Packing list generation will be available soon. This will include all products and quantities for this shipment.
                </p>
              </div>

              {/* Labels Placeholder */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  <h3 className="font-medium text-purple-900">Shipping Labels</h3>
                </div>
                <p className="text-sm text-purple-700">
                  Shipping label generation will be available soon. This will automatically generate labels based on the shipping address.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

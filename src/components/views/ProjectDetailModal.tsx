'use client'

import { useState, useEffect } from 'react'
import { X, ArrowLeft, Calendar, User, FileText, Users, Truck, ShoppingCart, Download, Factory } from 'lucide-react'
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
  primaryProjectContactId: number | null
  createdAt: string
  updatedAt: string
  customer: {
    id: number
    companyName: string
    contacts: Contact[]
  }
  primaryContact: Contact | null
  primaryProjectContact: ProjectContact | null
  projectContacts: ProjectContact[]
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

interface ProjectContact {
  id: number
  projectId: number
  contactType: 'ARCHITECT' | 'GENERAL_CONTRACTOR' | 'OTHER'
  companyName: string | null
  name: string
  email: string | null
  phone: string | null
  notes: string | null
}

interface ProjectDetailModalProps {
  projectId: number
  onBack: () => void
}

type TabType = 'overview' | 'contacts' | 'notes' | 'shipping' | 'purchasing' | 'production'

interface SummaryItem {
  partNumber: string
  partName: string
  partType: string
  totalQuantity: number
  unit: string
  stockLength: number | null
  cutLengths: number[]
  totalCutLength: number
  totalArea: number
  glassDimensions: { width: number; height: number; area: number }[]
}

interface SummaryData {
  projectId: number
  projectName: string
  summaryItems: SummaryItem[]
  totalParts: number
  totalExtrusions: number
  totalHardware: number
  totalGlass: number
  totalOptions: number
}

interface CutListItem {
  productName: string
  panelWidth: number
  panelHeight: number
  sizeKey: string
  partNumber: string
  partName: string
  stockLength: number | null
  cutLength: number | null
  qtyPerUnit: number
  unitCount: number
  totalQty: number
  color: string
}

interface StockOptimization {
  partNumber: string
  partName: string
  stockLength: number
  totalCuts: number
  stockPiecesNeeded: number
  totalStockLength: number
  totalCutLength: number
  wasteLength: number
  wastePercent: number
}

interface CutListData {
  projectId: number
  projectName: string
  cutListItems: CutListItem[]
  stockOptimization: StockOptimization[]
  totalParts: number
  totalUniqueProducts: number
}

export default function ProjectDetailModal({ projectId, onBack }: ProjectDetailModalProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Overview tab state
  const [shipDate, setShipDate] = useState<string>('')
  const [selectedContactValue, setSelectedContactValue] = useState<string>('')

  // Shipping tab state
  const [shippingAddress, setShippingAddress] = useState<string>('')
  const [shippingCity, setShippingCity] = useState<string>('')
  const [shippingState, setShippingState] = useState<string>('')
  const [shippingZipCode, setShippingZipCode] = useState<string>('')
  const [shippingShipDate, setShippingShipDate] = useState<string>('')

  // Packing list state
  const [packingListData, setPackingListData] = useState<any[]>([])
  const [loadingPackingList, setLoadingPackingList] = useState(false)
  const [generatingStickers, setGeneratingStickers] = useState(false)

  // Purchasing tab state
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Production tab state
  const [cutListData, setCutListData] = useState<CutListData | null>(null)
  const [loadingCutList, setLoadingCutList] = useState(false)
  const [batchSizes, setBatchSizes] = useState<Record<string, number>>({})
  const [downloadingProduct, setDownloadingProduct] = useState<string | null>(null)

  useEffect(() => {
    fetchProject()
  }, [projectId])

  useEffect(() => {
    if (activeTab === 'shipping' && projectId) {
      fetchPackingList()
    }
    if (activeTab === 'purchasing' && projectId) {
      fetchPurchasingSummary()
    }
    if (activeTab === 'production' && projectId) {
      fetchCutList()
    }
  }, [activeTab, projectId])

  const fetchPackingList = async () => {
    try {
      setLoadingPackingList(true)
      const response = await fetch(`/api/projects/${projectId}/packing-list`)
      if (response.ok) {
        const data = await response.json()
        setPackingListData(data.packingList || [])
      }
    } catch (err) {
      console.error('Error fetching packing list:', err)
    } finally {
      setLoadingPackingList(false)
    }
  }

  const handleGenerateStickers = async () => {
    try {
      setGeneratingStickers(true)
      const response = await fetch(`/api/projects/${projectId}/packing-list/stickers`)

      if (!response.ok) {
        throw new Error('Failed to generate stickers')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-packing-stickers.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating stickers:', error)
      alert('Failed to generate stickers PDF')
    } finally {
      setGeneratingStickers(false)
    }
  }

  const fetchPurchasingSummary = async () => {
    try {
      setLoadingSummary(true)
      const response = await fetch(`/api/projects/${projectId}/bom?summary=true`)
      if (response.ok) {
        const data = await response.json()
        setSummaryData(data)
      }
    } catch (err) {
      console.error('Error fetching purchasing summary:', err)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleDownloadPurchasingCSV = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/bom?summary=true&format=csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project?.name || 'project'}-purchasing-summary.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading CSV:', err)
    }
  }

  const fetchCutList = async () => {
    try {
      setLoadingCutList(true)
      const response = await fetch(`/api/projects/${projectId}/bom?cutlist=true`)
      if (response.ok) {
        const data = await response.json()
        setCutListData(data)
      }
    } catch (err) {
      console.error('Error fetching cut list:', err)
    } finally {
      setLoadingCutList(false)
    }
  }

  const handleDownloadProductCutListCSV = async (productName: string) => {
    try {
      setDownloadingProduct(productName)
      const batchSize = batchSizes[productName] || 1
      const response = await fetch(`/api/projects/${projectId}/bom?cutlist=true&format=csv&product=${encodeURIComponent(productName)}&batch=${batchSize}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project?.name || 'project'}-${productName.replace(/\s+/g, '-')}-${batchSize}units-cutlist.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading cut list CSV:', err)
    } finally {
      setDownloadingProduct(null)
    }
  }


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

      // Set selected contact (either customer contact or project contact)
      if (data.primaryContactId) {
        setSelectedContactValue(`customer-${data.primaryContactId}`)
      } else if (data.primaryProjectContactId) {
        setSelectedContactValue(`project-${data.primaryProjectContactId}`)
      } else {
        setSelectedContactValue('')
      }

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

      // Parse the selected contact value
      let primaryContactId = null
      let primaryProjectContactId = null

      if (selectedContactValue) {
        const [type, id] = selectedContactValue.split('-')
        if (type === 'customer') {
          primaryContactId = parseInt(id)
        } else if (type === 'project') {
          primaryProjectContactId = parseInt(id)
        }
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryContactId,
          primaryProjectContactId
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
          <button
            onClick={() => setActiveTab('purchasing')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'purchasing'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Purchasing
            </div>
          </button>
          <button
            onClick={() => setActiveTab('production')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'production'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4" />
              Production
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
                    value={selectedContactValue}
                    onChange={(e) => setSelectedContactValue(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={saving}
                  >
                    <option value="">No primary contact</option>

                    {/* Customer Contacts */}
                    {project.customer.contacts.length > 0 && (
                      <optgroup label="Company Contacts">
                        {project.customer.contacts.map((contact) => (
                          <option key={`customer-${contact.id}`} value={`customer-${contact.id}`}>
                            {contact.firstName} {contact.lastName}
                            {contact.title ? ` - ${contact.title}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Divider between contact types */}
                    {project.projectContacts && project.projectContacts.length > 0 && (
                      <optgroup label="──────────────────────"></optgroup>
                    )}

                    {/* Project Contacts */}
                    {project.projectContacts && project.projectContacts.length > 0 && (
                      <optgroup label="Project Contacts">
                        {project.projectContacts.map((contact) => (
                          <option key={`project-${contact.id}`} value={`project-${contact.id}`}>
                            {contact.name}
                            {contact.companyName ? ` - ${contact.companyName}` : ` - ${contact.contactType.replace('_', ' ')}`}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    onClick={handleSavePrimaryContact}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                {(project.primaryContact || project.primaryProjectContact) && (
                  <div className="mt-2 text-sm text-gray-600">
                    Current: {project.primaryContact
                      ? `${project.primaryContact.firstName} ${project.primaryContact.lastName}${project.primaryContact.email ? ` (${project.primaryContact.email})` : ''}`
                      : `${project.primaryProjectContact?.name}${project.primaryProjectContact?.email ? ` (${project.primaryProjectContact.email})` : ''}`
                    }
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                {/* Packing List Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">Packing List</h3>
                  </div>

                  {loadingPackingList ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : packingListData.length === 0 ? (
                    <p className="text-sm text-blue-700">
                      No items configured for packing list yet. Add hardware items to product BOMs and mark them with &quot;Add to packing list&quot;.
                    </p>
                  ) : (
                    <div className="space-y-4 mt-4">
                      {packingListData.map((opening) => (
                        <div key={opening.openingId} className="bg-white rounded-lg p-4 border border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-3">{opening.openingName}</h4>

                          {/* Components Section */}
                          {opening.components && opening.components.length > 0 && (
                            <div className="mb-3">
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Components:</h5>
                              <ul className="space-y-1 text-sm text-gray-600">
                                {opening.components.map((comp: any, idx: number) => (
                                  <li key={idx}>
                                    • {comp.productName} - {comp.panelType} ({comp.width}&quot; x {comp.height}&quot;) - {comp.glassType}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Hardware Section */}
                          {opening.hardware && opening.hardware.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 mb-2">Hardware:</h5>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Part</th>
                                    <th className="px-2 py-1 text-left">Part #</th>
                                    <th className="px-2 py-1 text-left">Qty</th>
                                    <th className="px-2 py-1 text-left">Unit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {opening.hardware.map((hw: any, idx: number) => (
                                    <tr key={idx} className="text-gray-700">
                                      <td className="px-2 py-1">{hw.partName}</td>
                                      <td className="px-2 py-1 font-mono text-xs">{hw.partNumber || '-'}</td>
                                      <td className="px-2 py-1">{hw.quantity || '-'}</td>
                                      <td className="px-2 py-1">{hw.unit || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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

              {/* Packing List Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Packing List</h3>
                </div>

                {loadingPackingList ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : packingListData.length === 0 ? (
                  <p className="text-sm text-blue-700">
                    No items configured for packing list yet. Add hardware items to product BOMs and mark them with &quot;Add to packing list&quot;.
                  </p>
                ) : (
                  <div className="space-y-4 mt-4">
                    {packingListData.map((opening) => (
                      <div key={opening.openingId} className="bg-white rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">{opening.openingName}</h4>

                        {/* Components Section */}
                        {opening.components && opening.components.length > 0 && (
                          <div className="mb-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Components:</h5>
                            <ul className="space-y-1 text-sm text-gray-600">
                              {opening.components.map((comp: any, idx: number) => (
                                <li key={idx}>
                                  • {comp.productName} - {comp.panelType} ({comp.width}&quot; x {comp.height}&quot;) - {comp.glassType}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Hardware Section */}
                        {opening.hardware && opening.hardware.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Hardware:</h5>
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                  <th className="px-2 py-1 text-left">Part</th>
                                  <th className="px-2 py-1 text-left">Part #</th>
                                  <th className="px-2 py-1 text-left">Qty</th>
                                  <th className="px-2 py-1 text-left">Unit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {opening.hardware.map((hw: any, idx: number) => (
                                  <tr key={idx} className="text-gray-700">
                                    <td className="px-2 py-1">{hw.partName}</td>
                                    <td className="px-2 py-1 font-mono text-xs">{hw.partNumber || '-'}</td>
                                    <td className="px-2 py-1">{hw.quantity || '-'}</td>
                                    <td className="px-2 py-1">{hw.unit || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Packing Stickers */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <h3 className="font-medium text-purple-900">Packing Stickers</h3>
                  </div>
                  <button
                    onClick={handleGenerateStickers}
                    disabled={generatingStickers || packingListData.length === 0}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingStickers ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Generate Stickers PDF
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-purple-700">
                  Generate a printable PDF with 6 stickers per page (8.5&quot; x 11&quot;). Each component and hardware piece gets its own sticker with opening name and QR code. Cut along dotted lines.
                </p>
              </div>
            </div>
          )}

          {/* Purchasing Tab */}
          {activeTab === 'purchasing' && (
            <div className="space-y-6">
              {/* Header with Download Button */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Purchasing Summary</h3>
                <button
                  onClick={handleDownloadPurchasingCSV}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>
              </div>

              {loadingSummary ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : summaryData ? (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                      <div className="text-2xl font-bold text-gray-900">{summaryData.totalParts.toFixed(2)}</div>
                      <div className="text-sm text-gray-600">Total Parts</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700">{summaryData.totalExtrusions}</div>
                      <div className="text-sm text-blue-600">Extrusions</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">{summaryData.totalHardware.toFixed(2)}</div>
                      <div className="text-sm text-purple-600">Hardware</div>
                    </div>
                    <div className="bg-cyan-50 rounded-lg p-4 text-center border border-cyan-200">
                      <div className="text-2xl font-bold text-cyan-700">{summaryData.totalGlass}</div>
                      <div className="text-sm text-cyan-600">Glass</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-200">
                      <div className="text-2xl font-bold text-amber-700">{summaryData.totalOptions}</div>
                      <div className="text-sm text-amber-600">Options</div>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {summaryData.summaryItems.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">{item.partNumber}</td>
                            <td className="px-4 py-3">{item.partName}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs ${
                                item.partType === 'Extrusion' ? 'bg-blue-100 text-blue-700' :
                                item.partType === 'Hardware' ? 'bg-purple-100 text-purple-700' :
                                item.partType === 'Glass' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {item.partType}
                              </span>
                            </td>
                            <td className="px-4 py-3">{item.totalQuantity}</td>
                            <td className="px-4 py-3">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No purchasing data available
                </div>
              )}
            </div>
          )}

          {/* Production Tab */}
          {activeTab === 'production' && (
            <div className="space-y-6">
              {loadingCutList ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : cutListData && cutListData.cutListItems.length > 0 ? (
                <>
                  {/* Product Cut List Cards */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Download Cut Lists by Product</h4>
                    {(() => {
                      const productGroups = cutListData.cutListItems.reduce((acc, item) => {
                        if (!acc[item.productName]) {
                          acc[item.productName] = []
                        }
                        acc[item.productName].push(item)
                        return acc
                      }, {} as Record<string, CutListItem[]>)

                      return Object.entries(productGroups).map(([productName, items]) => {
                        // Calculate total units (sum of unique unit counts across all sizes)
                        const totalUnits = items.reduce((sum, item) => sum + item.unitCount, 0) / items.reduce((sum, item) => sum + item.qtyPerUnit, 0) * items[0]?.qtyPerUnit || 0
                        // Get unique unit count (number of product instances)
                        const uniqueSizes = new Set(items.map(item => item.sizeKey)).size
                        const unitCount = items[0]?.unitCount || 1
                        const uniqueCuts = items.length
                        const totalParts = items.reduce((sum, item) => sum + item.totalQty, 0)
                        const partsPerUnit = items.reduce((sum, item) => sum + item.qtyPerUnit, 0)

                        const batchSize = batchSizes[productName] || unitCount
                        const partsInBatch = partsPerUnit * batchSize

                        return (
                          <div key={productName} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 text-lg">{productName}</h5>
                                <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Total Units:</span>
                                    <span className="ml-2 font-medium">{unitCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Unique Cuts:</span>
                                    <span className="ml-2 font-medium">{uniqueCuts}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Parts/Unit:</span>
                                    <span className="ml-2 font-medium">{partsPerUnit}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total Parts:</span>
                                    <span className="ml-2 font-medium">{totalParts}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 ml-4">
                                <div className="text-right">
                                  <label className="block text-xs text-gray-500 mb-1">Units per Batch</label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={unitCount}
                                    value={batchSize}
                                    onChange={(e) => setBatchSizes(prev => ({
                                      ...prev,
                                      [productName]: Math.min(unitCount, Math.max(1, parseInt(e.target.value) || 1))
                                    }))}
                                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-center text-sm"
                                  />
                                  <div className="text-xs text-gray-400 mt-1">
                                    {partsInBatch} parts/batch
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadProductCutListCSV(productName)}
                                  disabled={downloadingProduct === productName}
                                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                                >
                                  {downloadingProduct === productName ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                  ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                  )}
                                  Download CSV
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
                      <div className="text-2xl font-bold text-blue-700">{cutListData.totalParts}</div>
                      <div className="text-sm text-blue-600">Total Extrusion Parts</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
                      <div className="text-2xl font-bold text-purple-700">{cutListData.totalUniqueProducts}</div>
                      <div className="text-sm text-purple-600">Unique Product Sizes</div>
                    </div>
                  </div>

                  {/* Stock Optimization Section */}
                  {cutListData.stockOptimization.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Stock Optimization</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-green-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Part Number</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Part Name</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Stock Length</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Total Cuts</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Stock Pieces Needed</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Waste %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-200">
                            {cutListData.stockOptimization.map((opt, index) => (
                              <tr key={index} className="hover:bg-green-100">
                                <td className="px-3 py-2 font-mono text-xs">{opt.partNumber}</td>
                                <td className="px-3 py-2">{opt.partName}</td>
                                <td className="px-3 py-2 text-center">{opt.stockLength}"</td>
                                <td className="px-3 py-2 text-center">{opt.totalCuts}</td>
                                <td className="px-3 py-2 text-center font-medium">{opt.stockPiecesNeeded}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    opt.wastePercent < 10 ? 'bg-green-200 text-green-800' :
                                    opt.wastePercent < 25 ? 'bg-yellow-200 text-yellow-800' :
                                    'bg-red-200 text-red-800'
                                  }`}>
                                    {opt.wastePercent.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No cut list data available. Add extrusion parts to product BOMs to generate cut lists.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

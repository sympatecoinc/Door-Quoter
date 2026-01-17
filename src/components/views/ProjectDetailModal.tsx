'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, User, FileText, Users, Truck, ShoppingCart, Download, Factory, Edit } from 'lucide-react'
import ProjectContacts from '../projects/ProjectContacts'
import ProjectNotes from '../projects/ProjectNotes'
import { useEscapeKey } from '../../hooks/useEscapeKey'

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
  onEdit?: () => void
  onStatusChange?: () => void
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

interface MiscellaneousCutListItem {
  partNumber: string
  partName: string
  stockLength: number | null
  cutLength: number | null
  totalQty: number
  color: string
  openings: string[]
}

interface CutListData {
  projectId: number
  projectName: string
  cutListItems: CutListItem[]
  miscellaneousCutList?: MiscellaneousCutListItem[]
  stockOptimization: StockOptimization[]
  totalParts: number
  totalUniqueProducts: number
}

export default function ProjectDetailModal({ projectId, onBack, onEdit, onStatusChange }: ProjectDetailModalProps) {
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
  const [downloadingMisc, setDownloadingMisc] = useState(false)
  const [downloadingAssembly, setDownloadingAssembly] = useState(false)

  // Pick List state
  const [pickListData, setPickListData] = useState<any | null>(null)
  const [loadingPickList, setLoadingPickList] = useState(false)
  const [downloadingPickList, setDownloadingPickList] = useState(false)

  // Jamb Kit List state
  const [jambKitData, setJambKitData] = useState<any | null>(null)
  const [loadingJambKit, setLoadingJambKit] = useState(false)
  const [downloadingJambKit, setDownloadingJambKit] = useState(false)

  // Edit Project modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [updatingProject, setUpdatingProject] = useState(false)

  // Print All state
  const [downloadingPrintAll, setDownloadingPrintAll] = useState(false)

  // Archive confirmation state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen: showArchiveConfirm, isBlocked: updatingProject, onClose: () => setShowArchiveConfirm(false) },
    { isOpen: showEditModal, isBlocked: updatingProject, onClose: () => setShowEditModal(false) },
    { isOpen: true, isBlocked: saving, onClose: onBack },
  ])

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
      fetchPickList()
      fetchJambKit()
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

  const fetchPickList = async () => {
    try {
      setLoadingPickList(true)
      const response = await fetch(`/api/projects/${projectId}/bom?picklist=true`)
      if (response.ok) {
        const data = await response.json()
        setPickListData(data)
      }
    } catch (err) {
      console.error('Error fetching pick list:', err)
    } finally {
      setLoadingPickList(false)
    }
  }

  const handleDownloadPickListPDF = async () => {
    try {
      setDownloadingPickList(true)
      const response = await fetch(`/api/projects/${projectId}/bom?picklist=true&format=pdf`)

      if (!response.ok) {
        throw new Error('Failed to generate pick list')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-pick-list.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating pick list:', error)
      alert('Failed to generate pick list PDF')
    } finally {
      setDownloadingPickList(false)
    }
  }

  const fetchJambKit = async () => {
    try {
      setLoadingJambKit(true)
      const response = await fetch(`/api/projects/${projectId}/bom?jambkit=true`)
      if (response.ok) {
        const data = await response.json()
        setJambKitData(data)
      }
    } catch (err) {
      console.error('Error fetching jamb kit list:', err)
    } finally {
      setLoadingJambKit(false)
    }
  }

  const handleDownloadJambKitPDF = async () => {
    try {
      setDownloadingJambKit(true)
      const response = await fetch(`/api/projects/${projectId}/bom?jambkit=true&format=pdf`)

      if (!response.ok) {
        throw new Error('Failed to generate jamb kit list')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-jamb-kit-list.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating jamb kit list:', error)
      alert('Failed to generate jamb kit list PDF')
    } finally {
      setDownloadingJambKit(false)
    }
  }

  const handleDownloadMiscCutListCSV = () => {
    if (!cutListData?.miscellaneousCutList || cutListData.miscellaneousCutList.length === 0) return

    setDownloadingMisc(true)
    try {
      const headers = ['Part Number', 'Part Name', 'Color', 'Cut Length', 'Stock Length', 'Qty', 'Openings']
      const rows = cutListData.miscellaneousCutList.map(item => [
        item.partNumber,
        item.partName,
        item.color,
        item.cutLength ? `${item.cutLength.toFixed(3)}"` : '',
        item.stockLength ? `${item.stockLength}"` : 'N/A',
        item.totalQty,
        item.openings.join('; ')
      ].map(field => `"${String(field).replace(/"/g, '""')}"`))

      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-miscellaneous-cutlist.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } finally {
      setDownloadingMisc(false)
    }
  }

  const handleDownloadProductCutListCSV = async (productSizeKey: string) => {
    try {
      setDownloadingProduct(productSizeKey)
      // Parse the product+size key (format: "productName|sizeKey")
      const [productName, sizeKey] = productSizeKey.split('|')
      // Get the unit count from cutListData for this product+size combo
      const productItems = cutListData?.cutListItems.filter(
        item => item.productName === productName && item.sizeKey === sizeKey
      ) || []
      const unitCount = productItems[0]?.unitCount || 1
      const batchSize = batchSizes[productSizeKey] || unitCount
      // Include size filter in API call
      const response = await fetch(`/api/projects/${projectId}/bom?cutlist=true&format=csv&product=${encodeURIComponent(productName)}&size=${encodeURIComponent(sizeKey)}&batch=${batchSize}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project?.name || 'project'}-${productName.replace(/\s+/g, '-')}-${sizeKey}-${batchSize}units-cutlist.csv`
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

  const handleDownloadAssemblyList = async () => {
    try {
      setDownloadingAssembly(true)
      const response = await fetch(`/api/projects/${projectId}/bom?assembly=true&format=pdf`)

      if (!response.ok) {
        throw new Error('Failed to generate assembly list')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project?.name || 'project'}-assembly-list.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error generating assembly list:', error)
      alert('Failed to generate assembly list PDF')
    } finally {
      setDownloadingAssembly(false)
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

  const handleOpenEditModal = () => {
    if (!project) return
    setEditName(project.name)
    setEditStatus(project.status)
    setEditDueDate(project.dueDate ? project.dueDate.split('T')[0] : '')
    setShowEditModal(true)
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    try {
      setUpdatingProject(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          dueDate: editDueDate || null
        })
      })

      if (!response.ok) throw new Error('Failed to update project')

      await fetchProject()
      setShowEditModal(false)
    } catch (err) {
      console.error('Error saving project:', err)
      setError('Failed to save project')
    } finally {
      setUpdatingProject(false)
    }
  }

  const handleArchiveProject = async () => {
    if (!project) return

    try {
      setUpdatingProject(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ARCHIVE'
        })
      })

      if (!response.ok) throw new Error('Failed to archive project')

      setShowArchiveConfirm(false)
      onStatusChange?.()
      onBack()
    } catch (err) {
      console.error('Error archiving project:', err)
      setError('Failed to archive project')
    } finally {
      setUpdatingProject(false)
    }
  }

  const handleDownloadPrintAll = async () => {
    if (!project) return

    setDownloadingPrintAll(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/print-all`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url

        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = `${project.name}-PrintAll.zip`
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        console.error('Failed to download print all package')
      }
    } catch (error) {
      console.error('Error downloading print all package:', error)
    } finally {
      setDownloadingPrintAll(false)
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
    'ARCHIVE': 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    'STAGING': 'Staging',
    'APPROVED': 'Approved',
    'REVISE': 'Revise',
    'QUOTE_SENT': 'Quote Sent',
    'QUOTE_ACCEPTED': 'Quote Accepted',
    'ACTIVE': 'Active',
    'COMPLETE': 'Complete',
    'ARCHIVE': 'Archived',
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
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">{project.name}</h2>
              <span className={`text-xs px-2 py-1 rounded ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
                {statusLabels[project.status] || project.status}
              </span>
              <button
                onClick={handleOpenEditModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit project"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownloadPrintAll}
                disabled={downloadingPrintAll}
                className="text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
                title="Download all project files (Cut List, Pick List, Jamb Kit List, BOMs)"
              >
                {downloadingPrintAll ? (
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-sm text-gray-500 mt-1">{project.customer.companyName}</div>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>Due: {formatDate(project.dueDate)}</span>
              <span>Created: {formatDate(project.createdAt)}</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-600 transition-colors self-start"
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
                                    <th className="px-2 py-1 text-left">Length</th>
                                    <th className="px-2 py-1 text-left">Unit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {opening.hardware.map((hw: any, idx: number) => (
                                    <tr key={idx} className="text-gray-700">
                                      <td className="px-2 py-1">{hw.partName}</td>
                                      <td className="px-2 py-1 font-mono text-xs">{hw.partNumber || '-'}</td>
                                      <td className="px-2 py-1">{hw.quantity || '-'}</td>
                                      <td className="px-2 py-1">{hw.calculatedLength ? hw.calculatedLength.toFixed(3) : '-'}</td>
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
            <ProjectContacts projectId={projectId} customerId={project?.customer?.id} />
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
                                  <th className="px-2 py-1 text-left">Length</th>
                                  <th className="px-2 py-1 text-left">Unit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {opening.hardware.map((hw: any, idx: number) => (
                                  <tr key={idx} className="text-gray-700">
                                    <td className="px-2 py-1">{hw.partName}</td>
                                    <td className="px-2 py-1 font-mono text-xs">{hw.partNumber || '-'}</td>
                                    <td className="px-2 py-1">{hw.quantity || '-'}</td>
                                    <td className="px-2 py-1">{hw.calculatedLength ? hw.calculatedLength.toFixed(3) : '-'}</td>
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
              ) : cutListData && (cutListData.cutListItems.length > 0 || (cutListData.miscellaneousCutList && cutListData.miscellaneousCutList.length > 0)) ? (
                <>
                  {/* Product Cut List Cards - grouped by product AND size */}
                  {cutListData.cutListItems.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Download Cut Lists by Product & Size</h4>
                    {(() => {
                      // Group by product + size to properly show unit counts for each size
                      const productSizeGroups = cutListData.cutListItems.reduce((acc, item) => {
                        const key = `${item.productName}|${item.sizeKey}`
                        if (!acc[key]) {
                          acc[key] = []
                        }
                        acc[key].push(item)
                        return acc
                      }, {} as Record<string, CutListItem[]>)

                      return Object.entries(productSizeGroups).map(([key, items]) => {
                        const [productName, sizeKey] = key.split('|')
                        // All items in this group have the same unitCount since they're same product+size
                        const unitCount = items[0]?.unitCount || 1
                        const uniqueCuts = items.length
                        const totalParts = items.reduce((sum, item) => sum + item.totalQty, 0)
                        const partsPerUnit = items.reduce((sum, item) => sum + item.qtyPerUnit, 0)
                        const panelWidth = items[0]?.panelWidth || 0
                        const panelHeight = items[0]?.panelHeight || 0

                        const batchKey = `${productName}|${sizeKey}`
                        const batchSize = batchSizes[batchKey] || unitCount
                        const partsInBatch = partsPerUnit * batchSize

                        return (
                          <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 text-lg">{productName}</h5>
                                <div className="text-sm text-gray-600 mt-1">{panelWidth}" x {panelHeight}"</div>
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
                                      [batchKey]: Math.min(unitCount, Math.max(1, parseInt(e.target.value) || 1))
                                    }))}
                                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-center text-sm"
                                  />
                                  <div className="text-xs text-gray-400 mt-1">
                                    {partsInBatch} parts/batch
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDownloadProductCutListCSV(`${productName}|${sizeKey}`)}
                                  disabled={downloadingProduct === `${productName}|${sizeKey}`}
                                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                                >
                                  {downloadingProduct === `${productName}|${sizeKey}` ? (
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
                  )}

                  {/* Miscellaneous Cut List Section */}
                  {cutListData.miscellaneousCutList && cutListData.miscellaneousCutList.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h4 className="font-medium text-amber-900">Miscellaneous Cut List</h4>
                          <p className="text-sm text-amber-700">
                            Additional extrusions for opening accessories (starter channels, trim, etc.)
                          </p>
                        </div>
                        <button
                          onClick={handleDownloadMiscCutListCSV}
                          disabled={downloadingMisc}
                          className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm disabled:opacity-50"
                        >
                          {downloadingMisc ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Download CSV
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-amber-100">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-amber-700 uppercase">Part Number</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-amber-700 uppercase">Part Name</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-amber-700 uppercase">Color</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-amber-700 uppercase">Cut Length</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-amber-700 uppercase">Stock Length</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-amber-700 uppercase">Qty</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-amber-700 uppercase">Openings</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-200">
                            {cutListData.miscellaneousCutList.map((item, index) => (
                              <tr key={index} className="hover:bg-amber-100">
                                <td className="px-3 py-2 font-mono text-xs">{item.partNumber}</td>
                                <td className="px-3 py-2">{item.partName}</td>
                                <td className="px-3 py-2 text-center">{item.color}</td>
                                <td className="px-3 py-2 text-center">{item.cutLength?.toFixed(3)}"</td>
                                <td className="px-3 py-2 text-center">{item.stockLength ? `${item.stockLength}"` : 'N/A'}</td>
                                <td className="px-3 py-2 text-center font-medium">{item.totalQty}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{item.openings.join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

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

              {/* Assembly List Section - Always visible */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-indigo-900">Assembly List</h4>
                    <p className="text-sm text-indigo-700">
                      Download a PDF showing all product types, sizes, and quantities for shop floor assembly.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadAssemblyList}
                    disabled={downloadingAssembly || loadingCutList}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {downloadingAssembly ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pick List Section */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-purple-900">Pick List</h4>
                    <p className="text-sm text-purple-700">
                      Hardware items marked for pick list, grouped by product.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPickListPDF}
                    disabled={downloadingPickList || loadingPickList || !pickListData?.pickListItems?.length}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {downloadingPickList ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>

                {loadingPickList ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  </div>
                ) : pickListData?.pickListItems?.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group by product */}
                    {pickListData.productGroups?.map((productName: string) => {
                      const productItems = pickListData.pickListItems.filter(
                        (item: any) => item.productName === productName
                      )
                      if (productItems.length === 0) return null

                      return (
                        <div key={productName} className="bg-white rounded-lg border border-purple-200 overflow-hidden">
                          <div className="bg-purple-100 px-3 py-2">
                            <h5 className="font-medium text-purple-900">{productName}</h5>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-purple-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Part Number</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-purple-700 uppercase">Part Name</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-purple-700 uppercase">Qty</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-purple-700 uppercase">Unit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-100">
                              {productItems.map((item: any, index: number) => (
                                <tr key={index} className="hover:bg-purple-50">
                                  <td className="px-3 py-2 font-mono text-xs">{item.partNumber}</td>
                                  <td className="px-3 py-2">{item.partName}</td>
                                  <td className="px-3 py-2 text-center font-medium">{item.totalQuantity}</td>
                                  <td className="px-3 py-2 text-center">{item.unit || 'EA'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })}

                    {/* Summary */}
                    <div className="flex justify-between text-sm text-purple-700 pt-2 border-t border-purple-200">
                      <span>Total Items: <strong>{pickListData.totalItems}</strong></span>
                      <span>Products: <strong>{pickListData.productGroups?.length || 0}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-purple-600 text-sm">
                    No pick list items. Mark hardware parts with &quot;Include on Pick List&quot; in Master Parts.
                  </div>
                )}
              </div>

              {/* Jamb Kit List Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-green-900">Jamb Kit List</h4>
                    <p className="text-sm text-green-700">
                      Jamb kit items grouped by opening for field installation.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadJambKitPDF}
                    disabled={downloadingJambKit || loadingJambKit || !jambKitData?.jambKitList?.length}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {downloadingJambKit ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </>
                    )}
                  </button>
                </div>

                {loadingJambKit ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  </div>
                ) : jambKitData?.jambKitList?.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group by opening */}
                    {jambKitData.jambKitList.map((opening: any) => (
                      <div key={opening.openingName} className="bg-white rounded-lg border border-green-200 overflow-hidden">
                        <div className="bg-green-100 px-3 py-2">
                          <h5 className="font-medium text-green-900">{opening.openingName}</h5>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-green-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Part Number</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase">Part Name</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Qty</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-green-700 uppercase">Unit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-green-100">
                            {opening.items.map((item: any, index: number) => (
                              <tr key={index} className="hover:bg-green-50">
                                <td className="px-3 py-2 font-mono text-xs">{item.partNumber}</td>
                                <td className="px-3 py-2">{item.partName}</td>
                                <td className="px-3 py-2 text-center font-medium">{item.totalQuantity}</td>
                                <td className="px-3 py-2 text-center">{item.unit || 'EA'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Summary */}
                    <div className="flex justify-between text-sm text-green-700 pt-2 border-t border-green-200">
                      <span>Total Items: <strong>{jambKitData.totalItems}</strong></span>
                      <span>Openings: <strong>{jambKitData.totalOpenings || 0}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-green-600 text-sm">
                    No jamb kit items. Mark hardware parts with &quot;Include in Jamb Kit&quot; in Master Parts.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Project</h2>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={updatingProject}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={updatingProject}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  disabled={updatingProject}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={updatingProject}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProject}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingProject ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
            {project.status !== 'ARCHIVE' && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={updatingProject}
                  className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Archive Project
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Archive Project
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to archive <strong>{project?.name}</strong>? It will be hidden from normal project views.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-orange-700">
                You can restore this project later by changing its status from the archived projects list.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={updatingProject}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveProject}
                disabled={updatingProject}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center"
              >
                {updatingProject && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {updatingProject ? 'Archiving...' : 'Archive Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

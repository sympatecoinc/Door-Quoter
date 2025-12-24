'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Calendar, DollarSign, Briefcase, CheckCircle, Clock, AlertCircle, Archive, FileText, X, Download, List, Search, Trash2 } from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG, LEAD_STATUSES, PROJECT_STATUSES, LEAD_FILTER_STATUSES, PROJECT_FILTER_STATUSES } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import LeadForm from './LeadForm'

interface Project {
  id: number
  name: string
  status: string
  customerId: number
  createdAt: string
  updatedAt: string
  dueDate?: string
  taxRate?: number
  pricingModeId?: number | null
  openings: {
    id: number
    name: string
    price: number
    roughWidth: number
    roughHeight: number
  }[]
}

interface Customer {
  id: number
  companyName: string
  contactName?: string
}

interface CustomerProjectsProps {
  customerId: number
  customer: Customer
  onProjectClick?: (projectId: number) => void
  showFullHeader?: boolean
  filterType?: 'all' | 'leads' | 'projects'  // Filter to show only leads, only projects, or all
  refreshKey?: number  // When this changes, refetch projects
  onStatusChange?: () => void  // Called when project status changes to trigger sibling refresh
}

export default function CustomerProjects({ customerId, customer, onProjectClick, showFullHeader = false, filterType = 'all', refreshKey, onStatusChange }: CustomerProjectsProps) {
  const { setSelectedProjectId, setCurrentMenu, setAutoOpenAddOpening } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showLeadForm, setShowLeadForm] = useState(false)


  // Edit modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editTaxRate, setEditTaxRate] = useState('0')
  const [editPricingModeId, setEditPricingModeId] = useState<number | null>(null)
  const [updating, setUpdating] = useState(false)

  // Pricing modes
  const [pricingModes, setPricingModes] = useState<any[]>([])

  // Status change confirmation
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{
    projectId: number
    projectName: string
    newStatus: string
    newStatusLabel: string
  } | null>(null)

  // BOM modal state
  const [showBOM, setShowBOM] = useState(false)
  const [bomData, setBomData] = useState<any>(null)
  const [loadingBOM, setLoadingBOM] = useState(false)
  const [bomProjectId, setBomProjectId] = useState<number | null>(null)
  const [bomProjectName, setBomProjectName] = useState<string>('')

  // Unique BOM selection state
  const [showBOMDownloadDialog, setShowBOMDownloadDialog] = useState(false)
  const [uniqueBomList, setUniqueBomList] = useState<any[]>([])
  const [selectedBomHashes, setSelectedBomHashes] = useState<Set<string>>(new Set())
  const [loadingUniqueBoms, setLoadingUniqueBoms] = useState(false)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: number; projectName: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Quote accepted edit confirmation state
  const [quoteAcceptedEditConfirm, setQuoteAcceptedEditConfirm] = useState<Project | null>(null)

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: quoteAcceptedEditConfirm !== null, onClose: () => setQuoteAcceptedEditConfirm(null) },
    { isOpen: deleteConfirm !== null, isBlocked: deleting, onClose: () => setDeleteConfirm(null) },
    { isOpen: showBOMDownloadDialog, onClose: () => setShowBOMDownloadDialog(false) },
    { isOpen: showBOM, onClose: () => setShowBOM(false) },
    { isOpen: showLeadForm, onClose: () => setShowLeadForm(false) },
    { isOpen: editingProject !== null, onClose: () => setEditingProject(null) },
  ])

  useEffect(() => {
    fetchProjects()
    fetchPricingModes()
  }, [customerId, refreshKey])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/projects`)
      if (response.ok) {
        const projectsData = await response.json()
        setProjects(projectsData)
      } else {
        console.error('Failed to fetch projects')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPricingModes = async () => {
    try {
      const response = await fetch('/api/pricing-modes')
      if (response.ok) {
        const modesData = await response.json()
        setPricingModes(modesData)
      }
    } catch (error) {
      console.error('Error fetching pricing modes:', error)
    }
  }

  const handleCreateLead = async (leadData: any) => {
    // Create a Project with STAGING status (lead phase) instead of a separate Lead record
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: leadData.title,
        customerId: customerId,
        status: ProjectStatus.STAGING,
        dueDate: leadData.expectedCloseDate || null
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create lead')
    }

    // Refresh projects list to show the new lead
    fetchProjects()
  }

  const handleStatusButtonClick = (projectId: number, projectName: string, newStatus: string, currentStatus: string) => {
    // Don't show confirmation if already on this status
    if (newStatus === currentStatus) {
      return
    }

    const statusLabel = getStatusLabel(newStatus)
    setStatusChangeConfirm({
      projectId,
      projectName,
      newStatus,
      newStatusLabel: statusLabel
    })
  }

  const handleConfirmStatusChange = async () => {
    if (!statusChangeConfirm) return

    try {
      const response = await fetch(`/api/projects/${statusChangeConfirm.projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: statusChangeConfirm.newStatus
        }),
      })

      if (response.ok) {
        await fetchProjects() // Refresh entire list to get updated data
        setStatusChangeConfirm(null)
        onStatusChange?.() // Notify parent to refresh sibling components
      } else {
        console.error('Failed to update project status')
      }
    } catch (error) {
      console.error('Error updating project status:', error)
    }
  }

  const handleUpdateProjectStatus = async (projectId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        }),
      })

      if (response.ok) {
        await fetchProjects() // Refresh entire list to get updated data
        onStatusChange?.() // Notify parent to refresh sibling components
      } else {
        console.error('Failed to update project status')
      }
    } catch (error) {
      console.error('Error updating project status:', error)
    }
  }

  const handleViewOpenings = (projectId: number, autoOpenModal: boolean = false) => {
    // Set the project ID and navigate to project detail view
    setSelectedProjectId(projectId)
    setCurrentMenu('projects')
    if (autoOpenModal) {
      setAutoOpenAddOpening(true)
    }
  }

  const handleViewQuote = (projectId: number) => {
    // Set the project ID and navigate to quote view
    setSelectedProjectId(projectId)
    setCurrentMenu('quote')
  }

  const openEditModal = (project: Project) => {
    // Check if project has quote accepted status - require confirmation first
    if (project.status === ProjectStatus.QUOTE_ACCEPTED) {
      setQuoteAcceptedEditConfirm(project)
      return
    }
    proceedWithEdit(project)
  }

  const proceedWithEdit = (project: Project) => {
    setQuoteAcceptedEditConfirm(null)
    setEditingProject(project)
    setEditName(project.name)
    setEditStatus(project.status)
    setEditDueDate(project.dueDate || '')
    setEditTaxRate(project.taxRate?.toString() || '0')
    setEditPricingModeId(project.pricingModeId || null)
  }

  const cancelEdit = () => {
    setEditingProject(null)
    setEditName('')
    setEditStatus('')
    setEditDueDate('')
    setEditTaxRate('0')
    setEditPricingModeId(null)
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          dueDate: editDueDate || null,
          taxRate: parseFloat(editTaxRate),
          pricingModeId: editPricingModeId
        }),
      })

      if (response.ok) {
        await fetchProjects() // Refresh projects list
        cancelEdit()
        onStatusChange?.() // Notify parent to refresh sibling components
      } else {
        console.error('Failed to update project')
      }
    } catch (error) {
      console.error('Error updating project:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusConfig = STATUS_CONFIG[status as ProjectStatus]
    if (statusConfig) {
      return `${statusConfig.bgColor} ${statusConfig.textColor}`
    }
    // Fallback for legacy statuses not in ProjectStatus enum
    const colors: { [key: string]: string } = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Active': 'bg-purple-100 text-purple-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'On Hold': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-teal-100 text-teal-800',
      'Cancelled': 'bg-red-100 text-red-800',
      'Archive': 'bg-orange-100 text-orange-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    const statusConfig = STATUS_CONFIG[status as ProjectStatus]
    return statusConfig ? statusConfig.label : status
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'Active':
      case 'In Progress':
        return <Clock className="w-4 h-4 text-blue-600" />
      case 'On Hold':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />
      case 'Archive':
        return <Archive className="w-4 h-4 text-orange-600" />
      default:
        return <Briefcase className="w-4 h-4 text-gray-600" />
    }
  }

  const calculateProjectValue = (project: Project) => {
    if (!project.openings || project.openings.length === 0) {
      return 0
    }
    return project.openings.reduce((sum, opening) => sum + opening.price, 0)
  }

  async function handleShowBOM(projectId: number, projectName: string) {
    setBomProjectId(projectId)
    setBomProjectName(projectName)
    setLoadingBOM(true)
    setShowBOM(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/bom`)
      if (response.ok) {
        const data = await response.json()
        setBomData(data)
      } else {
        console.error('Failed to generate BOM')
        setShowBOM(false)
      }
    } catch (error) {
      console.error('Error fetching BOM:', error)
      setShowBOM(false)
    } finally {
      setLoadingBOM(false)
    }
  }

  async function handleDownloadBOMCSV() {
    if (!bomProjectId) return

    try {
      const response = await fetch(`/api/projects/${bomProjectId}/bom/csv`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `project-${bomProjectId}-bom.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error downloading BOM CSV:', error)
    }
  }

  async function fetchUniqueBoms() {
    if (!bomProjectId) return
    setLoadingUniqueBoms(true)
    try {
      const response = await fetch(`/api/projects/${bomProjectId}/bom/csv?listOnly=true`)
      if (response.ok) {
        const data = await response.json()
        setUniqueBomList(data.uniqueComponents || [])
        // Select all by default
        setSelectedBomHashes(new Set(data.uniqueComponents?.map((c: any) => c.hash) || []))
      } else {
        console.error('Failed to load unique BOMs')
      }
    } catch (error) {
      console.error('Error fetching unique BOMs:', error)
    } finally {
      setLoadingUniqueBoms(false)
    }
  }

  async function handleDownloadSelectedBOMs() {
    if (!bomProjectId || selectedBomHashes.size === 0) return
    setShowBOMDownloadDialog(false)

    try {
      const selectedParam = Array.from(selectedBomHashes).join('|')
      const url = `/api/projects/${bomProjectId}/bom/csv?zip=true&unique=true&selected=${encodeURIComponent(selectedParam)}`
      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl

        // Get filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = 'selected-boms.zip'
        if (contentDisposition && contentDisposition.includes('filename=')) {
          filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
        }

        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)
      } else {
        console.error('Failed to download BOMs')
      }
    } catch (error) {
      console.error('Error downloading BOMs:', error)
    }
  }

  async function handleDownloadComponentBOM(panelId: number) {
    if (!bomProjectId) return

    try {
      const response = await fetch(`/api/projects/${bomProjectId}/bom/component/${panelId}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `component-${panelId}-bom.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error downloading component BOM:', error)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/projects/${deleteConfirm.projectId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchProjects()
        setDeleteConfirm(null)
        cancelEdit()
      } else {
        console.error('Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleArchiveProject = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ProjectStatus.ARCHIVE })
      })

      if (response.ok) {
        await fetchProjects()
        cancelEdit()
        onStatusChange?.() // Notify parent to refresh sibling components
      } else {
        console.error('Failed to archive project')
      }
    } catch (error) {
      console.error('Error archiving project:', error)
    }
  }

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  // Filter projects based on search, status, and filterType (leads vs projects)
  const filteredProjects = projects.filter(project => {
    // Search filter
    const matchesSearch = searchTerm === '' ||
      project.name.toLowerCase().includes(searchTerm.toLowerCase())

    // Status filter - hide archived by default unless Archive filter is selected
    const isArchived = project.status === ProjectStatus.ARCHIVE
    const archiveFilterSelected = statusFilters.includes(ProjectStatus.ARCHIVE)

    // If no filters selected: show all except archived
    // If filters selected: show only matching statuses (including archive if selected)
    const matchesStatus = statusFilters.length === 0
      ? !isArchived
      : statusFilters.includes(project.status)

    // Filter by type (leads vs projects)
    let matchesType = true
    if (filterType === 'leads') {
      matchesType = LEAD_STATUSES.includes(project.status as ProjectStatus)
    } else if (filterType === 'projects') {
      matchesType = PROJECT_STATUSES.includes(project.status as ProjectStatus)
    }

    return matchesSearch && matchesStatus && matchesType
  })


  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showFullHeader ? (
        /* Full Header with Stats - Only on Projects Tab */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Projects for {customer.companyName}
            </h2>
            <button
              onClick={() => setShowLeadForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Lead
            </button>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex items-center gap-4 flex-wrap mb-4">
            {/* Expandable Search Bar */}
            <div className="relative flex items-center">
              <button
                onClick={() => setSearchExpanded(true)}
                className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 ${searchExpanded ? 'opacity-0 pointer-events-none absolute' : ''}`}
                title="Search projects"
              >
                <Search className="w-4 h-4" />
              </button>
              {searchExpanded && (
                <div className="relative animate-expand-search">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => {
                      if (!searchTerm) {
                        setSearchExpanded(false)
                      }
                    }}
                    autoFocus
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-900 placeholder-gray-400 w-64"
                  />
                </div>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  filtersExpanded || statusFilters.length > 0
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Filter {statusFilters.length > 0 && `(${statusFilters.length})`}
              </button>
              <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                filtersExpanded ? 'max-w-[800px] opacity-100' : 'max-w-0 opacity-0'
              }`}>
                {(filterType === 'leads' ? LEAD_FILTER_STATUSES : PROJECT_FILTER_STATUSES).map((status) => {
                  const config = STATUS_CONFIG[status]
                  const isActive = statusFilters.includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? `${config.bgColor} ${config.textColor}`
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                      }`}
                    >
                      {config.label}
                    </button>
                  )
                })}
                {statusFilters.length > 0 && (
                  <button
                    onClick={() => setStatusFilters([])}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 underline whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Briefcase className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Total Projects</p>
                    <p className="text-lg font-semibold text-gray-900">{projects.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Active Projects</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {projects.filter(p => p.status === 'Active').length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {projects.filter(p => p.status === 'Completed').length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 text-purple-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-lg font-semibold text-gray-900">
                      ${projects.reduce((sum, p) => sum + calculateProjectValue(p), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Minimal Header - On Overview Tab */
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" />
              {filterType === 'leads' ? 'Leads' : filterType === 'projects' ? 'Projects' : 'Projects'} ({filteredProjects.length}{statusFilters.length > 0 || searchTerm ? ` of ${projects.filter(p => {
                if (filterType === 'leads') return LEAD_STATUSES.includes(p.status as ProjectStatus)
                if (filterType === 'projects') return PROJECT_STATUSES.includes(p.status as ProjectStatus)
                return true
              }).length}` : ''})
            </h2>
            {filteredProjects.length > 0 && filterType === 'leads' && (
              <button
                onClick={() => setShowLeadForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Lead
              </button>
            )}
          </div>

          {/* Search and Filter Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Expandable Search Bar */}
            <div className="relative flex items-center">
              <button
                onClick={() => setSearchExpanded(true)}
                className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 ${searchExpanded ? 'opacity-0 pointer-events-none absolute' : ''}`}
                title="Search projects"
              >
                <Search className="w-4 h-4" />
              </button>
              {searchExpanded && (
                <div className="relative animate-expand-search">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onBlur={() => {
                      if (!searchTerm) {
                        setSearchExpanded(false)
                      }
                    }}
                    autoFocus
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-900 placeholder-gray-400 w-64"
                  />
                </div>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  filtersExpanded || statusFilters.length > 0
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Filter {statusFilters.length > 0 && `(${statusFilters.length})`}
              </button>
              <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
                filtersExpanded ? 'max-w-[800px] opacity-100' : 'max-w-0 opacity-0'
              }`}>
                {(filterType === 'leads' ? LEAD_FILTER_STATUSES : PROJECT_FILTER_STATUSES).map((status) => {
                  const config = STATUS_CONFIG[status]
                  const isActive = statusFilters.includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                        isActive
                          ? `${config.bgColor} ${config.textColor}`
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                      }`}
                    >
                      {config.label}
                    </button>
                  )
                })}
                {statusFilters.length > 0 && (
                  <button
                    onClick={() => setStatusFilters([])}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 underline whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Projects List */}
      <div className="space-y-4">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onProjectClick?.(project.id)}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${
                project.status === 'Archive' ? 'opacity-60 bg-gray-50' : ''
              } ${onProjectClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    {project.dueDate && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>Due: {new Date(project.dueDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <Briefcase className="w-4 h-4 mr-1" />
                      <span>{project.openings.length} openings</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {project.openings.length === 0 ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewOpenings(project.id, true)
                      }}
                      className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Openings
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewOpenings(project.id, false)
                        }}
                        className="flex items-center px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
                      >
                        <Briefcase className="w-4 h-4 mr-1" />
                        View Openings
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewQuote(project.id)
                        }}
                        className="flex items-center px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg border border-green-200"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Quote
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleShowBOM(project.id, project.name)
                        }}
                        className="flex items-center px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <List className="w-4 h-4 mr-1" />
                        View BOM
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditModal(project)
                    }}
                    className="text-gray-600 hover:text-gray-800"
                    title="Edit project"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Hot Buttons - filtered based on filterType */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG)
                    .filter(([key]) => {
                      // Filter status buttons based on filterType
                      if (filterType === 'leads') {
                        // Only show lead statuses for leads
                        return LEAD_STATUSES.includes(key as ProjectStatus)
                      } else if (filterType === 'projects') {
                        // Only show project statuses for projects
                        return PROJECT_STATUSES.includes(key as ProjectStatus)
                      }
                      // Show all statuses when filterType is 'all'
                      return true
                    })
                    .map(([key, config]) => {
                      const isActive = project.status === key
                      return (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusButtonClick(project.id, project.name, key, project.status)
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            isActive
                              ? `${config.bgColor} ${config.textColor} ring-2 ring-offset-1 ring-${config.textColor.replace('text-', '')}`
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                          }`}
                          title={`Set status to ${config.label}`}
                        >
                          {config.label}
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filterType === 'leads' ? 'No leads yet' : filterType === 'projects' ? 'No won projects yet' : 'No projects yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {filterType === 'leads'
                  ? 'Create a new project to start a lead. Projects become leads when they are in Staging through Quote Sent status.'
                  : filterType === 'projects'
                  ? 'Projects appear here when their status changes to Quote Accepted or beyond.'
                  : `Create your first project for ${customer.companyName} to start tracking work and quotes.`}
              </p>
              {filterType === 'leads' && (
                <button
                  onClick={() => setShowLeadForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Lead
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Change Confirmation Dialog */}
      {statusChangeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Status Change
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to change the status of <strong>{statusChangeConfirm.projectName}</strong> to <strong>{statusChangeConfirm.newStatusLabel}</strong>?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setStatusChangeConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Project</h2>
            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={updating}
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
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
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
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={editTaxRate}
                  onChange={(e) => setEditTaxRate(e.target.value)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  placeholder="0.08"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter 0.08 for 8% tax, 0.065 for 6.5% tax, etc.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Mode (Optional)
                </label>
                <select
                  value={editPricingModeId || ''}
                  onChange={(e) => setEditPricingModeId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  <option value="">No pricing mode</option>
                  {pricingModes.map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.name} {mode.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select a pricing mode to apply pre-configured markup and discount rules
                </p>
              </div>
              {/* Delete/Archive Actions */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Project Actions</p>
                <div className="flex gap-2">
                  {editingProject.status !== ProjectStatus.ARCHIVE && (
                    <button
                      type="button"
                      onClick={() => handleArchiveProject(editingProject.id)}
                      disabled={updating}
                      className="flex items-center px-3 py-2 text-sm text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4 mr-1" />
                      Archive
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ projectId: editingProject.id, projectName: editingProject.name })}
                    disabled={updating}
                    className="flex items-center px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={updating}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {updating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {updating ? 'Updating...' : 'Update Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Project
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete <strong>{deleteConfirm.projectName}</strong>? This action cannot be undone and will remove all associated openings, panels, and data.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">
                Consider archiving the project instead if you may need to reference it later.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
              >
                {deleting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Accepted Edit Confirmation Modal */}
      {quoteAcceptedEditConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Edit Accepted Quote
            </h3>
            <p className="text-gray-600 mb-4">
              The project <strong>{quoteAcceptedEditConfirm.name}</strong> has a quote that has been accepted by the customer.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-700">
                Making changes to this project may affect the accepted quote. Are you sure you want to proceed with editing?
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setQuoteAcceptedEditConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => proceedWithEdit(quoteAcceptedEditConfirm)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Yes, Edit Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lead Form Modal */}
      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        onSubmit={handleCreateLead}
        defaultStage="New"
        customerId={customerId}
      />

      {/* BOM Modal */}
      {showBOM && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-6xl h-5/6 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Bill of Materials</h2>
                <p className="text-gray-600 mt-1">{bomProjectName}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowBOMDownloadDialog(true)
                    fetchUniqueBoms()
                  }}
                  disabled={loadingBOM || !bomData}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setShowBOM(false)
                    setBomData(null)
                  }}
                  className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
              {loadingBOM ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Generating BOM...</p>
                  </div>
                </div>
              ) : bomData ? (
                <div className="h-full overflow-auto">
                  {bomData.groupedBomItems && Object.keys(bomData.groupedBomItems).length > 0 ? (
                    <>
                      <div className="mb-6 text-sm text-gray-600">
                        <strong>{bomData.bomItems?.length || 0}</strong> total items across <strong>{Object.keys(bomData.groupedBomItems).length}</strong> openings
                      </div>

                      <div className="space-y-8">
                        {Object.entries(bomData.groupedBomItems).map(([openingName, components]: [string, any]) => (
                          <div key={openingName} className="border border-gray-200 rounded-lg">
                            {/* Opening Header */}
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                              <h3 className="text-lg font-semibold text-gray-900">Opening: {openingName}</h3>
                              <p className="text-sm text-gray-600">
                                {Object.keys(components).length} component{Object.keys(components).length !== 1 ? 's' : ''}
                              </p>
                            </div>

                            {/* Components */}
                            <div className="p-4 space-y-6">
                              {Object.entries(components).map(([componentKey, component]: [string, any]) => (
                                <div key={componentKey} className="border border-gray-100 rounded-lg">
                                  {/* Component Header */}
                                  <div className="bg-blue-50 px-4 py-2 border-b border-gray-100 rounded-t-lg">
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-medium text-blue-900">{component.productName}</h4>
                                        <p className="text-sm text-blue-700">
                                          {component.panelWidth}" W × {component.panelHeight}" H
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        <div className="text-sm text-blue-600">
                                          {component.items.length} part{component.items.length !== 1 ? 's' : ''}
                                        </div>
                                        <button
                                          onClick={() => handleDownloadComponentBOM(component.panelId)}
                                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                          title="Download Component BOM"
                                        >
                                          <Download className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Component BOM Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                      <thead>
                                        <tr className="bg-gray-50">
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Part Number</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Part Name</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Type</th>
                                          <th className="border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-900">Qty</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Cut Length</th>
                                          <th className="border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-900">% of Stock</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Unit</th>
                                          <th className="border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900">Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {component.items.map((item: any, index: number) => (
                                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                            <td className="border border-gray-200 px-3 py-2 text-sm font-mono text-gray-900">{item.partNumber}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">{item.partName}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm">
                                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                                item.partType === 'Extrusion'
                                                  ? 'bg-blue-100 text-blue-800'
                                                  : item.partType === 'Hardware'
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-purple-100 text-purple-800'
                                              }`}>
                                                {item.partType}
                                              </span>
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-center text-gray-900">{item.quantity}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
                                              {item.partType === 'Glass' ? (
                                                <div>
                                                  <div className="font-medium">{item.glassWidth?.toFixed(3)}" × {item.glassHeight?.toFixed(3)}"</div>
                                                  <div className="text-xs text-gray-500">({item.glassArea} SQ FT)</div>
                                                </div>
                                              ) : (
                                                item.cutLength ? `${item.cutLength.toFixed(3)}"` : '-'
                                              )}
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-center text-gray-900">
                                              {item.percentOfStock !== null && item.percentOfStock !== undefined ? (
                                                `${item.percentOfStock.toFixed(1)}%`
                                              ) : (
                                                '-'
                                              )}
                                            </td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">{item.unit}</td>
                                            <td className="border border-gray-200 px-3 py-2 text-sm text-gray-500">{item.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      No BOM items found for this project
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Failed to load BOM
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BOM Download Selection Dialog */}
      {showBOMDownloadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Select BOMs to Download
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Select the unique component BOMs you want to include in the ZIP download.
            </p>

            {loadingUniqueBoms ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : uniqueBomList.length > 0 ? (
              <>
                <div className="flex items-center space-x-2 mb-4">
                  <button
                    onClick={() => setSelectedBomHashes(new Set(uniqueBomList.map(c => c.hash)))}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={() => setSelectedBomHashes(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Deselect All
                  </button>
                </div>

                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {uniqueBomList.map((component) => (
                    <div key={component.hash} className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={selectedBomHashes.has(component.hash)}
                        onChange={(e) => {
                          const newSet = new Set(selectedBomHashes)
                          if (e.target.checked) {
                            newSet.add(component.hash)
                          } else {
                            newSet.delete(component.hash)
                          }
                          setSelectedBomHashes(newSet)
                        }}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{component.productName}</div>
                        <div className="text-sm text-gray-500">
                          {component.width}" × {component.height}" • {component.finishColor} • <span className="font-medium">×{component.quantity}</span>
                        </div>
                        {component.hardware && component.hardware.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Hardware: {component.hardware.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-gray-500 mb-4">
                  Selected: {selectedBomHashes.size} of {uniqueBomList.length}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No unique BOMs found
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBOMDownloadDialog(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadSelectedBOMs}
                disabled={selectedBomHashes.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Eye, Calendar, DollarSign, Briefcase, CheckCircle, Clock, AlertCircle, Archive, FileText } from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG } from '@/types'
import { useAppStore } from '@/stores/appStore'

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
}

export default function CustomerProjects({ customerId, customer, onProjectClick }: CustomerProjectsProps) {
  const { setSelectedProjectId, setCurrentMenu, setCustomerDetailTab, setAutoOpenAddOpening } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDueDate, setNewProjectDueDate] = useState('')
  const [creating, setCreating] = useState(false)


  // Edit modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editStatusNotes, setEditStatusNotes] = useState('')
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

  useEffect(() => {
    fetchProjects()
    fetchPricingModes()
  }, [customerId])

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

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName,
          customerId: customerId,
          dueDate: newProjectDueDate || null,
          status: ProjectStatus.STAGING
        }),
      })

      if (response.ok) {
        const newProject = await response.json()
        setProjects(prev => [newProject, ...prev])
        setNewProjectName('')
        setNewProjectDueDate('')
        setShowCreateForm(false)
      } else {
        console.error('Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleStatusButtonClick = (projectId: number, projectName: string, newStatus: string) => {
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
        fetchProjects() // Refresh entire list to get updated data
        setStatusChangeConfirm(null)
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
        fetchProjects() // Refresh entire list to get updated data
      } else {
        console.error('Failed to update project status')
      }
    } catch (error) {
      console.error('Error updating project status:', error)
    }
  }

  const handleViewOpenings = (projectId: number, autoOpenModal: boolean = false) => {
    // Set the project ID and navigate to project detail view
    setCustomerDetailTab('projects') // Remember we're on the Projects tab
    setSelectedProjectId(projectId)
    setCurrentMenu('projects')
    if (autoOpenModal) {
      setAutoOpenAddOpening(true)
    }
  }

  const handleViewQuote = (projectId: number) => {
    // Set the project ID and navigate to quote view
    setCustomerDetailTab('projects') // Remember we're on the Projects tab
    setSelectedProjectId(projectId)
    setCurrentMenu('quote')
  }

  const openEditModal = (project: Project) => {
    setEditingProject(project)
    setEditName(project.name)
    setEditStatus(project.status)
    setEditStatusNotes('')
    setEditDueDate(project.dueDate || '')
    setEditTaxRate(project.taxRate?.toString() || '0')
    setEditPricingModeId(project.pricingModeId || null)
  }

  const cancelEdit = () => {
    setEditingProject(null)
    setEditName('')
    setEditStatus('')
    setEditStatusNotes('')
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
          pricingModeId: editPricingModeId,
          statusNotes: editStatusNotes || undefined
        }),
      })

      if (response.ok) {
        fetchProjects() // Refresh projects list
        cancelEdit()
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


  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Projects for {customer.companyName}
          </h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </button>
        </div>

        {/* Create Project Form */}
        {showCreateForm && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={newProjectDueDate}
                  onChange={(e) => setNewProjectDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setNewProjectName('')
                  setNewProjectDueDate('')
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating || !newProjectName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        )}

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

      {/* Projects List */}
      <div className="space-y-4">
        {projects.length > 0 ? (
          projects.map((project) => (
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
                    {getStatusIcon(project.status)}
                    <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                      {getStatusLabel(project.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
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
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      <span>${calculateProjectValue(project).toLocaleString()}</span>
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

              {/* Status Hot Buttons */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG)
                    .filter(([key]) => key !== ProjectStatus.REVISE && key !== ProjectStatus.QUOTE_ACCEPTED)
                    .map(([key, config]) => {
                      const isActive = project.status === key
                      return (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusButtonClick(project.id, project.name, key)
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first project for {customer.companyName} to start tracking work and quotes.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Project
              </button>
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
                  Status Change Notes (Optional)
                </label>
                <textarea
                  value={editStatusNotes}
                  onChange={(e) => setEditStatusNotes(e.target.value)}
                  disabled={updating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  placeholder="Add notes about this status change (optional)"
                  rows={3}
                />
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
    </div>
  )
}
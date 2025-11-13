'use client'

import { useState, useEffect } from 'react'
import { Plus, Eye, Edit, Trash, Download } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { PricingMode } from '@/types'

interface Project {
  id: number
  name: string
  status: string
  dueDate: string | null
  multiplier: number
  taxRate: number
  pricingModeId?: number | null
  openingsCount: number
  value: number
  updatedAt: string
}

export default function ProjectsView() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectStatus, setNewProjectStatus] = useState('Draft')
  const [newProjectDueDate, setNewProjectDueDate] = useState('')
  const [newProjectPricingModeId, setNewProjectPricingModeId] = useState<number | null>(null)
  const [newProjectCustomerId, setNewProjectCustomerId] = useState<number | null>(null)
  const [customers, setCustomers] = useState<{ id: number; companyName: string }[]>([])
  const [creating, setCreating] = useState(false)
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editTaxRate, setEditTaxRate] = useState('0')
  const [editPricingModeId, setEditPricingModeId] = useState<number | null>(null)
  const [updating, setUpdating] = useState(false)
  const [downloadingProject, setDownloadingProject] = useState<number | null>(null)
  const [pricingModes, setPricingModes] = useState<PricingMode[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const { setSelectedProjectId } = useAppStore()

  useEffect(() => {
    fetchProjects()
    fetchPricingModes()
    fetchCustomers()
  }, [])

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const projectsData = await response.json()
        const formattedProjects = projectsData.map((project: {
          id: number;
          name: string;
          status: string;
          dueDate: string | null;
          multiplier: number;
          taxRate: number;
          pricingModeId?: number | null;
          pricingMode?: {
            markup: number;
            extrusionMarkup: number;
            hardwareMarkup: number;
            glassMarkup: number;
            discount: number
          } | null;
          _count: { openings: number };
          openings: {
            price: number;
            panels: {
              componentInstance: {
                product: {
                  productBOMs: { partType: string }[]
                }
              } | null
            }[]
          }[];
          updatedAt: string;
        }) => {
          // Calculate COG (cost of goods)
          const costValue = project.openings.reduce((sum: number, opening: { price: number }) => sum + opening.price, 0)

          // Apply category-specific pricing mode to get sale price
          let saleValue = costValue
          if (project.pricingMode) {
            // Count BOMs by type to estimate cost breakdown
            const bomCounts = { Extrusion: 0, Hardware: 0, Glass: 0, Other: 0 }

            for (const opening of project.openings) {
              for (const panel of opening.panels) {
                if (!panel.componentInstance) continue

                for (const bom of panel.componentInstance.product.productBOMs || []) {
                  if (bom.partType === 'Extrusion') {
                    bomCounts.Extrusion++
                  } else if (bom.partType === 'Hardware') {
                    bomCounts.Hardware++
                  } else if (bom.partType === 'Glass') {
                    bomCounts.Glass++
                  } else {
                    bomCounts.Other++
                  }
                }
              }
            }

            // Estimate cost breakdown
            const totalBOMCount = bomCounts.Extrusion + bomCounts.Hardware + bomCounts.Glass + bomCounts.Other
            if (totalBOMCount > 0) {
              const extrusionCost = (costValue * bomCounts.Extrusion) / totalBOMCount
              const hardwareCost = (costValue * bomCounts.Hardware) / totalBOMCount
              const glassCost = (costValue * bomCounts.Glass) / totalBOMCount
              const otherCost = (costValue * bomCounts.Other) / totalBOMCount

              // Apply category-specific markups
              const applyMarkup = (cost: number, categoryMarkup: number) => {
                const markup = categoryMarkup > 0 ? categoryMarkup : project.pricingMode!.markup
                let price = cost * (1 + markup / 100)
                if (project.pricingMode!.discount > 0) {
                  price *= (1 - project.pricingMode!.discount / 100)
                }
                return price
              }

              saleValue =
                applyMarkup(extrusionCost, project.pricingMode.extrusionMarkup) +
                applyMarkup(hardwareCost, project.pricingMode.hardwareMarkup) +
                applyMarkup(glassCost, project.pricingMode.glassMarkup) +
                applyMarkup(otherCost, 0) // Other uses global markup
            } else {
              // Fallback to global markup if no BOMs
              if (project.pricingMode.markup > 0) {
                saleValue = saleValue * (1 + project.pricingMode.markup / 100)
              }
              if (project.pricingMode.discount > 0) {
                saleValue = saleValue * (1 - project.pricingMode.discount / 100)
              }
            }
          }

          return {
            id: project.id,
            name: project.name,
            status: project.status,
            dueDate: project.dueDate ? new Date(project.dueDate).toLocaleDateString() : null,
            multiplier: project.multiplier || 1.0,
            taxRate: project.taxRate || 0,
            pricingModeId: project.pricingModeId || null,
            openingsCount: project._count.openings,
            value: saleValue, // Sale price (with markup/discount applied)
            updatedAt: new Date(project.updatedAt).toLocaleDateString()
          }
        })
        setProjects(formattedProjects)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchPricingModes() {
    try {
      const response = await fetch('/api/pricing-modes')
      if (response.ok) {
        const modes = await response.json()
        setPricingModes(modes)
        // Set default pricing mode for new projects
        const defaultMode = modes.find((m: PricingMode) => m.isDefault)
        if (defaultMode) {
          setNewProjectPricingModeId(defaultMode.id)
        }
      }
    } catch (error) {
      console.error('Error fetching pricing modes:', error)
    }
  }

  async function fetchCustomers() {
    try {
      const response = await fetch('/api/customers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim()) return
    if (!newProjectCustomerId) {
      setError('Please select a customer for this project')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newProjectName,
          status: newProjectStatus,
          dueDate: newProjectDueDate || null,
          pricingModeId: newProjectPricingModeId,
          customerId: newProjectCustomerId
        })
      })

      if (response.ok) {
        setNewProjectName('')
        setNewProjectStatus('Draft')
        setNewProjectDueDate('')
        setNewProjectCustomerId(null)
        setShowCreateForm(false)
        await fetchProjects() // Refresh the projects list
        showSuccess('Project created successfully!')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
      setError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }


  function handleViewProject(projectId: number) {
    setSelectedProjectId(projectId)
  }

  function handleEditProject(project: Project) {
    setEditingProject(project.id)
    setEditName(project.name)
    setEditStatus(project.status)
    setEditDueDate(project.dueDate ? new Date(project.dueDate).toISOString().split('T')[0] : '')
    setEditTaxRate(String(project.taxRate || 0))
    setEditPricingModeId(project.pricingModeId || null)
  }

  function cancelEdit() {
    setEditingProject(null)
    setEditName('')
    setEditStatus('')
    setEditDueDate('')
    setEditTaxRate('0')
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim() || !editingProject) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/projects/${editingProject}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          status: editStatus,
          dueDate: editDueDate || null,
          taxRate: parseFloat(editTaxRate) || 0,
          pricingModeId: editPricingModeId
        })
      })

      if (response.ok) {
        cancelEdit()
        fetchProjects()
        showSuccess('Project updated successfully!')
      }
    } catch (error) {
      console.error('Error updating project:', error)
      showError('Error updating project')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDownloadProject(projectId: number) {
    try {
      setDownloadingProject(projectId)
      
      const response = await fetch(`/api/projects/${projectId}/complete-package`)
      
      if (!response.ok) {
        throw new Error('Failed to generate project package')
      }

      // Get the blob data
      const blob = await response.blob()
      
      // Get the project name for the filename
      const project = projects.find(p => p.id === projectId)
      const filename = `${project?.name || 'Project'}_Complete_Package_${new Date().toISOString().split('T')[0]}.pdf`
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      showSuccess('Project package downloaded successfully!')
      
    } catch (error) {
      console.error('Error downloading project package:', error)
      showError('Failed to download project package')
    } finally {
      setDownloadingProject(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your quoting projects</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Project
        </button>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer *
                </label>
                <select
                  value={newProjectCustomerId || ''}
                  onChange={(e) => setNewProjectCustomerId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={creating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  All projects must be associated with a customer
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={creating}
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
                  value={newProjectStatus}
                  onChange={(e) => setNewProjectStatus(e.target.value)}
                  disabled={creating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                >
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option disabled>──────────</option>
                  <option value="Archive">Archive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newProjectDueDate}
                  onChange={(e) => setNewProjectDueDate(e.target.value)}
                  disabled={creating}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Mode (Optional)
                </label>
                <select
                  value={newProjectPricingModeId || ''}
                  onChange={(e) => setNewProjectPricingModeId(e.target.value ? parseInt(e.target.value) : null)}
                  disabled={creating}
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
                  onClick={() => {
                    setShowCreateForm(false)
                    setError(null)
                    setNewProjectName('')
                    setNewProjectStatus('Draft')
                    setNewProjectDueDate('')
                    setNewProjectCustomerId(null)
                  }}
                  disabled={creating}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim() || !newProjectCustomerId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {creating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Form */}
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
                  <option value="Draft">Draft</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option disabled>──────────</option>
                  <option value="Archive">Archive</option>
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

      {/* Archive Filter Toggle */}
      <div className="flex justify-end mb-4">
        <label className="flex items-center text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show archived projects
        </label>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Openings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects
                  .filter(project => showArchived || project.status !== 'Archive')
                  .map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {project.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'Draft'
                          ? 'bg-gray-100 text-gray-800'
                          : project.status === 'In Progress'
                          ? 'bg-blue-100 text-blue-800'
                          : project.status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'Archive'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {project.openingsCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${project.value.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {project.dueDate || 'No due date'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {project.updatedAt}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewProject(project.id)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="View Project"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDownloadProject(project.id)}
                          disabled={downloadingProject === project.id}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download Complete Project Package"
                        >
                          {downloadingProject === project.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No projects found</div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Project
            </button>
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
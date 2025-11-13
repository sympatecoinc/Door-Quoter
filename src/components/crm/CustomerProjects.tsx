'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Eye, Calendar, DollarSign, Briefcase, CheckCircle, Clock, AlertCircle, Archive } from 'lucide-react'

interface Project {
  id: number
  name: string
  status: string
  customerId: number
  createdAt: string
  updatedAt: string
  dueDate?: string
  openings: {
    id: number
    name: string
    price: number
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
}

export default function CustomerProjects({ customerId, customer }: CustomerProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDueDate, setNewProjectDueDate] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
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
          status: 'Draft'
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
        setProjects(prev => prev.map(project =>
          project.id === projectId ? { ...project, status: newStatus } : project
        ))
      } else {
        console.error('Failed to update project status')
      }
    } catch (error) {
      console.error('Error updating project status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'Draft': 'bg-gray-100 text-gray-800',
      'Active': 'bg-blue-100 text-blue-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'On Hold': 'bg-yellow-100 text-yellow-800',
      'Completed': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800',
      'Archive': 'bg-orange-100 text-orange-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
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
            <div key={project.id} className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${
              project.status === 'Archive' ? 'opacity-60 bg-gray-50' : ''
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(project.status)}
                    <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                      {project.status}
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

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.open(`/projects/${project.id}`, '_blank')}
                    className="text-blue-600 hover:text-blue-800"
                    title="View project details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.open(`/projects/${project.id}/edit`, '_blank')}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit project"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Openings List */}
              {project.openings.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Openings:</h4>
                  <div className="space-y-2">
                    {project.openings.map((opening) => (
                      <div key={opening.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-900">{opening.name}</span>
                        <span className="text-gray-600">${opening.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Update Buttons */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                {project.status !== 'Active' && (
                  <button
                    onClick={() => handleUpdateProjectStatus(project.id, 'Active')}
                    className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                  >
                    Mark Active
                  </button>
                )}
                {project.status !== 'On Hold' && project.status !== 'Completed' && (
                  <button
                    onClick={() => handleUpdateProjectStatus(project.id, 'On Hold')}
                    className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200"
                  >
                    Put On Hold
                  </button>
                )}
                {project.status !== 'Completed' && (
                  <button
                    onClick={() => handleUpdateProjectStatus(project.id, 'Completed')}
                    className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                  >
                    Mark Completed
                  </button>
                )}
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
    </div>
  )
}
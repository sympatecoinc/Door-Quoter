'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { DollarSign, Calendar, User, Plus, Edit } from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG, LEAD_STATUSES } from '@/types'

interface Project {
  id: number
  name: string
  status: string
  createdAt: string
  customerId: number
  customer?: {
    id: number
    companyName: string
    contactName?: string
  }
  openings: {
    id: number
    price: number
  }[]
}

// Define the stages we always want to show (excludes REVISE)
const ALWAYS_VISIBLE_STAGES: ProjectStatus[] = [
  ProjectStatus.STAGING,
  ProjectStatus.APPROVED,
  ProjectStatus.QUOTE_SENT
]

// Stages where users cannot create new leads
const NO_CREATE_STAGES: ProjectStatus[] = [ProjectStatus.REVISE]

// Build stage config from status config
const buildStageConfig = (status: ProjectStatus) => ({
  key: status,
  label: STATUS_CONFIG[status].label,
  color: `${STATUS_CONFIG[status].bgColor} ${STATUS_CONFIG[status].textColor}`
})

interface LeadPipelineProps {
  onAddLead?: (stage?: string) => void
  onProjectClick?: (projectId: number) => void
}

export default function LeadPipeline({ onAddLead, onProjectClick }: LeadPipelineProps) {
  const [projectsByStage, setProjectsByStage] = useState<Record<string, Project[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline')
  const [projectsWithQuotes, setProjectsWithQuotes] = useState<Set<number>>(new Set())

  // Dynamically compute which stages to show
  // Always show staging, approved, quote_sent
  // Only show revise if there are projects in it
  const stages = (() => {
    const visibleStages = ALWAYS_VISIBLE_STAGES.map(buildStageConfig)

    // Add revise stage only if there are projects in it
    const reviseProjects = projectsByStage[ProjectStatus.REVISE] || []
    if (reviseProjects.length > 0) {
      visibleStages.push(buildStageConfig(ProjectStatus.REVISE))
    }

    return visibleStages
  })()

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const projects: Project[] = await response.json()

        // Group projects by status (all lead statuses including revise)
        const grouped = LEAD_STATUSES.reduce((acc, status) => {
          acc[status] = projects.filter(project => project.status === status)
          return acc
        }, {} as Record<string, Project[]>)

        setProjectsByStage(grouped)

        // Fetch quote status for all projects
        const projectIds = projects.map(p => p.id)
        if (projectIds.length > 0) {
          const quoteStatusResponse = await fetch(`/api/projects/quote-status?ids=${projectIds.join(',')}`)
          if (quoteStatusResponse.ok) {
            const quoteStatus = await quoteStatusResponse.json()
            setProjectsWithQuotes(new Set(quoteStatus.projectsWithQuotes || []))
          }
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  // Refresh quote status when tab becomes visible (user might have generated a quote elsewhere)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Get all project IDs from all stages
        const allProjectIds = Object.values(projectsByStage).flat().map(p => p.id)
        if (allProjectIds.length > 0) {
          fetch(`/api/projects/quote-status?ids=${allProjectIds.join(',')}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data) setProjectsWithQuotes(new Set(data.projectsWithQuotes || []))
            })
            .catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [projectsByStage])

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  const getProjectValue = (project: Project) => {
    return project.openings?.reduce((sum, opening) => sum + (opening.price || 0), 0) || 0
  }

  const getStageTotal = (stage: string) => {
    return projectsByStage[stage]?.reduce((sum, project) => sum + getProjectValue(project), 0) || 0
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    // Dropped outside a valid droppable
    if (!destination) return

    // Dropped in same location
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const projectId = parseInt(draggableId.replace('lead-', ''))
    const newStatus = destination.droppableId
    const oldStatus = source.droppableId

    // Find the project being moved
    const project = projectsByStage[oldStatus]?.find(p => p.id === projectId)
    if (!project) return

    // Check if moving to QUOTE_SENT requires a quote
    if (newStatus === ProjectStatus.QUOTE_SENT && !projectsWithQuotes.has(projectId)) {
      alert('Cannot move to "Quote Sent" - a quote must be generated first')
      return
    }

    // Optimistic update
    setProjectsByStage(prev => {
      const newState = { ...prev }

      // Remove from old stage
      newState[oldStatus] = prev[oldStatus].filter(p => p.id !== projectId)

      // Add to new stage at the correct position
      const updatedProject = { ...project, status: newStatus }
      const newStageProjects = [...(prev[newStatus] || [])]
      newStageProjects.splice(destination.index, 0, updatedProject)
      newState[newStatus] = newStageProjects

      return newState
    })

    // Update on server
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!response.ok) {
        // Revert on error
        fetchProjects()
      }
    } catch (error) {
      console.error('Error updating lead status:', error)
      fetchProjects()
    }
  }

  const renderPipelineView = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {stages.map((stage) => (
          <Droppable key={stage.key} droppableId={stage.key}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`bg-gray-50 rounded-lg p-4 min-h-[200px] transition-colors ${
                  snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                }`}
              >
                {/* Stage Header */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                    <p className="text-sm text-gray-600">
                      {projectsByStage[stage.key]?.length || 0} leads
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(getStageTotal(stage.key))}
                    </p>
                  </div>
                </div>

                {/* Project Cards */}
                <div className="space-y-3">
                  {projectsByStage[stage.key]?.map((project, index) => (
                    <Draggable key={project.id} draggableId={`lead-${project.id}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => onProjectClick?.(project.id)}
                          className={`bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-grab ${
                            snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                              {project.name}
                            </h4>
                          </div>

                          {project.customer && (
                            <div className="flex items-center text-xs text-gray-600 mb-2">
                              <User className="w-3 h-3 mr-1" />
                              {project.customer.companyName}
                            </div>
                          )}

                          <div className="flex items-center text-xs text-gray-600 mb-2">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {formatCurrency(getProjectValue(project))}
                          </div>

                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(project.createdAt)}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* Add Lead Button - hidden for revise stage */}
                  {!NO_CREATE_STAGES.includes(stage.key as ProjectStatus) && (
                    <button
                      onClick={() => onAddLead?.(stage.key)}
                      className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <Plus className="w-4 h-4 mx-auto" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  )

  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.values(projectsByStage).flat().map((project) => {
              const stage = stages.find(s => s.key === project.status)
              return (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onProjectClick?.(project.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {project.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project.customer?.companyName || 'No customer'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stage?.color}`}>
                      {stage?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(getProjectValue(project))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(project.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Pipeline</h2>
          <p className="text-sm text-gray-600">
            Total Pipeline Value: {formatCurrency(
              Object.values(projectsByStage).flat().reduce((sum, project) => sum + getProjectValue(project), 0)
            )}
          </p>
        </div>

        <div className="flex space-x-4">
          {/* View Toggle */}
          <div className="flex border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-2 text-sm rounded-l-lg ${
                viewMode === 'pipeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm rounded-r-lg ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>

          <button
            onClick={() => onAddLead?.()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'pipeline' ? (
        renderPipelineView()
      ) : (
        renderListView()
      )}
    </div>
  )
}
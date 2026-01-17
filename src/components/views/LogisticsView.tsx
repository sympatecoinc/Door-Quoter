'use client'

import { useState, useEffect } from 'react'
import {
  ClipboardList,
  Tag,
  Download,
  Loader2,
  RefreshCw,
  Package2
} from 'lucide-react'
import { ProjectStatus } from '@/types'
import StatusBadge from '@/components/projects/StatusBadge'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'

interface LogisticsProject {
  id: number
  name: string
  status: ProjectStatus
  dueDate: string | null
  customerId: number | null
  customerName: string
  customerContact: string | null
  openingsCount: number
  value: number
  updatedAt: string
}

type DownloadType = 'packinglist' | 'labels' | 'all'

interface DownloadingState {
  [projectId: number]: {
    [key in DownloadType]?: boolean
  }
}

function ProjectRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-4 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-8 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="flex space-x-1">
          <div className="w-7 h-7 bg-gray-200 rounded" />
          <div className="w-7 h-7 bg-gray-200 rounded" />
          <div className="w-7 h-7 bg-gray-200 rounded" />
        </div>
      </td>
    </tr>
  )
}

export default function LogisticsView() {
  const [projects, setProjects] = useState<LogisticsProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState<DownloadingState>({})
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const { toasts, removeToast, showSuccess, showError } = useToast()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      // Reuse the production API - same project filtering
      const response = await fetch('/api/production')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        showError('Failed to load logistics projects')
      }
    } catch (error) {
      console.error('Error fetching logistics projects:', error)
      showError('Failed to load logistics projects')
    } finally {
      setLoading(false)
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(projects.map(p => p.id)))
    }
  }

  function toggleSelect(projectId: number) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedIds(newSelected)
  }

  async function downloadDocument(projectId: number, type: DownloadType, projectName: string) {
    setDownloading(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [type]: true }
    }))

    try {
      let url: string
      let filename: string
      const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '-')

      switch (type) {
        case 'packinglist':
          url = `/api/projects/${projectId}/packing-list/pdf`
          filename = `${safeProjectName}-packing-list.pdf`
          break
        case 'labels':
          url = `/api/projects/${projectId}/packing-list/stickers`
          filename = `${safeProjectName}-packing-stickers.pdf`
          break
        case 'all':
          url = `/api/projects/${projectId}/logistics-all`
          filename = `${safeProjectName}-logistics-documents.zip`
          break
        default:
          throw new Error('Invalid download type')
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download ${type}`)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (error) {
      console.error(`Error downloading ${type}:`, error)
      showError(`Failed to download ${type}`)
    } finally {
      setDownloading(prev => ({
        ...prev,
        [projectId]: { ...prev[projectId], [type]: false }
      }))
    }
  }

  async function downloadAllSelected() {
    if (selectedIds.size === 0) {
      showError('Please select at least one project')
      return
    }

    setBulkDownloading(true)
    const selectedProjects = projects.filter(p => selectedIds.has(p.id))
    let successCount = 0
    let errorCount = 0

    for (const project of selectedProjects) {
      try {
        await downloadDocument(project.id, 'all', project.name)
        successCount++
      } catch (error) {
        errorCount++
      }
    }

    setBulkDownloading(false)

    if (errorCount === 0) {
      showSuccess(`Downloaded documents for ${successCount} project(s)`)
    } else {
      showError(`Downloaded ${successCount} project(s), ${errorCount} failed`)
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function isProjectDownloading(projectId: number): boolean {
    const state = downloading[projectId]
    if (!state) return false
    return Object.values(state).some(v => v)
  }

  const DownloadButton = ({
    projectId,
    type,
    projectName,
    icon: Icon,
    title
  }: {
    projectId: number
    type: DownloadType
    projectName: string
    icon: React.ElementType
    title: string
  }) => {
    const isLoading = downloading[projectId]?.[type]

    return (
      <button
        onClick={() => downloadDocument(projectId, type, projectName)}
        disabled={isLoading}
        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={title}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Icon className="w-4 h-4" />
        )}
      </button>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Logistics</h1>
          <p className="text-gray-600 mt-2">
            Projects ready for shipping (Approved, Quote Accepted, or Active)
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="flex items-center px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={downloadAllSelected}
              disabled={bulkDownloading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {bulkDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download All Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <div className="h-4 w-4 bg-gray-200 rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Openings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[...Array(5)].map((_, i) => (
                  <ProjectRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === projects.length && projects.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Openings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Downloads
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className={`hover:bg-gray-50 ${selectedIds.has(project.id) ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(project.id)}
                        onChange={() => toggleSelect(project.id)}
                        disabled={isProjectDownloading(project.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {project.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{project.customerName}</div>
                      {project.customerContact && (
                        <div className="text-xs text-gray-500">{project.customerContact}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {project.openingsCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(project.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${project.value.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <DownloadButton
                          projectId={project.id}
                          type="packinglist"
                          projectName={project.name}
                          icon={ClipboardList}
                          title="Download Packing List (PDF)"
                        />
                        <DownloadButton
                          projectId={project.id}
                          type="labels"
                          projectName={project.name}
                          icon={Tag}
                          title="Download Labels/Stickers (PDF)"
                        />
                        <DownloadButton
                          projectId={project.id}
                          type="all"
                          projectName={project.name}
                          icon={Download}
                          title="Download All Documents (ZIP)"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-2">
              <Package2 className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Logistics Projects</h3>
            <p className="text-gray-500">
              Projects with Approved, Quote Accepted, or Active status will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {!loading && projects.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div>
            Showing {projects.length} project{projects.length !== 1 ? 's' : ''} ready for shipping
          </div>
          {selectedIds.size > 0 && (
            <div>
              {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, Search, Download, CheckSquare, Square, Loader2 } from 'lucide-react'
import { useDownloadStore } from '@/stores/downloadStore'

const FILTER_STATUSES = [
  { value: 'STAGING', label: 'Preparing Quote' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REVISE', label: 'Revise' },
  { value: 'QUOTE_SENT', label: 'Quote Sent' },
  { value: 'QUOTE_ACCEPTED', label: 'Quote Accepted' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETE', label: 'Complete' }
] as const

interface CombinedPurchaseSummaryWidgetProps {
  refreshKey?: number
}

interface ProjectOption {
  id: number
  name: string
  customerName: string
  status: string
}


export default function CombinedPurchaseSummaryWidget({ refreshKey = 0 }: CombinedPurchaseSummaryWidgetProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>(['QUOTE_ACCEPTED', 'APPROVED', 'ACTIVE'])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { startDownload, completeDownload, failDownload } = useDownloadStore()
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // Fetch projects on mount and refresh
  useEffect(() => {
    fetchProjects()
  }, [refreshKey])

  async function fetchProjects() {
    try {
      setLoading(true)
      const response = await fetch('/api/projects?limit=1000')
      if (response.ok) {
        const result = await response.json()
        // API returns array directly
        const projectsArray = Array.isArray(result) ? result : (result.projects || [])
        const projectList: ProjectOption[] = projectsArray.map((p: any) => ({
          id: p.id,
          name: p.name,
          customerName: p.customer?.companyName || p.prospectCompanyName || '',
          status: p.status
        }))
        setProjects(projectList)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  // Toggle status filter
  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  // Filter projects based on search and status (always exclude archived)
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (project.status === 'ARCHIVE') return false
      const matchesSearch = searchQuery === '' ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(project.status)
      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilters])

  // Toggle individual project selection
  const toggleProject = (projectId: number) => {
    const newSelected = new Set(selectedProjectIds)
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId)
    } else {
      newSelected.add(projectId)
    }
    setSelectedProjectIds(newSelected)
  }

  // Download CSV
  async function downloadCSV() {
    if (selectedProjectIds.size === 0) {
      setError('Please select at least one project')
      return
    }

    // Build download name from selected projects
    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id))
    const projectNames = selectedProjects.slice(0, 2).map(p => p.name).join(', ')
    const downloadName = projectNames + (selectedProjects.length > 2 ? ` +${selectedProjects.length - 2} more` : '')

    // Start download tracking
    const downloadId = startDownload({
      name: `Purchase Summary - ${downloadName}`,
      type: 'purchase-summary'
    })

    try {
      setDownloading(true)
      setError(null)

      const response = await fetch('/api/purchasing/combined-summary?format=csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: Array.from(selectedProjectIds) })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `combined-purchase-summary-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        completeDownload(downloadId)
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to download CSV'
        setError(errorMessage)
        failDownload(downloadId, errorMessage)
      }
    } catch (error) {
      console.error('Error downloading CSV:', error)
      setError('Failed to download CSV')
      failDownload(downloadId, 'Failed to download CSV')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-64 mb-4"></div>
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4">
        {/* Search and Filter Row */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => {
                    if (!searchQuery) {
                      setSearchExpanded(false)
                    }
                  }}
                  autoFocus
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-900 placeholder-gray-400 w-48"
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
              {FILTER_STATUSES.map((status) => {
                const isActive = statusFilters.includes(status.value)
                return (
                  <button
                    key={status.value}
                    onClick={() => toggleStatusFilter(status.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                    }`}
                  >
                    {status.label}
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

        {/* Project List */}
        <div className="border border-gray-200 rounded-lg mb-4">
          {filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No projects found
            </div>
          ) : (
            filteredProjects.map(project => (
              <button
                key={project.id}
                onClick={() => toggleProject(project.id)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left"
              >
                {selectedProjectIds.has(project.id) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{project.name}</div>
                  {project.customerName && (
                    <div className="text-xs text-gray-500 truncate">{project.customerName}</div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Download Button - appears when projects are selected */}
        {selectedProjectIds.size > 0 && (
          <button
            onClick={downloadCSV}
            disabled={downloading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Combined Purchase Summary
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

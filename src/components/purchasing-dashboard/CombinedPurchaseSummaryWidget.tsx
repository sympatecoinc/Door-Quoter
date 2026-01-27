'use client'

import { useState, useEffect, useMemo } from 'react'
import { Package, Search, Download, CheckSquare, Square, ChevronDown, Loader2 } from 'lucide-react'
import type { CombinedSummaryResponse, CombinedSummaryItem } from './types'

interface CombinedPurchaseSummaryWidgetProps {
  refreshKey?: number
}

interface ProjectOption {
  id: number
  name: string
  customerName: string
  status: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'STAGING', label: 'Staging' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REVISE', label: 'Revise' },
  { value: 'QUOTE_SENT', label: 'Quote Sent' },
  { value: 'QUOTE_ACCEPTED', label: 'Quote Accepted' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETE', label: 'Complete' }
]

export default function CombinedPurchaseSummaryWidget({ refreshKey = 0 }: CombinedPurchaseSummaryWidgetProps) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [summaryData, setSummaryData] = useState<CombinedSummaryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // Filter projects based on search and status (always exclude archived)
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (project.status === 'ARCHIVE') return false
      const matchesSearch = searchQuery === '' ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === '' || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, searchQuery, statusFilter])

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

  // Select/Deselect all filtered projects
  const toggleSelectAll = () => {
    if (selectedProjectIds.size === filteredProjects.length) {
      setSelectedProjectIds(new Set())
    } else {
      setSelectedProjectIds(new Set(filteredProjects.map(p => p.id)))
    }
  }

  // Generate summary
  async function generateSummary() {
    if (selectedProjectIds.size === 0) {
      setError('Please select at least one project')
      return
    }

    try {
      setGenerating(true)
      setError(null)

      const response = await fetch('/api/purchasing/combined-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: Array.from(selectedProjectIds) })
      })

      if (response.ok) {
        const result = await response.json()
        setSummaryData(result)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to generate summary')
      }
    } catch (error) {
      console.error('Error generating summary:', error)
      setError('Failed to generate summary')
    } finally {
      setGenerating(false)
    }
  }

  // Download CSV
  async function downloadCSV() {
    if (selectedProjectIds.size === 0) {
      setError('Please select at least one project')
      return
    }

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
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to download CSV')
      }
    } catch (error) {
      console.error('Error downloading CSV:', error)
      setError('Failed to download CSV')
    } finally {
      setDownloading(false)
    }
  }

  // Get unit display string
  const getUnitDisplay = (item: CombinedSummaryItem): string => {
    if (item.partType === 'Extrusion' || item.partType === 'CutStock' || item.partType === 'Glass') {
      return 'EA'
    }
    return item.unit
  }

  // Get pieces display value
  const getPiecesDisplay = (item: CombinedSummaryItem): number | string => {
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockPiecesNeeded !== null) {
      return item.stockPiecesNeeded
    }
    if ((item.partType === 'Hardware' || item.partType === 'Fastener') && item.totalCalculatedLength) {
      return Math.ceil(item.totalCalculatedLength * 1.05) // 5% overage
    }
    return item.totalQuantity
  }

  // Get size display string
  const getSizeDisplay = (item: CombinedSummaryItem): string => {
    if (item.partType === 'Glass' && item.glassWidth && item.glassHeight) {
      return `${item.glassWidth.toFixed(3)}" x ${item.glassHeight.toFixed(3)}"`
    }
    if (item.cutLengths && item.cutLengths.length > 0) {
      const uniqueCuts = [...new Set(item.cutLengths.map(l => l.toFixed(3)))]
      return uniqueCuts.slice(0, 3).join('; ') + (uniqueCuts.length > 3 ? '...' : '')
    }
    return '-'
  }

  // Get stock breakdown display string
  // Converts {99: 2, 123: 1} to "2x 99" + 1x 123""
  const getStockBreakdownDisplay = (item: CombinedSummaryItem): string => {
    if ((item.partType === 'Extrusion' || item.partType === 'CutStock') && item.stockLengthBreakdown) {
      const entries = Object.entries(item.stockLengthBreakdown)
        .map(([length, count]) => ({ length: Number(length), count }))
        .sort((a, b) => a.length - b.length)

      if (entries.length === 0) return '-'
      if (entries.length === 1) {
        const { length, count } = entries[0]
        return `${count}x ${length}"`
      }

      return entries.map(({ length, count }) => `${count}x ${length}"`).join(' + ')
    }
    if (item.stockLength) {
      return `${item.stockLength}"`
    }
    return '-'
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
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Combined Purchase Summary</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Select multiple projects to generate a combined purchasing summary
        </p>
      </div>

      <div className="p-4">
        {/* Search and Filter Row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Select All Row */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedProjectIds.size === filteredProjects.length && filteredProjects.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedProjectIds.size === filteredProjects.length && filteredProjects.length > 0
              ? 'Deselect All'
              : 'Select All'}
          </button>
          <span className="text-sm text-gray-500">
            Selected: {selectedProjectIds.size} of {filteredProjects.length}
          </span>
        </div>

        {/* Project List */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
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
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  project.status === 'STAGING' ? 'bg-gray-100 text-gray-700' :
                  project.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                  project.status === 'REVISE' ? 'bg-orange-100 text-orange-700' :
                  project.status === 'QUOTE_SENT' ? 'bg-purple-100 text-purple-700' :
                  project.status === 'QUOTE_ACCEPTED' ? 'bg-indigo-100 text-indigo-700' :
                  project.status === 'ACTIVE' ? 'bg-yellow-100 text-yellow-700' :
                  project.status === 'COMPLETE' ? 'bg-green-100 text-green-700' :
                  project.status === 'ARCHIVE' ? 'bg-slate-100 text-slate-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {project.status.replace(/_/g, ' ')}
                </span>
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

        {/* Generate Button */}
        <button
          onClick={generateSummary}
          disabled={generating || selectedProjectIds.size === 0}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Summary'
          )}
        </button>

        {/* Summary Results */}
        {summaryData && (
          <div className="mt-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">Extrusions</div>
                <div className="text-xl font-bold text-blue-900">{summaryData.totals.totalExtrusions}</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-green-600 font-medium">Hardware</div>
                <div className="text-xl font-bold text-green-900">{summaryData.totals.totalHardware}</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-xs text-purple-600 font-medium">Glass</div>
                <div className="text-xl font-bold text-purple-900">{summaryData.totals.totalGlass}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-xs text-orange-600 font-medium">Options</div>
                <div className="text-xl font-bold text-orange-900">{summaryData.totals.totalOptions}</div>
              </div>
            </div>

            {/* Stock Pieces to Order */}
            {summaryData.totals.totalStockPiecesToOrder > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Total Stock Pieces to Order: </span>
                <span className="font-bold text-gray-900">{summaryData.totals.totalStockPiecesToOrder}</span>
              </div>
            )}

            {/* Projects Included */}
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Projects included:</div>
              <div className="flex flex-wrap gap-1">
                {summaryData.projects.map(p => (
                  <span key={p.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Part #</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Size</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-700">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Unit</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Stock Pieces</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summaryData.summaryItems.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{item.partNumber}</td>
                        <td className="px-3 py-2 truncate max-w-[200px]">{item.partName}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            item.partType === 'Extrusion' ? 'bg-blue-100 text-blue-700' :
                            item.partType === 'Hardware' ? 'bg-green-100 text-green-700' :
                            item.partType === 'Glass' ? 'bg-purple-100 text-purple-700' :
                            item.partType === 'Option' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {item.partType}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{getSizeDisplay(item)}</td>
                        <td className="px-3 py-2 text-right font-medium">{getPiecesDisplay(item)}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{getUnitDisplay(item)}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{getStockBreakdownDisplay(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download CSV Button */}
            <button
              onClick={downloadCSV}
              disabled={downloading}
              className="mt-4 w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download CSV
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

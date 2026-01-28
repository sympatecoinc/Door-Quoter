'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import {
  ClipboardList,
  Tag,
  Download,
  Loader2,
  RefreshCw,
  Package2,
  ChevronDown,
  Clock
} from 'lucide-react'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useDownloadStore } from '@/stores/downloadStore'

interface PackingStats {
  total: number
  packed: number
  percentage: number
}

interface LogisticsProject {
  id: number
  name: string
  dueDate: string | null
  openingsCount: number
  updatedAt: string
  packingStats: PackingStats
}

type DownloadType = 'packinglist' | 'labels' | 'boxlist'

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
        <div className="h-4 w-3/4 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-8 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-full bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-8 w-full bg-gray-200 rounded" />
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
  const { startDownload, updateProgress, completeDownload, failDownload } = useDownloadStore()

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
    let url: string
    let filename: string
    let toastName: string
    let toastType: 'packing-list' | 'labels' | 'box-list'
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '-')

    switch (type) {
      case 'packinglist':
        url = `/api/projects/${projectId}/packing-list/pdf`
        filename = `${safeProjectName}-packing-list.pdf`
        toastName = `Packing List - ${projectName}`
        toastType = 'packing-list'
        break
      case 'labels':
        url = `/api/projects/${projectId}/packing-list/stickers`
        filename = `${safeProjectName}-packing-stickers.pdf`
        toastName = `Labels - ${projectName}`
        toastType = 'labels'
        break
      case 'boxlist':
        url = `/api/projects/${projectId}/bom?boxlist=true&format=pdf`
        filename = `${safeProjectName}-box-cut-list.pdf`
        toastName = `Box Cut List - ${projectName}`
        toastType = 'box-list'
        break
      default:
        showError('Invalid download type')
        return
    }

    // Start download tracking
    const downloadId = startDownload({
      name: toastName,
      type: toastType
    })

    try {
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

      completeDownload(downloadId)
    } catch (error) {
      console.error(`Error downloading ${type}:`, error)
      failDownload(downloadId, `Failed to download ${type}`)
    }
  }

  async function downloadAllSelected() {
    if (selectedIds.size === 0) {
      showError('Please select at least one project')
      return
    }

    const selectedProjects = projects.filter(p => selectedIds.has(p.id))
    const totalFiles = selectedProjects.length * 3 // 3 document types per project

    // Build download name
    const projectNames = selectedProjects.slice(0, 2).map(p => p.name).join(', ')
    const downloadName = projectNames + (selectedProjects.length > 2 ? ` +${selectedProjects.length - 2} more` : '')

    // Start download tracking
    const downloadId = startDownload({
      name: `Logistics - ${downloadName}`,
      type: 'logistics'
    })

    setBulkDownloading(true)
    const zip = new JSZip()
    let fileCount = 0
    let errorCount = 0

    for (const project of selectedProjects) {
      const safeProjectName = project.name.replace(/[^a-zA-Z0-9]/g, '-')
      const projectFolder = selectedProjects.length > 1 ? zip.folder(safeProjectName) : zip

      // Download all three document types for each project
      const documents = [
        { type: 'packinglist', url: `/api/projects/${project.id}/packing-list/pdf`, filename: `${safeProjectName}-packing-list.pdf` },
        { type: 'labels', url: `/api/projects/${project.id}/packing-list/stickers`, filename: `${safeProjectName}-packing-stickers.pdf` },
        { type: 'boxlist', url: `/api/projects/${project.id}/bom?boxlist=true&format=pdf`, filename: `${safeProjectName}-box-cut-list.pdf` },
      ]

      for (const doc of documents) {
        try {
          const response = await fetch(doc.url)
          if (response.ok) {
            const blob = await response.blob()
            projectFolder?.file(doc.filename, blob)
            fileCount++
            // Update progress
            updateProgress(downloadId, (fileCount / totalFiles) * 100)
          } else {
            errorCount++
          }
        } catch (error) {
          console.error(`Error downloading ${doc.type} for ${project.name}:`, error)
          errorCount++
        }
      }
    }

    if (fileCount === 0) {
      failDownload(downloadId, 'No files were downloaded')
      setBulkDownloading(false)
      return
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const downloadUrl = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `logistics-documents-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      if (errorCount === 0) {
        completeDownload(downloadId)
      } else {
        failDownload(downloadId, `${fileCount} downloaded, ${errorCount} failed`)
      }
    } catch (error) {
      console.error('Error creating ZIP:', error)
      failDownload(downloadId, 'Failed to create ZIP file')
    } finally {
      setBulkDownloading(false)
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

  // Selectable options (can be checked and downloaded together)
  const selectableOptions = [
    { value: 'packinglist' as DownloadType, label: 'Packing List (PDF)', icon: ClipboardList },
    { value: 'labels' as DownloadType, label: 'Labels/Stickers (PDF)', icon: Tag },
    { value: 'boxlist' as DownloadType, label: 'Box Cut List (PDF)', icon: Package2 },
  ]

  const DownloadDropdown = ({
    projectId,
    projectName,
  }: {
    projectId: number
    projectName: string
  }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedTypes, setSelectedTypes] = useState<Set<DownloadType>>(new Set())
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null)
    const [isDownloading, setIsDownloading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const handleClickOutside = useCallback((event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }, [])

    useEffect(() => {
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        // Calculate menu position
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          const dropdownHeight = 180
          const openUpward = spaceBelow < dropdownHeight

          setMenuPosition({
            top: openUpward ? rect.top - dropdownHeight : rect.bottom + 4,
            left: rect.left,
            openUpward
          })
        }
      } else {
        setMenuPosition(null)
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, handleClickOutside])

    const toggleSelection = (value: DownloadType) => {
      setSelectedTypes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(value)) {
          newSet.delete(value)
        } else {
          newSet.add(value)
        }
        return newSet
      })
    }

    const handleDownload = async () => {
      if (selectedTypes.size === 0) return

      setIsDownloading(true)
      const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '-')
      const typesArray = Array.from(selectedTypes)

      if (selectedTypes.size === 1) {
        // Single file - download directly (toast handled in downloadDocument)
        const type = typesArray[0]
        await downloadDocument(projectId, type, projectName)
        setSelectedTypes(new Set())
        setIsDownloading(false)
        return
      }

      // Multiple files - create ZIP with toast
      const downloadId = startDownload({
        name: `Logistics - ${projectName}`,
        type: 'logistics'
      })

      try {
        const zip = new JSZip()
        let completedFiles = 0

        for (const type of typesArray) {
          let url: string
          let filename: string

          switch (type) {
            case 'packinglist':
              url = `/api/projects/${projectId}/packing-list/pdf`
              filename = `${safeProjectName}-packing-list.pdf`
              break
            case 'labels':
              url = `/api/projects/${projectId}/packing-list/stickers`
              filename = `${safeProjectName}-packing-stickers.pdf`
              break
            case 'boxlist':
              url = `/api/projects/${projectId}/bom?boxlist=true&format=pdf`
              filename = `${safeProjectName}-box-cut-list.pdf`
              break
            default:
              continue
          }

          const response = await fetch(url)
          if (response.ok) {
            const blob = await response.blob()
            zip.file(filename, blob)
            completedFiles++
            updateProgress(downloadId, (completedFiles / typesArray.length) * 100)
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const downloadUrl = window.URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `${safeProjectName}-logistics-documents.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)

        completeDownload(downloadId)
        setSelectedTypes(new Set())
      } catch (error) {
        console.error('Error downloading documents:', error)
        failDownload(downloadId, 'Failed to download documents')
      } finally {
        setIsDownloading(false)
      }
    }

    const getButtonLabel = () => {
      if (selectedTypes.size === 0) return 'Select documents...'
      if (selectedTypes.size === 1) {
        const option = selectableOptions.find(opt => opt.value === Array.from(selectedTypes)[0])
        return option?.label || 'Selected'
      }
      return `${selectedTypes.size} selected`
    }

    const dropdownMenu = isOpen && menuPosition && createPortal(
      <div
        ref={menuRef}
        className="fixed z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        {selectableOptions.map((option, index) => (
          <button
            key={option.value}
            onClick={() => toggleSelection(option.value)}
            className={`flex items-center w-full px-3 py-2.5 text-sm text-left transition-colors ${
              selectedTypes.has(option.value)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            } ${index === 0 ? 'rounded-t-lg' : ''} ${index === selectableOptions.length - 1 ? 'rounded-b-lg' : ''}`}
          >
            <div className={`w-4 h-4 mr-3 border rounded flex items-center justify-center ${
              selectedTypes.has(option.value)
                ? 'bg-blue-600 border-blue-600'
                : 'border-gray-300'
            }`}>
              {selectedTypes.has(option.value) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <option.icon className={`w-4 h-4 mr-3 ${selectedTypes.has(option.value) ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="flex-1">{option.label}</span>
          </button>
        ))}
      </div>,
      document.body
    )

    return (
      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white shadow-sm" ref={dropdownRef}>
        {/* Dropdown Select */}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center justify-between w-44 px-3 py-2 text-sm text-gray-700 bg-transparent hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-l-lg transition-colors"
          >
            <span className={selectedTypes.size > 0 ? 'font-medium text-gray-900' : 'text-gray-400'}>
              {getButtonLabel()}
            </span>
            <ChevronDown className={`w-4 h-4 ml-2 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownMenu}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* Download Button - Always visible, disabled when no selection */}
        <button
          onClick={handleDownload}
          disabled={selectedTypes.size === 0 || isDownloading}
          className={`flex items-center px-4 py-2 text-sm font-medium rounded-r-lg transition-all duration-200 ${
            selectedTypes.size > 0
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-gray-400 bg-gray-50 cursor-not-allowed'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Download className="w-4 h-4 mr-1.5" />
              Download
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipping</h1>
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
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-12" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[23%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <div className="h-4 w-4 bg-gray-200 rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Openings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Packing Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
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
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-12" />
                <col className="w-[25%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[23%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
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
                    Openings
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Packing Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {project.openingsCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(project.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      {project.packingStats.packed === 0 ? (
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="w-4 h-4 mr-1.5 text-gray-400" />
                          Awaiting Packing
                        </div>
                      ) : (
                        <div className="pr-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">
                              {project.packingStats.percentage}%
                            </span>
                            <span className="text-xs text-gray-500">
                              {project.packingStats.packed}/{project.packingStats.total}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                project.packingStats.percentage === 100
                                  ? 'bg-green-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${project.packingStats.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DownloadDropdown
                        projectId={project.id}
                        projectName={project.name}
                      />
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

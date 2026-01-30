'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle
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

interface PackingComponent {
  panelType: string
  width: number
  height: number
  glassType: string | null
  productName: string
  stickerNumber: number
  status: 'pending' | 'packed'
  packedAt: string | null
}

interface PackingHardware {
  partName: string
  partNumber: string | null
  description: string | null
  stickerNumber: number
  status: 'pending' | 'packed'
  packedAt: string | null
}

interface PackingJambKit {
  stickerNumber: number
  itemCount: number
  status: 'pending' | 'packed'
  packedAt: string | null
}

interface PackingOpening {
  openingId: number
  openingName: string
  components: PackingComponent[]
  hardware: PackingHardware[]
  jambKit: PackingJambKit | null
}

interface PackingData {
  packingList: PackingOpening[]
  jambKits: Array<{ openingId: number; openingName: string; itemCount: number }>
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
      <td className="px-2 py-3">
        <div className="h-4 w-4 bg-gray-200 rounded" />
      </td>
      <td className="px-2 py-3">
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
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [packingData, setPackingData] = useState<Record<number, PackingData>>({})
  const [loadingPacking, setLoadingPacking] = useState<number | null>(null)
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

  async function toggleExpand(projectId: number) {
    if (expandedId === projectId) {
      setExpandedId(null)
      return
    }

    setExpandedId(projectId)

    // Fetch packing data if not already cached
    if (!packingData[projectId]) {
      setLoadingPacking(projectId)
      try {
        const response = await fetch(`/api/projects/${projectId}/packing-list`)
        if (response.ok) {
          const data = await response.json()
          setPackingData(prev => ({ ...prev, [projectId]: data }))
        } else {
          showError('Failed to load packing details')
        }
      } catch (error) {
        console.error('Error fetching packing list:', error)
        showError('Failed to load packing details')
      } finally {
        setLoadingPacking(null)
      }
    }
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
                <col className="w-10" />
                <col className="w-12" />
                <col className="w-[23%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[22%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-3 text-left">
                    {/* Expand column */}
                  </th>
                  <th className="px-2 py-3 text-left">
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
                <col className="w-10" />
                <col className="w-12" />
                <col className="w-[23%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[22%]" />
                <col className="w-[25%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-3 text-left">
                    {/* Expand column */}
                  </th>
                  <th className="px-2 py-3 text-left">
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
                  <React.Fragment key={project.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(project.id) ? 'bg-blue-50' : ''} ${expandedId === project.id ? 'bg-gray-50' : ''}`}
                      onClick={(e) => {
                        // Don't expand if clicking on checkbox or download dropdown
                        const target = e.target as HTMLElement
                        if (target.closest('input[type="checkbox"]') || target.closest('.download-dropdown')) return
                        toggleExpand(project.id)
                      }}
                    >
                      <td className="px-2 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(project.id)
                          }}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {loadingPacking === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <ChevronRight
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                expandedId === project.id ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(project.id)}
                          onChange={() => toggleSelect(project.id)}
                          onClick={(e) => e.stopPropagation()}
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
                      <td className="px-4 py-3 text-right download-dropdown" onClick={(e) => e.stopPropagation()}>
                        <DownloadDropdown
                          projectId={project.id}
                          projectName={project.name}
                        />
                      </td>
                    </tr>
                    {/* Expanded packing details row */}
                    {expandedId === project.id && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50 border-t border-gray-100">
                          <div className="px-6 py-4">
                            {loadingPacking === project.id ? (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                <span className="ml-2 text-gray-500">Loading packing details...</span>
                              </div>
                            ) : packingData[project.id] ? (
                              <div className="space-y-4">
                                {packingData[project.id].packingList.map((opening) => {
                                  const allItems = [
                                    ...opening.components.map(c => ({ type: 'component' as const, ...c })),
                                    ...opening.hardware.map(h => ({ type: 'hardware' as const, ...h })),
                                    ...(opening.jambKit ? [{ type: 'jambkit' as const, ...opening.jambKit }] : [])
                                  ]
                                  const packedCount = allItems.filter(i => i.status === 'packed').length
                                  const totalCount = allItems.length

                                  return (
                                    <div key={opening.openingId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                      <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                                        <span className="font-medium text-gray-900">{opening.openingName}</span>
                                        <span className={`text-sm ${packedCount === totalCount ? 'text-green-600' : 'text-gray-500'}`}>
                                          {packedCount}/{totalCount} staged
                                        </span>
                                      </div>
                                      <div className="divide-y divide-gray-100">
                                        {/* Components */}
                                        {opening.components.map((component) => (
                                          <div
                                            key={component.stickerNumber}
                                            className="px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                                          >
                                            <div className="flex items-center">
                                              {component.status === 'packed' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-gray-300 mr-3 flex-shrink-0" />
                                              )}
                                              <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                  {component.productName}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {component.width}" x {component.height}" • Sticker #{component.stickerNumber}
                                                </div>
                                              </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              component.status === 'packed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {component.status === 'packed' ? 'Staged' : 'Pending'}
                                            </span>
                                          </div>
                                        ))}
                                        {/* Hardware */}
                                        {opening.hardware.map((hw) => (
                                          <div
                                            key={hw.stickerNumber}
                                            className="px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                                          >
                                            <div className="flex items-center">
                                              {hw.status === 'packed' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-gray-300 mr-3 flex-shrink-0" />
                                              )}
                                              <div>
                                                <div className="text-sm text-gray-900">
                                                  {hw.partName}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {hw.partNumber && `${hw.partNumber} • `}Sticker #{hw.stickerNumber}
                                                </div>
                                              </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              hw.status === 'packed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {hw.status === 'packed' ? 'Staged' : 'Pending'}
                                            </span>
                                          </div>
                                        ))}
                                        {/* Jamb Kit */}
                                        {opening.jambKit && (
                                          <div className="px-4 py-2 flex items-center justify-between hover:bg-gray-50">
                                            <div className="flex items-center">
                                              {opening.jambKit.status === 'packed' ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                                              ) : (
                                                <Circle className="w-4 h-4 text-gray-300 mr-3 flex-shrink-0" />
                                              )}
                                              <div>
                                                <div className="text-sm text-gray-900">
                                                  Jamb Kit ({opening.jambKit.itemCount} items)
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  Sticker #{opening.jambKit.stickerNumber}
                                                </div>
                                              </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              opening.jambKit.status === 'packed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                              {opening.jambKit.status === 'packed' ? 'Staged' : 'Pending'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {packingData[project.id].packingList.length === 0 && (
                                  <div className="text-center py-8 text-gray-500">
                                    No packing items found for this project
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                Failed to load packing details
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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

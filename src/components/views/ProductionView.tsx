'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import {
  Scissors,
  ClipboardList,
  Package2,
  Download,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
  FileText
} from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG } from '@/types'
import StatusBadge from '@/components/projects/StatusBadge'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import BomDownloadModal from '../production/BomDownloadModal'
import ShopDrawingsDownloadModal from '../production/ShopDrawingsDownloadModal'
import CutListDownloadModal, { CutListConfigData } from '../production/CutListDownloadModal'

// Types for bulk download configuration
interface BomConfig {
  projectId: number
  projectName: string
  selectedHashes: string[]
}

// Use CutListConfigData imported from CutListDownloadModal
type CutListConfig = CutListConfigData

interface ProductionProject {
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

type DownloadType = 'bom' | 'cutlist' | 'picklist' | 'jambkit' | 'shopdrawings'

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
        <div className="h-8 w-40 bg-gray-200 rounded" />
      </td>
    </tr>
  )
}

export default function ProductionView() {
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState<DownloadingState>({})
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [bomModalProject, setBomModalProject] = useState<{ id: number; name: string } | null>(null)
  const [shopDrawingsModalProject, setShopDrawingsModalProject] = useState<{ id: number; name: string } | null>(null)
  const [cutListModalProjects, setCutListModalProjects] = useState<Array<{ id: number; name: string }> | null>(null)

  // Bulk download queue state - stores configuration as user goes through modals
  const [bulkDownloadQueue, setBulkDownloadQueue] = useState<{
    pendingModals: Array<'bom' | 'cutlist'>
    projects: Array<{ id: number; name: string }>
    pendingDirectDownloads: Array<{ projectId: number; projectName: string; type: DownloadType }>
    // Collected configurations
    bomConfigs: BomConfig[]
    cutListConfigs: CutListConfig[]
  } | null>(null)

  const { toasts, removeToast, showSuccess, showError } = useToast()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      const response = await fetch('/api/production')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        showError('Failed to load production projects')
      }
    } catch (error) {
      console.error('Error fetching production projects:', error)
      showError('Failed to load production projects')
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
        case 'cutlist':
          url = `/api/projects/${projectId}/bom?cutlist=true&format=csv`
          filename = `${safeProjectName}-cutlist.csv`
          break
        case 'picklist':
          url = `/api/projects/${projectId}/bom?picklist=true&format=pdf`
          filename = `${safeProjectName}-pick-list.pdf`
          break
        case 'jambkit':
          url = `/api/projects/${projectId}/bom?jambkit=true&format=pdf`
          filename = `${safeProjectName}-jamb-kit-list.pdf`
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

    const selectedProjects = projects.filter(p => selectedIds.has(p.id))

    // Determine which modal-based downloads are needed
    const pendingModals: Array<'bom' | 'cutlist'> = []
    const pendingDirectDownloads: Array<{ projectId: number; projectName: string; type: DownloadType }> = []

    // Check which document types need modals vs direct download
    for (const docType of bulkDownloadTypes) {
      if (docType === 'bom') {
        pendingModals.push('bom')
      } else if (docType === 'cutlist') {
        pendingModals.push('cutlist')
      } else {
        // Queue direct downloads for each project
        for (const project of selectedProjects) {
          pendingDirectDownloads.push({
            projectId: project.id,
            projectName: project.name,
            type: docType
          })
        }
      }
    }

    // If there are modal-based downloads, set up the queue and show the first modal
    if (pendingModals.length > 0) {
      setBulkDownloadQueue({
        pendingModals,
        projects: selectedProjects.map(p => ({ id: p.id, name: p.name })),
        pendingDirectDownloads,
        bomConfigs: [],
        cutListConfigs: []
      })

      // Show the first modal
      const firstModal = pendingModals[0]
      if (firstModal === 'bom') {
        setBomModalProject({ id: selectedProjects[0].id, name: selectedProjects[0].name })
      } else if (firstModal === 'cutlist') {
        setCutListModalProjects(selectedProjects.map(p => ({ id: p.id, name: p.name })))
      }
    } else {
      // No modals needed, just do direct downloads
      await executeAllDownloadsAsZip([], [], pendingDirectDownloads)
    }
  }

  // Process remaining bulk download queue after a modal completes with its config
  function processBulkDownloadQueue(
    completedModal: 'bom' | 'cutlist',
    config?: BomConfig | CutListConfig
  ) {
    if (!bulkDownloadQueue) return

    // Update configs with the new data (with safety check for arrays)
    const updatedBomConfigs = [...(bulkDownloadQueue.bomConfigs || [])]
    const updatedCutListConfigs = [...(bulkDownloadQueue.cutListConfigs || [])]

    if (completedModal === 'bom' && config) {
      updatedBomConfigs.push(config as BomConfig)
    } else if (completedModal === 'cutlist' && config) {
      updatedCutListConfigs.push(config as CutListConfig)
    }

    const remainingModals = bulkDownloadQueue.pendingModals.filter(m => m !== completedModal)

    if (remainingModals.length > 0) {
      // Show the next modal
      const nextModal = remainingModals[0]
      setBulkDownloadQueue({
        ...bulkDownloadQueue,
        pendingModals: remainingModals,
        bomConfigs: updatedBomConfigs,
        cutListConfigs: updatedCutListConfigs
      })

      if (nextModal === 'bom') {
        setBomModalProject({ id: bulkDownloadQueue.projects[0].id, name: bulkDownloadQueue.projects[0].name })
      } else if (nextModal === 'cutlist') {
        setCutListModalProjects(bulkDownloadQueue.projects)
      }
    } else {
      // All modals done, execute all downloads as single ZIP
      executeAllDownloadsAsZip(
        updatedBomConfigs,
        updatedCutListConfigs,
        bulkDownloadQueue.pendingDirectDownloads
      )
      setBulkDownloadQueue(null)
    }
  }

  // Process bulk download queue when CutList modal completes (returns array of configs)
  function processBulkDownloadQueueWithCutList(
    completedModal: 'cutlist',
    configs: CutListConfig[]
  ) {
    if (!bulkDownloadQueue) return

    // Safety check for arrays
    const updatedBomConfigs = [...(bulkDownloadQueue.bomConfigs || [])]
    const updatedCutListConfigs = [...(bulkDownloadQueue.cutListConfigs || []), ...configs]

    const remainingModals = bulkDownloadQueue.pendingModals.filter(m => m !== completedModal)

    if (remainingModals.length > 0) {
      // Show the next modal
      const nextModal = remainingModals[0]
      setBulkDownloadQueue({
        ...bulkDownloadQueue,
        pendingModals: remainingModals,
        bomConfigs: updatedBomConfigs,
        cutListConfigs: updatedCutListConfigs
      })

      if (nextModal === 'bom') {
        setBomModalProject({ id: bulkDownloadQueue.projects[0].id, name: bulkDownloadQueue.projects[0].name })
      } else if (nextModal === 'cutlist') {
        setCutListModalProjects(bulkDownloadQueue.projects)
      }
    } else {
      // All modals done, execute all downloads as single ZIP
      executeAllDownloadsAsZip(
        updatedBomConfigs,
        updatedCutListConfigs,
        bulkDownloadQueue.pendingDirectDownloads
      )
      setBulkDownloadQueue(null)
    }
  }

  // Download all configured items and bundle into a single ZIP
  async function executeAllDownloadsAsZip(
    bomConfigs: BomConfig[],
    cutListConfigs: CutListConfig[],
    directDownloads: Array<{ projectId: number; projectName: string; type: DownloadType }>
  ) {
    setBulkDownloading(true)
    let errorCount = 0

    // Collect all files first to determine download strategy
    interface FileToDownload {
      filename: string
      blob: Blob
      type: 'bom' | 'cutlist' | 'other'
    }
    const filesToDownload: FileToDownload[] = []

    try {
      // Fetch BOMs
      for (const bomConfig of bomConfigs) {
        try {
          const safeProjectName = bomConfig.projectName.replace(/[^a-zA-Z0-9]/g, '-')
          const selectedParam = bomConfig.selectedHashes.join('|')
          const url = `/api/projects/${bomConfig.projectId}/bom/csv?zip=true&unique=true&selected=${encodeURIComponent(selectedParam)}`

          const response = await fetch(url)
          if (response.ok) {
            const contentType = response.headers.get('Content-Type') || ''
            const blob = await response.blob()

            if (contentType.includes('application/zip')) {
              // It's a ZIP - extract files
              const bomZip = await JSZip.loadAsync(blob)
              const filePromises: Promise<void>[] = []
              bomZip.forEach((relativePath, file) => {
                if (!file.dir) {
                  filePromises.push(
                    file.async('blob').then(content => {
                      filesToDownload.push({
                        filename: `${safeProjectName}-${relativePath}`,
                        blob: content,
                        type: 'bom'
                      })
                    })
                  )
                }
              })
              await Promise.all(filePromises)
            } else {
              // It's a single CSV file
              const contentDisposition = response.headers.get('Content-Disposition') || ''
              let filename = `${safeProjectName}-bom.csv`
              const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
              if (filenameMatch) {
                filename = `${safeProjectName}-${filenameMatch[1]}`
              }
              filesToDownload.push({ filename, blob, type: 'bom' })
            }
          } else {
            errorCount++
          }
        } catch (error) {
          console.error('Error fetching BOM:', error)
          errorCount++
        }
      }

      // Fetch Cut Lists
      for (const cutListConfig of cutListConfigs) {
        const safeProjectName = cutListConfig.projectName.replace(/[^a-zA-Z0-9]/g, '-')

        for (const group of cutListConfig.groups) {
          try {
            const safeProductName = group.productName.replace(/\s+/g, '-')
            const url = `/api/projects/${cutListConfig.projectId}/bom?cutlist=true&format=csv&product=${encodeURIComponent(group.productName)}&size=${encodeURIComponent(group.sizeKey)}&batch=${group.batchSize}`

            const response = await fetch(url)
            if (response.ok) {
              const blob = await response.blob()
              filesToDownload.push({
                filename: `${safeProjectName}-${safeProductName}-${group.sizeKey}-${group.batchSize}units-cutlist.csv`,
                blob,
                type: 'cutlist'
              })
            } else {
              errorCount++
            }
          } catch (error) {
            console.error('Error fetching cut list:', error)
            errorCount++
          }
        }
      }

      // Fetch direct files (picklist, jambkit, etc.)
      for (const download of directDownloads) {
        try {
          const safeProjectName = download.projectName.replace(/[^a-zA-Z0-9]/g, '-')
          let url: string
          let filename: string

          switch (download.type) {
            case 'picklist':
              url = `/api/projects/${download.projectId}/bom?picklist=true&format=pdf`
              filename = `${safeProjectName}-pick-list.pdf`
              break
            case 'jambkit':
              url = `/api/projects/${download.projectId}/bom?jambkit=true&format=pdf`
              filename = `${safeProjectName}-jamb-kit-list.pdf`
              break
            case 'shopdrawings':
              continue
            default:
              continue
          }

          const response = await fetch(url)
          if (response.ok) {
            const blob = await response.blob()
            filesToDownload.push({ filename, blob, type: 'other' })
          } else {
            errorCount++
          }
        } catch (error) {
          console.error('Error fetching direct download:', error)
          errorCount++
        }
      }

      // Now determine download strategy based on collected files
      const fileCount = filesToDownload.length
      const bomFiles = filesToDownload.filter(f => f.type === 'bom')
      const cutlistFiles = filesToDownload.filter(f => f.type === 'cutlist')
      const otherFiles = filesToDownload.filter(f => f.type === 'other')

      if (fileCount === 0) {
        showError('No files were downloaded')
        setBulkDownloading(false)
        return
      }

      if (fileCount === 1) {
        // Single file - download directly without ZIP
        const file = filesToDownload[0]
        const downloadUrl = window.URL.createObjectURL(file.blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = file.filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)
        showSuccess('Downloaded successfully!')
        setBulkDownloading(false)
        return
      }

      // Multiple files - create ZIP
      const zip = new JSZip()

      // Determine if we need folders for BOMs and Cut Lists
      const needBomFolder = bomFiles.length > 1
      const needCutlistFolder = cutlistFiles.length > 1

      // Add BOM files
      if (needBomFolder) {
        const bomFolder = zip.folder('boms')
        for (const file of bomFiles) {
          bomFolder?.file(file.filename, file.blob)
        }
      } else {
        for (const file of bomFiles) {
          zip.file(file.filename, file.blob)
        }
      }

      // Add Cut List files
      if (needCutlistFolder) {
        const cutlistFolder = zip.folder('cutlists')
        for (const file of cutlistFiles) {
          cutlistFolder?.file(file.filename, file.blob)
        }
      } else {
        for (const file of cutlistFiles) {
          zip.file(file.filename, file.blob)
        }
      }

      // Add other files at root level
      for (const file of otherFiles) {
        zip.file(file.filename, file.blob)
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const downloadUrl = window.URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `production-documents-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      if (errorCount === 0) {
        showSuccess(`Downloaded ${fileCount} file${fileCount !== 1 ? 's' : ''} in ZIP`)
      } else {
        showSuccess(`Downloaded ${fileCount} file${fileCount !== 1 ? 's' : ''} (${errorCount} failed)`)
      }
    } catch (error) {
      console.error('Error creating ZIP:', error)
      showError('Failed to create ZIP file')
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
    { value: 'bom' as DownloadType, label: 'BOM (CSV)', icon: FileSpreadsheet },
    { value: 'cutlist' as DownloadType, label: 'Cut List (CSV)', icon: Scissors },
    { value: 'picklist' as DownloadType, label: 'Pick List (PDF)', icon: ClipboardList },
    { value: 'jambkit' as DownloadType, label: 'Jamb Kit List (PDF)', icon: Package2 },
  ]

  // Direct download options (no checkbox, download immediately)
  const directOptions = [
    { value: 'shopdrawings' as DownloadType, label: 'Shop Drawings (PDF)', icon: FileText },
  ]

  // Combined for backward compatibility
  const downloadOptions = [...selectableOptions, ...directOptions.map(o => ({ ...o, selectable: false }))]

  // Options that can be included in bulk downloads
  const bulkDownloadTypes: DownloadType[] = ['bom', 'cutlist', 'picklist', 'jambkit']

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
          const dropdownHeight = 240
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
      // Only allow toggling selectable options
      const isSelectable = selectableOptions.some(opt => opt.value === value)
      if (!isSelectable) {
        return
      }

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

      // Determine which modal-based downloads are needed
      const modalTypes: Array<'bom' | 'cutlist'> = []
      const directDownloads: DownloadType[] = []

      for (const type of selectedTypes) {
        if (type === 'bom') {
          modalTypes.push('bom')
        } else if (type === 'cutlist') {
          modalTypes.push('cutlist')
        } else {
          directDownloads.push(type)
        }
      }

      // If there are modal-based downloads, set up the queue
      if (modalTypes.length > 0) {
        const pendingDirectDownloads = directDownloads.map(type => ({
          projectId,
          projectName,
          type
        }))

        setBulkDownloadQueue({
          pendingModals: modalTypes,
          projects: [{ id: projectId, name: projectName }],
          pendingDirectDownloads,
          bomConfigs: [],
          cutListConfigs: []
        })

        // Show the first modal
        const firstModal = modalTypes[0]
        if (firstModal === 'bom') {
          setBomModalProject({ id: projectId, name: projectName })
        } else if (firstModal === 'cutlist') {
          setCutListModalProjects([{ id: projectId, name: projectName }])
        }
      } else {
        // No modals needed, just do direct downloads
        for (const type of directDownloads) {
          if (type === 'shopdrawings') {
            setShopDrawingsModalProject({ id: projectId, name: projectName })
          } else {
            await downloadDocument(projectId, type, projectName)
          }
        }
      }

      setIsDownloading(false)
      setSelectedTypes(new Set())
    }

    const getButtonLabel = () => {
      if (selectedTypes.size === 0) return 'Select documents...'
      if (selectedTypes.size === 1) {
        const option = downloadOptions.find(opt => opt.value === Array.from(selectedTypes)[0])
        return option?.label || 'Selected'
      }
      return `${selectedTypes.size} selected`
    }

    const dropdownMenu = isOpen && menuPosition && createPortal(
      <div
        ref={menuRef}
        className="fixed z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        {/* Selectable options with checkboxes */}
        {selectableOptions.map((option, index) => (
          <button
            key={option.value}
            onClick={() => toggleSelection(option.value)}
            className={`flex items-center w-full px-3 py-2.5 text-sm text-left transition-colors ${
              selectedTypes.has(option.value)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-50'
            } ${index === 0 ? 'rounded-t-lg' : ''}`}
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
            <span className="flex-1">{option.label}</span>
          </button>
        ))}

        {/* Separator with label */}
        <div className="border-t border-gray-200 mt-2">
          <div className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
            Other Downloads
          </div>
        </div>

        {/* Direct download options (Shop Drawings) */}
        {directOptions.map((option, index) => (
          <button
            key={option.value}
            onClick={() => {
              if (option.value === 'shopdrawings') {
                setShopDrawingsModalProject({ id: projectId, name: projectName })
              }
              setIsOpen(false)
            }}
            className={`flex items-center w-full px-3 py-2.5 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors ${
              index === directOptions.length - 1 ? 'rounded-b-lg' : ''
            }`}
          >
            <option.icon className="w-4 h-4 mr-3 text-gray-400" />
            <span className="flex-1">{option.label}</span>
            <Download className="w-3.5 h-3.5 text-gray-400" />
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
          <h1 className="text-3xl font-bold text-gray-900">Production</h1>
          <p className="text-gray-600 mt-2">
            Projects ready for production (Approved, Quote Accepted, or Active)
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loading ? (
          <div className="overflow-x-auto rounded-xl">
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
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Production Projects</h3>
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
            Showing {projects.length} project{projects.length !== 1 ? 's' : ''} ready for production
          </div>
          {selectedIds.size > 0 && (
            <div>
              {selectedIds.size} project{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}

      {/* BOM Download Modal */}
      {bomModalProject && (
        <BomDownloadModal
          projectId={bomModalProject.id}
          projectName={bomModalProject.name}
          onClose={() => {
            setBomModalProject(null)
            if (bulkDownloadQueue) {
              // User cancelled during bulk download, clear the queue
              setBulkDownloadQueue(null)
            }
          }}
          showError={showError}
          showSuccess={showSuccess}
          onConfigure={bulkDownloadQueue ? (config) => {
            setBomModalProject(null)
            processBulkDownloadQueue('bom', config)
          } : undefined}
          hasMoreModals={bulkDownloadQueue ? bulkDownloadQueue.pendingModals.filter(m => m !== 'bom').length > 0 : false}
        />
      )}

      {/* Shop Drawings Download Modal */}
      {shopDrawingsModalProject && (
        <ShopDrawingsDownloadModal
          projectId={shopDrawingsModalProject.id}
          projectName={shopDrawingsModalProject.name}
          onClose={() => setShopDrawingsModalProject(null)}
          showError={showError}
          showSuccess={showSuccess}
        />
      )}

      {/* Cut List Download Modal */}
      {cutListModalProjects && (
        <CutListDownloadModal
          projects={cutListModalProjects}
          onClose={() => {
            setCutListModalProjects(null)
            if (bulkDownloadQueue) {
              // User cancelled during bulk download, clear the queue
              setBulkDownloadQueue(null)
            }
          }}
          showError={showError}
          showSuccess={showSuccess}
          onConfigure={bulkDownloadQueue ? (configs) => {
            setCutListModalProjects(null)
            // CutListDownloadModal returns an array of configs, we need to merge them
            processBulkDownloadQueueWithCutList('cutlist', configs)
          } : undefined}
          hasMoreModals={bulkDownloadQueue ? bulkDownloadQueue.pendingModals.filter(m => m !== 'cutlist').length > 0 : false}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import JSZip from 'jszip'
import {
  ClipboardList,
  Package2,
  Download,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  ChevronDown,
  FileText,
  Settings,
  X,
  PlayCircle,
  Boxes,
  Package,
  ClipboardCheck,
  Truck,
  Ruler
} from 'lucide-react'
import SawBlade from '../icons/SawBlade'
import DrillBit from '../icons/DrillBit'
import { ProjectStatus, STATUS_CONFIG } from '@/types'
import ProductionTimeline from '@/components/production/ProductionTimeline'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import BomDownloadModal from '../production/BomDownloadModal'
import ShopDrawingsDownloadModal from '../production/ShopDrawingsDownloadModal'
import CutListDownloadModal, { CutListConfigData } from '../production/CutListDownloadModal'
import ExpandableProjectRow from '../production/ExpandableProjectRow'

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
  version?: number
  status: ProjectStatus
  dueDate: string | null
  customerId: number | null
  customerName: string
  customerContact: string | null
  openingsCount: number
  batchSize: number | null
  updatedAt: string
  workOrderProgress?: {
    total: number
    stageDistribution: Record<string, number>
    workOrders?: Array<{
      id: string
      stage: string
      progressPercent: number
    }>
  }
  fieldVerificationCount?: number
}

interface StationCount {
  stage: string
  count: number
}

type DownloadType = 'bom' | 'bomPdf' | 'cutlist' | 'cutlistPdf' | 'picklist' | 'jambkit' | 'shopdrawings' | 'fieldverification'

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
      <td className="px-3 py-3 whitespace-nowrap w-28">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-3 py-3 text-center w-24">
        <div className="h-4 w-10 bg-gray-200 rounded mx-auto" />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
        </div>
        <div className="h-3 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-8 w-40 bg-gray-200 rounded inline-block" />
      </td>
    </tr>
  )
}

function ProductionSettingsModal({
  defaultBatchSize,
  onSave,
  onClose,
  loading
}: {
  defaultBatchSize: number | null
  onSave: (value: number | null) => void
  onClose: () => void
  loading: boolean
}) {
  const [value, setValue] = useState(defaultBatchSize?.toString() || '')

  const handleSave = () => {
    const trimmed = value.trim()
    if (trimmed === '' || trimmed.toLowerCase() === 'all') {
      onSave(null)
    } else {
      const parsed = parseInt(trimmed)
      if (isNaN(parsed) || parsed < 1) {
        return
      }
      onSave(parsed)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Production Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Batch Size
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="All (no default)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Sets the default batch size for cut lists. Projects can override this individually.
              Leave empty or type "All" for no default.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductionView() {
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState<DownloadingState>({})
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [bomModalProject, setBomModalProject] = useState<{ id: number; name: string; format?: 'csv' | 'pdf' } | null>(null)
  const [shopDrawingsModalProject, setShopDrawingsModalProject] = useState<{ id: number; name: string } | null>(null)
  const [cutListModalProjects, setCutListModalProjects] = useState<Array<{ id: number; name: string; batchSize?: number | null; format?: 'csv' | 'pdf' }> | null>(null)
  const [editingBatchSize, setEditingBatchSize] = useState<{ projectId: number; value: string } | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [defaultBatchSize, setDefaultBatchSize] = useState<number | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [stationCounts, setStationCounts] = useState<StationCount[]>([])
  const [generatingWorkOrders, setGeneratingWorkOrders] = useState<Set<number>>(new Set())
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<number>>(new Set())

  // Bulk download queue state - stores configuration as user goes through modals
  const [bulkDownloadQueue, setBulkDownloadQueue] = useState<{
    pendingModals: Array<'bom' | 'cutlist'>
    projects: Array<{ id: number; name: string; batchSize?: number | null }>
    pendingDirectDownloads: Array<{ projectId: number; projectName: string; type: DownloadType }>
    // Collected configurations
    bomConfigs: BomConfig[]
    cutListConfigs: CutListConfig[]
    // Format preferences for modals
    bomFormat?: 'csv' | 'pdf'
    cutlistFormat?: 'csv' | 'pdf'
  } | null>(null)

  const { toasts, removeToast, showSuccess, showError } = useToast()

  useEffect(() => {
    fetchProjects()
    fetchSettings()
    fetchStationCounts()
  }, [])

  async function fetchStationCounts() {
    try {
      const response = await fetch('/api/work-orders?limit=1')
      if (response.ok) {
        // Get counts from all stages
        const stages = ['STAGED', 'CUTTING', 'MILLING', 'ASSEMBLY', 'QC', 'SHIP']
        const counts: StationCount[] = []
        for (const stage of stages) {
          const stageRes = await fetch(`/api/work-orders/station/${stage.toLowerCase()}`)
          if (stageRes.ok) {
            const data = await stageRes.json()
            counts.push({ stage, count: data.count || 0 })
          }
        }
        setStationCounts(counts)
      }
    } catch (error) {
      console.error('Error fetching station counts:', error)
    }
  }

  async function generateWorkOrders(projectId: number) {
    setGeneratingWorkOrders(prev => new Set([...prev, projectId]))
    try {
      const response = await fetch(`/api/projects/${projectId}/work-orders/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        const data = await response.json()
        showSuccess(`Created ${data.summary.created} work order${data.summary.created !== 1 ? 's' : ''}`)
        fetchProjects() // Refresh to show new progress
        fetchStationCounts()
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to generate work orders')
      }
    } catch (error) {
      console.error('Error generating work orders:', error)
      showError('Failed to generate work orders')
    } finally {
      setGeneratingWorkOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(projectId)
        return newSet
      })
    }
  }

  async function fetchSettings() {
    try {
      const response = await fetch('/api/production/settings')
      if (response.ok) {
        const data = await response.json()
        setDefaultBatchSize(data.defaultBatchSize)
      }
    } catch (error) {
      console.error('Error fetching production settings:', error)
    }
  }

  async function saveDefaultBatchSize(value: number | null) {
    setSettingsLoading(true)
    try {
      const response = await fetch('/api/production/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultBatchSize: value })
      })

      if (response.ok) {
        setDefaultBatchSize(value)
        showSuccess('Default batch size saved')
        setShowSettingsModal(false)
      } else {
        showError('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      showError('Failed to save settings')
    } finally {
      setSettingsLoading(false)
    }
  }

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

  function toggleExpand(projectId: number) {
    const newExpanded = new Set(expandedProjectIds)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjectIds(newExpanded)
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
        case 'fieldverification':
          url = `/api/projects/${projectId}/field-verification`
          filename = `${safeProjectName}-field-verification.pdf`
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
        projects: selectedProjects.map(p => ({ id: p.id, name: p.name, batchSize: p.batchSize })),
        pendingDirectDownloads,
        bomConfigs: [],
        cutListConfigs: []
      })

      // Show the first modal
      const firstModal = pendingModals[0]
      if (firstModal === 'bom') {
        setBomModalProject({ id: selectedProjects[0].id, name: selectedProjects[0].name })
      } else if (firstModal === 'cutlist') {
        setCutListModalProjects(selectedProjects.map(p => ({ id: p.id, name: p.name, batchSize: p.batchSize })))
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
            case 'fieldverification':
              url = `/api/projects/${download.projectId}/field-verification`
              filename = `${safeProjectName}-field-verification.pdf`
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

  async function saveBatchSize(projectId: number, value: string) {
    const trimmed = value.trim()
    const batchSize = trimmed === '' || trimmed.toLowerCase() === 'all' ? null : parseInt(trimmed)

    if (batchSize !== null && (isNaN(batchSize) || batchSize < 1)) {
      showError('Batch size must be a positive number or "All"')
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize })
      })

      if (response.ok) {
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, batchSize } : p
        ))
      } else {
        showError('Failed to save batch size')
      }
    } catch (error) {
      console.error('Error saving batch size:', error)
      showError('Failed to save batch size')
    }
  }

  function isProjectDownloading(projectId: number): boolean {
    const state = downloading[projectId]
    if (!state) return false
    return Object.values(state).some(v => v)
  }

  // Selectable options (can be checked and downloaded together)
  const selectableOptions = [
    { value: 'bom' as DownloadType, label: 'BOM (CSV)', icon: FileSpreadsheet },
    { value: 'bomPdf' as DownloadType, label: 'BOM (PDF)', icon: FileText },
    { value: 'cutlist' as DownloadType, label: 'Cut List (CSV)', icon: SawBlade },
    { value: 'cutlistPdf' as DownloadType, label: 'Cut List (PDF)', icon: FileText },
    { value: 'picklist' as DownloadType, label: 'Pick List (PDF)', icon: ClipboardList },
    { value: 'jambkit' as DownloadType, label: 'Jamb Kit List (PDF)', icon: Package2 },
    { value: 'fieldverification' as DownloadType, label: 'Field Verification (PDF)', icon: Ruler },
  ]

  // Direct download options (no checkbox, download immediately)
  const directOptions = [
    { value: 'shopdrawings' as DownloadType, label: 'Shop Drawings (PDF)', icon: FileText },
  ]

  // Combined for backward compatibility
  const downloadOptions = [...selectableOptions, ...directOptions.map(o => ({ ...o, selectable: false }))]

  // Options that can be included in bulk downloads
  const bulkDownloadTypes: DownloadType[] = ['bom', 'bomPdf', 'cutlist', 'cutlistPdf', 'picklist', 'jambkit', 'fieldverification']

  const DownloadDropdown = ({
    projectId,
    projectName,
    batchSize,
  }: {
    projectId: number
    projectName: string
    batchSize: number | null
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
      // Track both the modal type and format (csv or pdf)
      const modalTypes: Array<{ type: 'bom' | 'cutlist', format: 'csv' | 'pdf' }> = []
      const directDownloads: DownloadType[] = []

      for (const type of selectedTypes) {
        if (type === 'bom') {
          modalTypes.push({ type: 'bom', format: 'csv' })
        } else if (type === 'bomPdf') {
          modalTypes.push({ type: 'bom', format: 'pdf' })
        } else if (type === 'cutlist') {
          modalTypes.push({ type: 'cutlist', format: 'csv' })
        } else if (type === 'cutlistPdf') {
          modalTypes.push({ type: 'cutlist', format: 'pdf' })
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

        // For now, we'll handle one format at a time - prioritize PDF if both selected
        // In bulk mode, the modal will receive the format prop
        const bomModal = modalTypes.find(m => m.type === 'bom')
        const cutlistModal = modalTypes.find(m => m.type === 'cutlist')
        const pendingModals: Array<'bom' | 'cutlist'> = []
        if (bomModal) pendingModals.push('bom')
        if (cutlistModal) pendingModals.push('cutlist')

        setBulkDownloadQueue({
          pendingModals,
          projects: [{ id: projectId, name: projectName, batchSize }],
          pendingDirectDownloads,
          bomConfigs: [],
          cutListConfigs: [],
          // Store format preferences for modals
          bomFormat: bomModal?.format || 'csv',
          cutlistFormat: cutlistModal?.format || 'csv'
        } as any)

        // Show the first modal
        const firstModal = pendingModals[0]
        if (firstModal === 'bom') {
          setBomModalProject({ id: projectId, name: projectName, format: bomModal?.format || 'csv' } as any)
        } else if (firstModal === 'cutlist') {
          setCutListModalProjects([{ id: projectId, name: projectName, batchSize, format: cutlistModal?.format || 'csv' } as any])
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">Production</h1>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Production Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Projects ready for production
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Station Navigation Links */}
          <div className="flex items-center gap-1 mr-2">
            <Link
              href="/production/staged"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              <Boxes className="w-3.5 h-3.5" />
              Staged
              {(stationCounts.find(s => s.stage === 'STAGED')?.count ?? 0) > 0 && (
                <span className="bg-gray-200 text-gray-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'STAGED')?.count}
                </span>
              )}
            </Link>
            <Link
              href="/production/cutting"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors"
            >
              <SawBlade className="w-3.5 h-3.5" />
              Cutting
              {(stationCounts.find(s => s.stage === 'CUTTING')?.count ?? 0) > 0 && (
                <span className="bg-orange-100 text-orange-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'CUTTING')?.count}
                </span>
              )}
            </Link>
            <Link
              href="/production/milling"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 rounded transition-colors"
            >
              <DrillBit className="w-3.5 h-3.5" />
              Milling
              {(stationCounts.find(s => s.stage === 'MILLING')?.count ?? 0) > 0 && (
                <span className="bg-violet-100 text-violet-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'MILLING')?.count}
                </span>
              )}
            </Link>
            <Link
              href="/production/assembly"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              <Package className="w-3.5 h-3.5" />
              Assembly
              {(stationCounts.find(s => s.stage === 'ASSEMBLY')?.count ?? 0) > 0 && (
                <span className="bg-blue-100 text-blue-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'ASSEMBLY')?.count}
                </span>
              )}
            </Link>
            <Link
              href="/production/qc"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              QC
              {(stationCounts.find(s => s.stage === 'QC')?.count ?? 0) > 0 && (
                <span className="bg-purple-100 text-purple-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'QC')?.count}
                </span>
              )}
            </Link>
            <Link
              href="/production/shipping"
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
            >
              <Truck className="w-3.5 h-3.5" />
              Ship
              {(stationCounts.find(s => s.stage === 'SHIP')?.count ?? 0) > 0 && (
                <span className="bg-green-100 text-green-700 px-1 rounded text-[10px]">
                  {stationCounts.find(s => s.stage === 'SHIP')?.count}
                </span>
              )}
            </Link>
          </div>
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
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-28">Due Date</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-24">Batch Size</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
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
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    {/* Expand column */}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-28">
                    Due Date
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-24">
                    Batch Size
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Downloads
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((project) => (
                  <ExpandableProjectRow
                    key={project.id}
                    project={project}
                    isExpanded={expandedProjectIds.has(project.id)}
                    onToggleExpand={() => toggleExpand(project.id)}
                    onGenerateWorkOrders={generateWorkOrders}
                    isGeneratingWorkOrders={generatingWorkOrders.has(project.id)}
                  >
                    {/* Row content cells (without the first expand cell which is handled by ExpandableProjectRow) */}
                    <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap w-28">
                      {formatDate(project.dueDate)}
                    </td>
                    <td className="px-3 py-3 text-sm text-center w-24">
                      {project.workOrderProgress && project.workOrderProgress.total > 0 ? (
                        // Batch size locked once work orders exist
                        <span
                          className="px-2 py-1 text-gray-500 cursor-not-allowed"
                          title="Batch size cannot be changed after work orders are generated"
                        >
                          {project.batchSize || 'All'}
                        </span>
                      ) : editingBatchSize?.projectId === project.id ? (
                        <input
                          type="text"
                          value={editingBatchSize.value}
                          onChange={(e) => setEditingBatchSize({ projectId: project.id, value: e.target.value })}
                          onBlur={() => {
                            saveBatchSize(project.id, editingBatchSize.value)
                            setEditingBatchSize(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              saveBatchSize(project.id, editingBatchSize.value)
                              setEditingBatchSize(null)
                            } else if (e.key === 'Escape') {
                              setEditingBatchSize(null)
                            }
                          }}
                          autoFocus
                          className="w-14 px-2 py-1 text-sm text-center border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingBatchSize({
                            projectId: project.id,
                            value: project.batchSize?.toString() || ''
                          })}
                          className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          {project.batchSize || 'All'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900">
                          {project.name}
                        </div>
                        {project.version && project.version > 1 && (
                          <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                            V{project.version}
                          </span>
                        )}
                        <span className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs font-medium">
                          {project.openingsCount} {project.openingsCount === 1 ? 'opening' : 'openings'}
                        </span>
                        {/* Field Verification Indicator */}
                        {(project.fieldVerificationCount ?? 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-medium"
                            title={`${project.fieldVerificationCount} field verification photo${project.fieldVerificationCount !== 1 ? 's' : ''}`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {project.fieldVerificationCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{project.customerName}</div>
                    </td>
                    <td className="px-4 py-3">
                      {project.workOrderProgress && project.workOrderProgress.total > 0 ? (
                        <div className="flex items-center gap-1">
                          {/* Stage pills showing count per stage */}
                          {[
                            { key: 'STAGED', label: 'STG', icon: Boxes, color: 'bg-gray-400 text-white', progressColor: 'bg-gray-600' },
                            { key: 'CUTTING', label: 'CUT', icon: SawBlade, color: 'bg-orange-500 text-white', progressColor: 'bg-orange-700' },
                            { key: 'MILLING', label: 'MIL', icon: DrillBit, color: 'bg-violet-500 text-white', progressColor: 'bg-violet-700' },
                            { key: 'ASSEMBLY', label: 'ASM', icon: Package, color: 'bg-blue-500 text-white', progressColor: 'bg-blue-700' },
                            { key: 'QC', label: 'QC', icon: ClipboardCheck, color: 'bg-purple-500 text-white', progressColor: 'bg-purple-700' },
                            { key: 'SHIP', label: 'SHP', icon: Truck, color: 'bg-green-500 text-white', progressColor: 'bg-green-700' },
                            { key: 'COMPLETE', label: 'DONE', icon: CheckCircle2, color: 'bg-emerald-600 text-white', progressColor: 'bg-emerald-800' },
                          ].flatMap(stage => {
                            // Get work orders for this stage
                            const stageWorkOrders = project.workOrderProgress!.workOrders?.filter(
                              wo => wo.stage === stage.key
                            ) || []
                            if (stageWorkOrders.length === 0) return []
                            const IconComponent = stage.icon
                            return stageWorkOrders.map((wo) => (
                              <span
                                key={wo.id}
                                className={`relative inline-flex items-center gap-1 px-2 h-7 rounded-lg ${stage.color} overflow-hidden`}
                                title={`${stage.key}: ${wo.progressPercent}% complete`}
                              >
                                <IconComponent className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">{stage.label}</span>
                                {/* Progress bar at bottom */}
                                <span className="absolute bottom-0 left-0 h-[3px] bg-black/20 w-full">
                                  <span
                                    className={`absolute bottom-0 left-0 h-full ${stage.progressColor}`}
                                    style={{ width: `${wo.progressPercent}%` }}
                                  />
                                </span>
                              </span>
                            ))
                          })}
                          {/* Total */}
                          <span className="text-[10px] text-gray-400 ml-1">
                            /{project.workOrderProgress.total}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => generateWorkOrders(project.id)}
                          disabled={generatingWorkOrders.has(project.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {generatingWorkOrders.has(project.id) ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3 h-3" />
                              Generate Work Orders
                            </>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DownloadDropdown
                        projectId={project.id}
                        projectName={project.name}
                        batchSize={project.batchSize}
                      />
                    </td>
                  </ExpandableProjectRow>
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
          format={bomModalProject.format || bulkDownloadQueue?.bomFormat || 'csv'}
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
          defaultBatchSize={defaultBatchSize}
          format={cutListModalProjects[0]?.format || bulkDownloadQueue?.cutlistFormat || 'csv'}
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

      {/* Production Settings Modal */}
      {showSettingsModal && (
        <ProductionSettingsModal
          defaultBatchSize={defaultBatchSize}
          onSave={saveDefaultBatchSize}
          onClose={() => setShowSettingsModal(false)}
          loading={settingsLoading}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

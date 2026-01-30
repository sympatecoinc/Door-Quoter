'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Download, ChevronRight } from 'lucide-react'
import { useDownloadStore } from '@/stores/downloadStore'

interface UniqueComponent {
  hash: string
  productName: string
  width: number
  height: number
  finishColor: string
  glassType: string | null
  quantity: number
  hardware: string[]
}

interface BomDownloadModalProps {
  projectId: number
  projectName: string
  format?: 'csv' | 'pdf'  // Output format, defaults to 'csv'
  onClose: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
  // Configure mode - don't download, just pass selection back
  onConfigure?: (config: { projectId: number; projectName: string; selectedHashes: string[]; format?: 'csv' | 'pdf' }) => void
  hasMoreModals?: boolean  // If true, shows "Next" instead of "Finish"
}

export default function BomDownloadModal({
  projectId,
  projectName,
  format = 'csv',
  onClose,
  showError,
  showSuccess,
  onConfigure,
  hasMoreModals
}: BomDownloadModalProps) {
  console.log('[BomDownloadModal] Opened with format:', format, 'for project:', projectName)
  const [loading, setLoading] = useState(true)
  const [uniqueComponents, setUniqueComponents] = useState<UniqueComponent[]>([])
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const { startDownload, completeDownload, failDownload } = useDownloadStore()

  // Configure mode: don't download, just collect selections
  const isConfigureMode = !!onConfigure

  useEffect(() => {
    fetchUniqueBoms()
  }, [projectId])

  async function fetchUniqueBoms() {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/bom/csv?listOnly=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch BOM data')
      }
      const data = await response.json()
      const components = data.uniqueComponents || []
      setUniqueComponents(components)
      // Select all by default
      setSelectedHashes(new Set(components.map((c: UniqueComponent) => c.hash)))
    } catch (error) {
      console.error('Error fetching unique BOMs:', error)
      showError('Failed to load BOMs')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  function toggleComponent(hash: string) {
    const newSelected = new Set(selectedHashes)
    if (newSelected.has(hash)) {
      newSelected.delete(hash)
    } else {
      newSelected.add(hash)
    }
    setSelectedHashes(newSelected)
  }

  function selectAll() {
    setSelectedHashes(new Set(uniqueComponents.map(c => c.hash)))
  }

  function deselectAll() {
    setSelectedHashes(new Set())
  }

  async function handleAction() {
    if (selectedHashes.size === 0) {
      showError('Please select at least one BOM')
      return
    }

    // In configure mode, just pass the selection back
    if (isConfigureMode) {
      onConfigure({
        projectId,
        projectName,
        selectedHashes: Array.from(selectedHashes),
        format
      })
      return
    }

    // Direct download mode (when not in bulk/configure flow)
    // Start download tracking and close modal immediately
    const downloadId = startDownload({
      name: `BOMs (${format.toUpperCase()}) - ${projectName}`,
      type: 'bom'
    })
    onClose()

    try {
      const selectedParam = Array.from(selectedHashes).join('|')
      const url = `/api/projects/${projectId}/bom/csv?zip=true&unique=true&format=${format}&selected=${encodeURIComponent(selectedParam)}`
      console.log('[BomDownloadModal] Fetching URL:', url)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to download BOMs')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const defaultExt = format === 'pdf' ? 'pdf' : 'zip'
      let filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-boms.${defaultExt}`
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
      }

      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      completeDownload(downloadId)
    } catch (error) {
      console.error('Error downloading BOMs:', error)
      failDownload(downloadId, 'Failed to download BOMs')
    }
  }

  function getButtonText() {
    if (downloading) return null // Will show spinner
    if (isConfigureMode) {
      return hasMoreModals ? (
        <>
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Download All
        </>
      )
    }
    return (
      <>
        <Download className="w-4 h-4 mr-2" />
        Download ZIP
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900">
            Select BOMs to Download {format === 'pdf' ? '(PDF)' : '(CSV)'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Select the unique component BOMs you want to include{isConfigureMode ? '.' : ' in the ZIP download.'}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : uniqueComponents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No components found in this project.
          </div>
        ) : (
          <>
            {/* Select All / Deselect All */}
            <div className="flex items-center space-x-3 mb-4">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Deselect All
              </button>
            </div>

            {/* Checkbox List */}
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {uniqueComponents.map((component) => (
                <label
                  key={component.hash}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedHashes.has(component.hash)}
                    onChange={() => toggleComponent(component.hash)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">
                      {component.productName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {component.width}" × {component.height}" &bull; {component.finishColor} &bull; {component.glassType || 'None'} &bull; <span className="font-medium">×{component.quantity}</span>
                    </div>
                    {component.hardware && component.hardware.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Hardware: {component.hardware.join(', ')}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* Selection Count */}
            <div className="mt-3 text-sm text-gray-600">
              Selected: {selectedHashes.size} of {uniqueComponents.length}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAction}
            disabled={selectedHashes.size === 0 || loading || downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : getButtonText()}
          </button>
        </div>
      </div>
    </div>
  )
}

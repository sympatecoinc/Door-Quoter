'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Download } from 'lucide-react'

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
  onClose: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

export default function BomDownloadModal({
  projectId,
  projectName,
  onClose,
  showError,
  showSuccess
}: BomDownloadModalProps) {
  const [loading, setLoading] = useState(true)
  const [uniqueComponents, setUniqueComponents] = useState<UniqueComponent[]>([])
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

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

  async function handleDownload() {
    if (selectedHashes.size === 0) {
      showError('Please select at least one BOM')
      return
    }

    setDownloading(true)
    try {
      const selectedParam = Array.from(selectedHashes).join('|')
      const url = `/api/projects/${projectId}/bom/csv?zip=true&unique=true&selected=${encodeURIComponent(selectedParam)}`
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
      let filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-boms.zip`
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
      }

      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)

      showSuccess('BOMs downloaded successfully!')
      onClose()
    } catch (error) {
      console.error('Error downloading BOMs:', error)
      showError('Failed to download BOMs')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900">
            Select BOMs to Download
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Select the unique component BOMs you want to include in the ZIP download.
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
            onClick={handleDownload}
            disabled={selectedHashes.size === 0 || loading || downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download ZIP
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Download } from 'lucide-react'
import { useDownloadStore } from '@/stores/downloadStore'

interface OpeningInfo {
  id: number
  name: string
  totalWidth: number
  totalHeight: number
  panelCount: number
}

interface ShopDrawingsDownloadModalProps {
  projectId: number
  projectName: string
  onClose: () => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

export default function ShopDrawingsDownloadModal({
  projectId,
  projectName,
  onClose,
  showError,
  showSuccess
}: ShopDrawingsDownloadModalProps) {
  const [loading, setLoading] = useState(true)
  const [openings, setOpenings] = useState<OpeningInfo[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const { startDownload, completeDownload, failDownload } = useDownloadStore()

  useEffect(() => {
    fetchOpenings()
  }, [projectId])

  async function fetchOpenings() {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/shop-drawings?listOnly=true`)
      if (!response.ok) {
        throw new Error('Failed to fetch openings')
      }
      const data = await response.json()
      const openingsList = data.openings || []
      setOpenings(openingsList)
      // Select all by default
      setSelectedIds(new Set(openingsList.map((o: OpeningInfo) => o.id)))
    } catch (error) {
      console.error('Error fetching openings:', error)
      showError('Failed to load openings')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  function toggleOpening(id: number) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    setSelectedIds(new Set(openings.map(o => o.id)))
  }

  function deselectAll() {
    setSelectedIds(new Set())
  }

  async function handleDownload() {
    if (selectedIds.size === 0) {
      showError('Please select at least one opening')
      return
    }

    // Start download tracking and close modal immediately
    const downloadId = startDownload({
      name: `Shop Drawings - ${projectName}`,
      type: 'shop-drawings'
    })
    onClose()

    try {
      const selectedParam = Array.from(selectedIds).join('|')
      const url = `/api/projects/${projectId}/shop-drawings?zip=true&selected=${encodeURIComponent(selectedParam)}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to download shop drawings')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-shop-drawings.zip`
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
      console.error('Error downloading shop drawings:', error)
      failDownload(downloadId, 'Failed to download shop drawings')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900">
            Select Openings for Shop Drawings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Select the openings you want to include in the shop drawings ZIP download.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : openings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No openings found in this project.
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
              {openings.map((opening) => (
                <label
                  key={opening.id}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(opening.id)}
                    onChange={() => toggleOpening(opening.id)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="font-medium text-gray-900">
                      {opening.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {opening.totalWidth}" × {opening.totalHeight}" &bull; {opening.panelCount} panel{opening.panelCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Selection Count */}
            <div className="mt-3 text-sm text-gray-600">
              Selected: {selectedIds.size} of {openings.length}
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
            disabled={selectedIds.size === 0 || loading || downloading}
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

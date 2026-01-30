'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon, Check, CheckCircle2 } from 'lucide-react'

interface FieldVerificationUpload {
  id: number
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy: string | null
  imageUrl: string
  confirmed: boolean
  confirmedAt: string | null
  confirmedBy: string | null
}

interface FieldVerificationPreviewProps {
  projectId: number
  projectName: string
  onClose: () => void
  onConfirmStatusChange?: () => void
}

export default function FieldVerificationPreview({
  projectId,
  projectName,
  onClose,
  onConfirmStatusChange
}: FieldVerificationPreviewProps) {
  const [uploads, setUploads] = useState<FieldVerificationUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Track mount state for portal rendering (SSR safety)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    fetchUploads()
  }, [projectId])

  async function fetchUploads() {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/field-verification/uploads`)
      if (!response.ok) {
        throw new Error('Failed to fetch uploads')
      }
      const data = await response.json()
      setUploads(data.uploads)
    } catch (err) {
      setError('Failed to load verification photos')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function downloadImage(upload: FieldVerificationUpload) {
    setDownloading(true)
    try {
      const response = await fetch(upload.imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = upload.originalName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Failed to download image:', err)
    } finally {
      setDownloading(false)
    }
  }

  async function downloadAll() {
    setDownloading(true)
    try {
      // Download all images as individual files
      for (const upload of uploads) {
        await downloadImage(upload)
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } finally {
      setDownloading(false)
    }
  }

  async function confirmUpload(uploadId: number) {
    setConfirming(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/field-verification/uploads/${uploadId}/confirm`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to confirm upload')
      }
      // Refresh the uploads list
      await fetchUploads()
      // Notify parent of status change
      onConfirmStatusChange?.()
    } catch (err) {
      console.error('Failed to confirm upload:', err)
    } finally {
      setConfirming(false)
    }
  }

  async function confirmAllUploads() {
    setConfirming(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/field-verification/uploads/confirm-all`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error('Failed to confirm all uploads')
      }
      // Refresh the uploads list
      await fetchUploads()
      // Notify parent of status change
      onConfirmStatusChange?.()
    } catch (err) {
      console.error('Failed to confirm all uploads:', err)
    } finally {
      setConfirming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft' && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    } else if (e.key === 'ArrowRight' && selectedIndex < uploads.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const selectedUpload = uploads[selectedIndex]
  const unconfirmedCount = uploads.filter(u => !u.confirmed).length
  const allConfirmed = uploads.length > 0 && unconfirmedCount === 0

  // Don't render anything during SSR
  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Field Verification Photos</h2>
            <p className="text-sm text-gray-500">{projectName}</p>
          </div>
          <div className="flex items-center gap-2">
            {uploads.length > 0 && (
              <>
                {!allConfirmed && (
                  <button
                    onClick={confirmAllUploads}
                    disabled={confirming}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {confirming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirm All ({unconfirmedCount})
                  </button>
                )}
                {allConfirmed && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    All Confirmed
                  </span>
                )}
                <button
                  onClick={downloadAll}
                  disabled={downloading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download All
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-red-500">
              {error}
            </div>
          ) : uploads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <ImageIcon className="w-12 h-12 mb-2 text-gray-300" />
              <p>No verification photos uploaded</p>
            </div>
          ) : (
            <>
              {/* Main image viewer */}
              <div className="flex-1 relative bg-gray-900 flex items-center justify-center min-h-[400px]">
                {/* Navigation arrows */}
                {uploads.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                      className="absolute left-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full disabled:opacity-30 transition-all z-10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => setSelectedIndex(Math.min(uploads.length - 1, selectedIndex + 1))}
                      disabled={selectedIndex === uploads.length - 1}
                      className="absolute right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full disabled:opacity-30 transition-all z-10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </>
                )}

                {/* Confirmed badge overlay */}
                {selectedUpload?.confirmed && (
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-full text-sm font-medium shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmed
                  </div>
                )}

                {/* Image */}
                {selectedUpload && (
                  <img
                    src={selectedUpload.imageUrl}
                    alt={selectedUpload.originalName}
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                )}

                {/* Image counter */}
                {uploads.length > 1 && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black bg-opacity-50 text-white text-sm rounded-full">
                    {selectedIndex + 1} / {uploads.length}
                  </div>
                )}
              </div>

              {/* Thumbnail strip and info */}
              <div className="p-4 border-t border-gray-200">
                {/* Selected image info */}
                {selectedUpload && (
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{selectedUpload.originalName}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span>{formatFileSize(selectedUpload.size)}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span>{formatDate(selectedUpload.uploadedAt)}</span>
                      {selectedUpload.confirmed && selectedUpload.confirmedAt && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="text-green-600">Confirmed {formatDate(selectedUpload.confirmedAt)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!selectedUpload.confirmed && (
                        <button
                          onClick={() => confirmUpload(selectedUpload.id)}
                          disabled={confirming}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {confirming ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Confirm
                        </button>
                      )}
                      <button
                        onClick={() => downloadImage(selectedUpload)}
                        disabled={downloading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                {uploads.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {uploads.map((upload, index) => (
                      <button
                        key={upload.id}
                        onClick={() => setSelectedIndex(index)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedIndex
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={upload.imageUrl}
                          alt={upload.originalName}
                          className="w-full h-full object-cover"
                        />
                        {/* Confirmed indicator on thumbnail */}
                        {upload.confirmed && (
                          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {/* Pending indicator on thumbnail */}
                        {!upload.confirmed && (
                          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-amber-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

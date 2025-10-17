'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, X, FileText, Image as ImageIcon, FileUp, GripVertical, Eye } from 'lucide-react'

interface QuoteAttachment {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  type: string
  displayOrder: number
  description: string | null
  createdAt: string
  updatedAt: string
}

interface QuoteAttachmentsManagerProps {
  projectId: number
  onAttachmentsChange?: () => void
}

export default function QuoteAttachmentsManager({ projectId, onAttachmentsChange }: QuoteAttachmentsManagerProps) {
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<QuoteAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAttachments()
  }, [projectId])

  const fetchAttachments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/quote-attachments`)

      if (response.ok) {
        const data = await response.json()
        setAttachments(data.attachments || [])
      }
    } catch (error) {
      console.error('Error fetching attachments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'custom')

        const response = await fetch(`/api/projects/${projectId}/quote-attachments`, {
          method: 'POST',
          body: formData
        })

        if (!response.ok) {
          const error = await response.json()
          alert(`Error uploading ${file.name}: ${error.error}`)
        }
      }

      // Refresh attachments list
      await fetchAttachments()

      // Notify parent component
      if (onAttachmentsChange) {
        onAttachmentsChange()
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Error uploading files')
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (attachmentId: number) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/quote-attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        await fetchAttachments()

        if (onAttachmentsChange) {
          onAttachmentsChange()
        }
      } else {
        alert('Error deleting attachment')
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
      alert('Error deleting attachment')
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-blue-600" />
    }
    return <FileText className="w-5 h-5 text-red-600" />
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quote Attachments</h3>
          <p className="text-sm text-gray-600">Add spec sheets, photos, or other documents to include in the quote PDF</p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="text-center">
          <FileUp className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <div className="mb-2">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                Click to upload
              </span>
              <span className="text-gray-600"> or drag and drop</span>
            </label>
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              className="hidden"
              multiple
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
            />
          </div>
          <p className="text-xs text-gray-500">
            PNG, JPG, or PDF (Max 10MB per file)
          </p>
          {uploading && (
            <div className="mt-3 flex items-center justify-center text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            Attached Files ({attachments.length})
          </h4>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-shrink-0">
                  {getFileIcon(attachment.mimeType)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(attachment.size)} • {attachment.type}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {attachment.mimeType.startsWith('image/') && (
                    <button
                      onClick={() => setPreviewAttachment(attachment)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-white rounded transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-white rounded transition-colors"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachments.length === 0 && !uploading && (
        <div className="text-center py-6 text-gray-500 text-sm">
          No attachments yet. Upload files to include them in your quote PDF.
        </div>
      )}

      {/* Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {previewAttachment.originalName}
              </h3>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={`/uploads/quote-attachments/${projectId}/${previewAttachment.filename}`}
              alt={previewAttachment.originalName}
              className="max-w-full h-auto"
            />
          </div>
        </div>
      )}
    </div>
  )
}

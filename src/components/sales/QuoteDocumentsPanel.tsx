'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronDown, ChevronUp, FileText, Upload, Trash2,
  Image as ImageIcon, File, RefreshCw, X, GripVertical
} from 'lucide-react'

interface QuoteAttachment {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  type: string
  displayOrder: number
  position: string
  description: string | null
  createdAt: string
}

interface QuoteDocumentsPanelProps {
  projectId: number
  onDocumentsChanged?: () => void
}

const POSITION_OPTIONS = [
  { value: 'beginning', label: 'Before Quote' },
  { value: 'after_quote', label: 'After Quote' },
  { value: 'end', label: 'End of PDF' },
]

export default function QuoteDocumentsPanel({ projectId, onDocumentsChanged }: QuoteDocumentsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchAttachments = useCallback(async () => {
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
  }, [projectId])

  useEffect(() => {
    if (isExpanded) {
      fetchAttachments()
    }
  }, [fetchAttachments, isExpanded])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Only PDF, PNG, and JPG files are allowed.')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.')
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'custom')
      formData.append('position', 'after_quote')

      const response = await fetch(`/api/projects/${projectId}/quote-attachments`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        await fetchAttachments()
        onDocumentsChanged?.()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Failed to upload document')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (attachmentId: number, name: string) => {
    if (!confirm(`Delete "${name}" from this quote?`)) return

    try {
      const response = await fetch(
        `/api/projects/${projectId}/quote-attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        await fetchAttachments()
        onDocumentsChanged?.()
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document')
    }
  }

  const handlePositionChange = async (attachmentId: number, position: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/quote-attachments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: attachmentId, position }),
      })

      if (response.ok) {
        setAttachments(prev =>
          prev.map(a => a.id === attachmentId ? { ...a, position } : a)
        )
        onDocumentsChanged?.()
      }
    } catch (error) {
      console.error('Error updating position:', error)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4 text-blue-600" />
    }
    return <File className="w-4 h-4 text-red-600" />
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">Quote Documents</span>
          {!isExpanded && attachments.length > 0 && (
            <span className="text-sm text-gray-500 ml-2">
              ({attachments.length} custom document{attachments.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {loading ? (
            <div className="py-4 text-center text-gray-500">Loading documents...</div>
          ) : (
            <div className="pt-4 space-y-3">
              {/* Upload Button */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Add Document
                    </>
                  )}
                </button>
                <span className="text-xs text-gray-500">PDF, PNG, or JPG (max 10MB)</span>
              </div>

              {/* Documents List */}
              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0">
                        {getFileIcon(attachment.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <select
                        value={attachment.position}
                        onChange={(e) => handlePositionChange(attachment.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {POSITION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleDelete(attachment.id, attachment.originalName)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No custom documents added</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add PDFs or images to include in this quote
                  </p>
                </div>
              )}

              {/* Info about global documents */}
              <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                Global documents are automatically included in all quotes.
                Add custom documents here for this specific quote.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

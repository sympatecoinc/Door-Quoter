'use client'

import { useState, useRef } from 'react'
import { X, Upload, FileUp } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface ProductDocumentUploadModalProps {
  productId: number
  productName: string
  onClose: () => void
  onUploadComplete: () => void
}

const categoryOptions = [
  { value: 'spec_sheet', label: 'Specification Sheet' },
  { value: 'brochure', label: 'Brochure' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'installation', label: 'Installation Instructions' },
  { value: 'general', label: 'General' },
]

export default function ProductDocumentUploadModal({
  productId,
  productName,
  onClose,
  onUploadComplete,
}: ProductDocumentUploadModalProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen: true, isBlocked: uploading, onClose: onClose },
  ])

  const handleFileSelect = (file: File) => {
    // Only accept PDFs
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setSelectedFile(file)
    if (!formData.name) {
      // Auto-populate name from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
      setFormData(prev => ({ ...prev, name: nameWithoutExt }))
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedFile) {
      alert('Please select a PDF file to upload')
      return
    }

    if (!formData.name.trim()) {
      alert('Please enter a document name')
      return
    }

    setUploading(true)

    try {
      // Step 1: Upload the document as non-global
      const uploadFormData = new FormData()
      uploadFormData.append('file', selectedFile)
      uploadFormData.append('name', formData.name.trim())
      uploadFormData.append('description', '')
      uploadFormData.append('category', formData.category)
      uploadFormData.append('isGlobal', 'false')
      uploadFormData.append('displayOrder', '0')

      const uploadResponse = await fetch('/api/quote-documents', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      const uploadResult = await uploadResponse.json()
      const documentId = uploadResult.document.id

      // Step 2: Associate the document with the product
      const associateResponse = await fetch(`/api/products/${productId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteDocumentId: documentId }),
      })

      if (!associateResponse.ok) {
        const error = await associateResponse.json()
        throw new Error(error.error || 'Failed to associate document with product')
      }

      // Success
      onUploadComplete()
      onClose()
    } catch (error) {
      console.error('Error uploading document:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Upload Product Document</h2>
            <p className="text-sm text-gray-600 mt-1">For: {productName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={uploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Upload Area */}
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
                  accept="application/pdf"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                />
              </div>
              <p className="text-xs text-gray-500">
                PDF only (Max 10MB)
              </p>
              {selectedFile && (
                <div className="mt-3 text-sm text-blue-600 font-medium">
                  Selected: {selectedFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Document Name */}
          <div>
            <label htmlFor="doc-name" className="block text-sm font-medium text-gray-700 mb-1">
              Document Title *
            </label>
            <input
              id="doc-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter document title"
              required
              disabled={uploading}
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="doc-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              id="doc-category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

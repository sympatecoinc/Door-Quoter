'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileUp, X } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface Product {
  id: number
  name: string
}

interface DocumentUploadProps {
  onUploadComplete: () => void
  isOpen: boolean
  onClose: () => void
}

const categoryOptions = [
  { value: 'spec_sheet', label: 'Specification Sheet' },
  { value: 'brochure', label: 'Brochure' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'installation', label: 'Installation Instructions' },
  { value: 'general', label: 'General' },
  { value: 'product', label: 'Product' },
]

export default function DocumentUpload({ onUploadComplete, isOpen, onClose }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    isGlobal: true,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen: isOpen, isBlocked: uploading, onClose: onClose },
  ])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products')
        if (response.ok) {
          const data = await response.json()
          setProducts(data)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      }
    }
    if (isOpen) {
      fetchProducts()
    }
  }, [isOpen])

  const handleFileSelect = (file: File) => {
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
      alert('Please select a file to upload')
      return
    }

    if (!formData.name.trim()) {
      alert('Please enter a document name')
      return
    }

    setUploading(true)

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', selectedFile)
      uploadFormData.append('name', formData.name.trim())
      uploadFormData.append('description', formData.description.trim())
      uploadFormData.append('category', formData.category)
      // If product category is selected, force isGlobal to false
      const isGlobalValue = formData.category === 'product' ? false : formData.isGlobal
      uploadFormData.append('isGlobal', isGlobalValue.toString())
      uploadFormData.append('displayOrder', '0')
      if (formData.category === 'product' && selectedProductId) {
        uploadFormData.append('productId', selectedProductId.toString())
      }

      const response = await fetch('/api/quote-documents', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload document')
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'general',
        isGlobal: true,
      })
      setSelectedFile(null)
      setSelectedProductId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Notify parent and close modal
      onUploadComplete()
      onClose()
    } catch (error) {
      console.error('Error uploading document:', error)
      alert(error instanceof Error ? error.message : 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Upload New Document</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
                accept="application/pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileInputChange}
                disabled={uploading}
              />
            </div>
            <p className="text-xs text-gray-500">
              PDF, PNG, or JPG (Max 10MB)
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
            Document Name *
          </label>
          <input
            id="doc-name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter document name"
            required
            disabled={uploading}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="doc-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            id="doc-description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter document description"
            rows={3}
            disabled={uploading}
          />
        </div>

        {/* Category */}
        <div>
          <label htmlFor="doc-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="doc-category"
            value={formData.category}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, category: e.target.value }))
              // Reset product selection when changing away from product category
              if (e.target.value !== 'product') {
                setSelectedProductId(null)
              }
            }}
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

        {/* Product Selector - Only shown when category is 'product' */}
        {formData.category === 'product' && (
          <div>
            <label htmlFor="doc-product" className="block text-sm font-medium text-gray-700 mb-1">
              Select Product *
            </label>
            <select
              id="doc-product"
              value={selectedProductId || ''}
              onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
              required
            >
              <option value="">Select a product...</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Global Document Checkbox - Hidden when category is 'product' */}
        {formData.category !== 'product' && (
          <div className="flex items-center">
            <input
              id="doc-global"
              type="checkbox"
              checked={formData.isGlobal}
              onChange={(e) => setFormData(prev => ({ ...prev, isGlobal: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={uploading}
            />
            <label htmlFor="doc-global" className="ml-2 text-sm text-gray-700">
              Include in all quotes (Global Document)
            </label>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || !selectedFile}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </>
          )}
        </button>
      </form>
      </div>
    </div>
  )
}

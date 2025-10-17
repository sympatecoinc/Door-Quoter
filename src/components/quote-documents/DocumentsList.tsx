'use client'

import { useState } from 'react'
import { FileText, ImageIcon, Edit2, Trash2, Download, Globe, Package, Eye, X } from 'lucide-react'

interface Product {
  id: number
  name: string
}

interface ProductDocument {
  product: Product
}

interface QuoteDocument {
  id: number
  name: string
  description: string | null
  filename: string
  originalName: string
  mimeType: string
  size: number
  category: string
  isGlobal: boolean
  displayOrder: number
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
  productDocuments?: ProductDocument[]
}

interface DocumentsListProps {
  documents: QuoteDocument[]
  onDocumentsChange: () => void
}

const categoryLabels: Record<string, string> = {
  spec_sheet: 'Specification Sheet',
  brochure: 'Brochure',
  warranty: 'Warranty',
  installation: 'Installation Instructions',
  general: 'General',
}

export default function DocumentsList({ documents, onDocumentsChange }: DocumentsListProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: '',
    isGlobal: true,
  })
  const [previewDoc, setPreviewDoc] = useState<QuoteDocument | null>(null)

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

  const handleEdit = (doc: QuoteDocument) => {
    setEditingId(doc.id)
    setEditForm({
      name: doc.name,
      description: doc.description || '',
      category: doc.category,
      isGlobal: doc.isGlobal,
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({ name: '', description: '', category: '', isGlobal: true })
  }

  const handleSaveEdit = async (docId: number) => {
    try {
      const response = await fetch(`/api/quote-documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error('Failed to update document')
      }

      setEditingId(null)
      onDocumentsChange()
    } catch (error) {
      console.error('Error updating document:', error)
      alert('Failed to update document')
    }
  }

  const handleDelete = async (docId: number, docName: string) => {
    if (!confirm(`Are you sure you want to delete "${docName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/quote-documents/${docId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      onDocumentsChange()
    } catch (error) {
      console.error('Error deleting document:', error)
      alert('Failed to delete document')
    }
  }

  const handleDownload = async (doc: QuoteDocument) => {
    try {
      const response = await fetch(`/api/quote-documents/${doc.id}/download`)

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Failed to download document')
    }
  }

  const handlePreview = (doc: QuoteDocument) => {
    if (doc.mimeType.startsWith('image/')) {
      setPreviewDoc(doc)
    }
  }

  if (documents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 text-center">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500">No documents uploaded yet.</p>
        <p className="text-sm text-gray-400 mt-1">Upload a document to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Documents ({documents.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 hover:bg-gray-50 transition-colors">
              {editingId === doc.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Document name"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description"
                    rows={2}
                  />
                  <div className="flex items-center gap-4">
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isGlobal}
                        onChange={(e) => setEditForm(prev => ({ ...prev, isGlobal: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Global</span>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(doc.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getFileIcon(doc.mimeType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-gray-900">
                          {doc.name}
                        </h4>
                        {doc.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{categoryLabels[doc.category] || doc.category}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.size)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {doc.isGlobal ? (
                              <>
                                <Globe className="w-3 h-3" />
                                Global
                              </>
                            ) : (
                              <>
                                <Package className="w-3 h-3" />
                                Product-Specific
                              </>
                            )}
                          </span>
                          {doc.productDocuments && doc.productDocuments.length > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {doc.productDocuments.length} product{doc.productDocuments.length !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {doc.mimeType.startsWith('image/') && (
                          <button
                            onClick={() => handlePreview(doc)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(doc)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.name)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {previewDoc.name}
              </h3>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={`/uploads/quote-documents/${previewDoc.id}/${previewDoc.filename}`}
              alt={previewDoc.name}
              className="max-w-full h-auto"
            />
          </div>
        </div>
      )}
    </>
  )
}

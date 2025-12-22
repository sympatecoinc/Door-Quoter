'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus } from 'lucide-react'
import DocumentUpload from '../quote-documents/DocumentUpload'
import DocumentsList from '../quote-documents/DocumentsList'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

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
  productDocuments?: any[]
}

export default function QuoteDocumentsView() {
  const [documents, setDocuments] = useState<QuoteDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Cmd+N to upload new document
  useNewShortcut(() => setUploadModalOpen(true), { disabled: uploadModalOpen })

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/quote-documents')

      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Quote Documents</h1>
          </div>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Document
          </button>
        </div>
        <p className="text-gray-600">
          Manage persistent documents that can be included in quotes. Global documents are included in all quotes, while product-specific documents are included only when those products are used.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <DocumentsList
          documents={documents}
          onDocumentsChange={fetchDocuments}
        />
      )}

      {/* Upload Modal */}
      <DocumentUpload
        onUploadComplete={fetchDocuments}
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
    </div>
  )
}

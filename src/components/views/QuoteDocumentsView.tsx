'use client'

import { useState, useEffect } from 'react'
import { FileText } from 'lucide-react'
import DocumentUpload from '../quote-documents/DocumentUpload'
import DocumentsList from '../quote-documents/DocumentsList'
import ProductAssociations from '../quote-documents/ProductAssociations'

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
  const [activeTab, setActiveTab] = useState<'all' | 'global' | 'products'>('all')

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

  const globalDocuments = documents.filter(d => d.isGlobal)
  const productDocuments = documents.filter(d => !d.isGlobal)

  const getDisplayedDocuments = () => {
    switch (activeTab) {
      case 'global':
        return globalDocuments
      case 'products':
        return productDocuments
      default:
        return documents
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Quote Documents</h1>
        </div>
        <p className="text-gray-600">
          Manage persistent documents that can be included in quotes. Global documents are included in all quotes, while product-specific documents are included only when those products are used.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Documents ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'global'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Global Documents ({globalDocuments.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Product-Specific ({productDocuments.length})
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Upload & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <DocumentUpload onUploadComplete={fetchDocuments} />

            {/* Documents List */}
            <DocumentsList
              documents={getDisplayedDocuments()}
              onDocumentsChange={fetchDocuments}
            />
          </div>

          {/* Right Column: Product Associations */}
          <div className="lg:col-span-1">
            <ProductAssociations
              documents={documents}
              onAssociationsChange={fetchDocuments}
            />
          </div>
        </div>
      )}
    </div>
  )
}

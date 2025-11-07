'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Package } from 'lucide-react'

interface Product {
  id: number
  name: string
  type: string
}

interface QuoteDocument {
  id: number
  name: string
  category: string
}

interface ProductAssociationsProps {
  documents: QuoteDocument[]
  onAssociationsChange: () => void
}

export default function ProductAssociations({ documents, onAssociationsChange }: ProductAssociationsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [productDocuments, setProductDocuments] = useState<QuoteDocument[]>([])
  const [availableDocuments, setAvailableDocuments] = useState<QuoteDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (selectedProductId) {
      fetchProductDocuments(selectedProductId)
    } else {
      setProductDocuments([])
      setAvailableDocuments(documents)
    }
  }, [selectedProductId, documents])

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

  const fetchProductDocuments = async (productId: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/documents`)
      if (response.ok) {
        const data = await response.json()
        setProductDocuments(data.documents || [])

        // Calculate available documents (not yet associated)
        const associatedIds = new Set((data.documents || []).map((d: QuoteDocument) => d.id))
        const available = documents.filter(d => !associatedIds.has(d.id))
        setAvailableDocuments(available)
      }
    } catch (error) {
      console.error('Error fetching product documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAssociation = async (documentId: number) => {
    if (!selectedProductId) return

    try {
      setAdding(true)
      const response = await fetch(`/api/products/${selectedProductId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteDocumentId: documentId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add association')
      }

      // Refresh product documents
      await fetchProductDocuments(selectedProductId)
      onAssociationsChange()
    } catch (error) {
      console.error('Error adding association:', error)
      alert(error instanceof Error ? error.message : 'Failed to add association')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveAssociation = async (documentId: number) => {
    if (!selectedProductId) return

    if (!confirm('Remove this document from the product?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/products/${selectedProductId}/documents?quoteDocumentId=${documentId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to remove association')
      }

      // Refresh product documents
      await fetchProductDocuments(selectedProductId)
      onAssociationsChange()
    } catch (error) {
      console.error('Error removing association:', error)
      alert('Failed to remove association')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Associations</h3>
      <p className="text-sm text-gray-600 mb-4">
        Associate documents with specific products. These documents will automatically be included in quotes when the product is used.
      </p>

      {/* Product Selector */}
      <div className="mb-6">
        <label htmlFor="product-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Product
        </label>
        <select
          id="product-select"
          value={selectedProductId || ''}
          onChange={(e) => setSelectedProductId(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select a product --</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.type})
            </option>
          ))}
        </select>
      </div>

      {selectedProductId && (
        <>
          {/* Associated Documents */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Associated Documents ({productDocuments.length})
            </h4>
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : productDocuments.length > 0 ? (
              <div className="space-y-2">
                {productDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                      <span className="text-xs text-gray-500">({doc.category})</span>
                    </div>
                    <button
                      onClick={() => handleRemoveAssociation(doc.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Remove association"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">
                No documents associated with this product yet.
              </p>
            )}
          </div>

          {/* Available Documents to Add */}
          {availableDocuments.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Add Document
              </h4>
              <div className="space-y-2">
                {availableDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({doc.category})</span>
                    </div>
                    <button
                      onClick={() => handleAddAssociation(doc.id)}
                      disabled={adding}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                      title="Add association"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!selectedProductId && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Select a product to manage its associated documents
        </div>
      )}
    </div>
  )
}

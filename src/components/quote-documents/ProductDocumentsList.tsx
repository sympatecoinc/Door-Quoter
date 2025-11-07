'use client'

import { useState, useEffect } from 'react'
import { Upload, Package, FileText, Trash2, Eye, X } from 'lucide-react'
import ProductDocumentUploadModal from './ProductDocumentUploadModal'

interface Product {
  id: number
  name: string
  type: string
}

interface QuoteDocument {
  id: number
  name: string
  category: string
  filename: string
  originalName: string
  mimeType: string
}

interface ProductDocumentsListProps {
  onDocumentsChange: () => void
}

export default function ProductDocumentsList({ onDocumentsChange }: ProductDocumentsListProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [productDocuments, setProductDocuments] = useState<Record<number, QuoteDocument[]>>({})
  const [loading, setLoading] = useState(true)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [previewDoc, setPreviewDoc] = useState<QuoteDocument | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)

        // Fetch documents for all products
        const docsMap: Record<number, QuoteDocument[]> = {}
        await Promise.all(
          data.map(async (product: Product) => {
            const docsResponse = await fetch(`/api/products/${product.id}/documents`)
            if (docsResponse.ok) {
              const docsData = await docsResponse.json()
              docsMap[product.id] = docsData.documents || []
            } else {
              docsMap[product.id] = []
            }
          })
        )
        setProductDocuments(docsMap)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadClick = (product: Product) => {
    setSelectedProduct(product)
    setUploadModalOpen(true)
  }

  const handleUploadComplete = async () => {
    await fetchProducts()
    onDocumentsChange()
  }

  const handleRemoveDocument = async (productId: number, documentId: number, documentName: string) => {
    if (!confirm(`Remove "${documentName}" from this product?`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/products/${productId}/documents?quoteDocumentId=${documentId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to remove document')
      }

      await fetchProducts()
      onDocumentsChange()
    } catch (error) {
      console.error('Error removing document:', error)
      alert('Failed to remove document')
    }
  }

  const toggleProductExpansion = (productId: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId)
    } else {
      newExpanded.add(productId)
    }
    setExpandedProducts(newExpanded)
  }

  const handlePreview = (doc: QuoteDocument) => {
    setPreviewDoc(doc)
    document.body.style.overflow = 'hidden'
  }

  const closePreview = () => {
    setPreviewDoc(null)
    document.body.style.overflow = 'unset'
  }

  useEffect(() => {
    // Cleanup: restore scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Products</h3>
          <p className="text-sm text-gray-600 mt-1">
            Upload documents for specific products. These will be included in quotes when the product is used.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {products.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No products found. Create products in the Products view first.
            </div>
          ) : (
            products.map((product) => {
              const docs = productDocuments[product.id] || []
              const isExpanded = expandedProducts.has(product.id)

              return (
                <div key={product.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <Package className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <p className="text-sm text-gray-500">{product.type}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {docs.length} document{docs.length !== 1 ? 's' : ''}
                        </span>
                        {docs.length > 0 && (
                          <button
                            onClick={() => toggleProductExpansion(product.id)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUploadClick(product)}
                      className="ml-4 p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded transition-colors"
                      title="Upload document"
                    >
                      <Upload className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Documents List */}
                  {isExpanded && docs.length > 0 && (
                    <div className="mt-4 ml-8 space-y-2">
                      {docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-900">{doc.name}</span>
                            <span className="text-xs text-gray-500">({doc.category})</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handlePreview(doc)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Preview document"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveDocument(product.id, doc.id, doc.name)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                              title="Remove document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModalOpen && selectedProduct && (
        <ProductDocumentUploadModal
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          onClose={() => setUploadModalOpen(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-hidden"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-lg w-[95vw] h-[95vh] overflow-auto p-6 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {previewDoc.name}
              </h3>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {previewDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={`/uploads/quote-documents/${previewDoc.id}/${previewDoc.filename}`}
                  className="w-full h-full border-0"
                  title={previewDoc.name}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    src={`/uploads/quote-documents/${previewDoc.id}/${previewDoc.filename}`}
                    alt={previewDoc.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

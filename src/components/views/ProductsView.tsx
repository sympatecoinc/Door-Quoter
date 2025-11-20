'use client'

import { useState, useEffect } from 'react'
import { Plus, Package, Tag, Settings, Edit2, Trash2, Save, X, Copy } from 'lucide-react'
import ProductDetailView from './ProductDetailView'
import CategoryDetailView from './CategoryDetailView'

interface Product {
  id: number
  name: string
  description?: string
  type: string
  productType: string
  archived: boolean
  withTrim: string
  installationPrice?: number
  _count: {
    productBOMs: number
    productSubOptions: number
  }
  createdAt: string
}

interface Category {
  id: number
  name: string
  description?: string
  _count: {
    individualOptions: number
    productSubOptions: number
  }
  individualOptions: IndividualOption[]
}

interface IndividualOption {
  id: number
  categoryId: number
  name: string
  description?: string
  price: number
  category?: {
    name: string
  }
}


export default function ProductsView() {
  const [activeTab, setActiveTab] = useState('products')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  // Product editing state
  const [editingProduct, setEditingProduct] = useState<number | null>(null)
  const [editProductName, setEditProductName] = useState('')
  const [editProductDescription, setEditProductDescription] = useState('')
  const [editProductInstallationPrice, setEditProductInstallationPrice] = useState('0')
  const [updating, setUpdating] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState<{product: Product, projects: string[]} | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    loadData()
  }, [showArchived]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    try {
      await fetchProducts()
    } finally {
      setLoading(false)
    }
  }

  async function fetchProducts() {
    try {
      const url = showArchived ? '/api/products?includeArchived=true' : '/api/products'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }


  function startEditProduct(product: Product) {
    setEditingProduct(product.id)
    setEditProductName(product.name)
    setEditProductDescription(product.description || '')
    setEditProductInstallationPrice((product.installationPrice || 0).toString())
  }

  function cancelEditProduct() {
    setEditingProduct(null)
    setEditProductName('')
    setEditProductDescription('')
    setEditProductInstallationPrice('0')
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!editProductName.trim() || !editingProduct) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/products/${editingProduct}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProductName,
          description: editProductDescription,
          installationPrice: parseFloat(editProductInstallationPrice) || 0
        })
      })

      if (response.ok) {
        setEditingProduct(null)
        setEditProductName('')
        setEditProductDescription('')
        setEditProductInstallationPrice('0')
        fetchProducts()
      }
    } catch (error) {
      console.error('Error updating product:', error)
    } finally {
      setUpdating(false)
    }
  }

  function handleDeleteProduct(product: Product) {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) return

    // Async operation wrapped in promise
    (async () => {
      try {
        const response = await fetch(`/api/products/${product.id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          fetchProducts()
          // If we're currently viewing this product, go back to list
          if (selectedProduct?.id === product.id) {
            setSelectedProduct(null)
          }
        } else {
          const errorData = await response.json()
          if (errorData.canArchive) {
            setShowArchiveDialog({
              product: product,
              projects: errorData.usedInProjects
            })
          } else {
            alert(errorData.message || 'Failed to delete product')
          }
        }
      } catch (error) {
        console.error('Error deleting product:', error)
        alert('Error deleting product')
      }
    })()
  }

  async function handleArchiveProduct(product: Product) {
    try {
      const response = await fetch(`/api/products/${product.id}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: true })
      })

      if (response.ok) {
        setShowArchiveDialog(null)
        fetchProducts()
        // If we're currently viewing this product, go back to list
        if (selectedProduct?.id === product.id) {
          setSelectedProduct(null)
        }
      }
    } catch (error) {
      console.error('Error archiving product:', error)
      alert('Error archiving product')
    }
  }

  async function handleDuplicateProduct(product: Product) {
    if (!confirm(`Duplicate product "${product.name}"?`)) return
    
    try {
      const response = await fetch(`/api/products/${product.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        fetchProducts()
      } else {
        const errorData = await response.json()
        alert(errorData.message || 'Failed to duplicate product')
      }
    } catch (error) {
      console.error('Error duplicating product:', error)
      alert('Error duplicating product')
    }
  }

  const tabs = [
    { id: 'products', label: 'Products', icon: Package },
  ]

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage product catalog and configurations</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Product
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'products' && (
              selectedProduct ? (
                <ProductDetailView
                  product={selectedProduct}
                  categories={[]}
                  productBOMs={[]}
                  onBack={() => setSelectedProduct(null)}
                  onRefresh={loadData}
                  onEdit={startEditProduct}
                  onDelete={handleDeleteProduct}
                />
              ) : (
                <ProductsTab
                  products={products}
                  onRefresh={fetchProducts}
                  onSelectProduct={setSelectedProduct}
                  editingProduct={editingProduct}
                  editProductName={editProductName}
                  editProductDescription={editProductDescription}
                  editProductInstallationPrice={editProductInstallationPrice}
                  updating={updating}
                  onStartEdit={startEditProduct}
                  onCancelEdit={cancelEditProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onDuplicateProduct={handleDuplicateProduct}
                  setEditProductName={setEditProductName}
                  setEditProductDescription={setEditProductDescription}
                  setEditProductInstallationPrice={setEditProductInstallationPrice}
                  showCreateForm={showCreateForm}
                  setShowCreateForm={setShowCreateForm}
                  showArchived={showArchived}
                  setShowArchived={setShowArchived}
                />
              )
            )}
          </>
        )}
      </div>

      {/* Archive Dialog Modal */}
      {showArchiveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cannot Delete Product</h2>
            <div className="space-y-4">
              <p className="text-gray-700">
                The product "{showArchiveDialog.product.name}" is currently used in the following project(s):
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                {showArchiveDialog.projects.map((project, index) => (
                  <li key={index}>{project}</li>
                ))}
              </ul>
              <p className="text-gray-700">
                You can archive this product instead. This will:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Keep the product available in existing projects</li>
                <li>Hide it from new product selections</li>
                <li>Preserve all project references</li>
              </ul>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowArchiveDialog(null)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleArchiveProduct(showArchiveDialog.product)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Archive Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductsTab({
  products,
  onRefresh,
  onSelectProduct,
  editingProduct,
  editProductName,
  editProductDescription,
  editProductInstallationPrice,
  updating,
  onStartEdit,
  onCancelEdit,
  onUpdateProduct,
  onDeleteProduct,
  onDuplicateProduct,
  setEditProductName,
  setEditProductDescription,
  setEditProductInstallationPrice,
  showCreateForm,
  setShowCreateForm,
  showArchived,
  setShowArchived
}: {
  products: Product[],
  onRefresh: () => void,
  onSelectProduct: (product: Product) => void,
  editingProduct: number | null,
  editProductName: string,
  editProductDescription: string,
  editProductInstallationPrice: string,
  updating: boolean,
  onStartEdit: (product: Product) => void,
  onCancelEdit: () => void,
  onUpdateProduct: (e: React.FormEvent) => void,
  onDeleteProduct: (product: Product) => void,
  onDuplicateProduct: (product: Product) => void,
  setEditProductName: (name: string) => void,
  setEditProductDescription: (description: string) => void,
  setEditProductInstallationPrice: (price: string) => void,
  showCreateForm: boolean,
  setShowCreateForm: (show: boolean) => void,
  showArchived: boolean,
  setShowArchived: (show: boolean) => void
}) {
  const [newProductName, setNewProductName] = useState('')
  const [newProductDescription, setNewProductDescription] = useState('')
  const [newProductType, setNewProductType] = useState('SWING_DOOR')
  const [newProductWithTrim, setNewProductWithTrim] = useState('Without Trim')
  const [newProductInstallationPrice, setNewProductInstallationPrice] = useState(0)
  const [creating, setCreating] = useState(false)

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProductName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName,
          description: newProductDescription,
          productType: newProductType,
          withTrim: newProductWithTrim,
          installationPrice: newProductInstallationPrice
        })
      })

      if (response.ok) {
        setNewProductName('')
        setNewProductDescription('')
        setNewProductType('SWING_DOOR')
        setNewProductWithTrim('Without Trim')
        setNewProductInstallationPrice(0)
        setShowCreateForm(false)
        onRefresh()
        alert('Product created successfully!')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Error creating product')
    } finally {
      setCreating(false)
    }
  }


  return (
    <div>
      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              {editingProduct === product.id ? (
                <form onSubmit={onUpdateProduct} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={editProductName}
                      onChange={(e) => setEditProductName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                      placeholder="Product name"
                      required
                    />
                  </div>
                  <div>
                    <textarea
                      value={editProductDescription}
                      onChange={(e) => setEditProductDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Product description"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Installation Price (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editProductInstallationPrice}
                        onChange={(e) => setEditProductInstallationPrice(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        const product = products.find(p => p.id === editingProduct)
                        if (product) {
                          onCancelEdit()
                          // Call delete with a small delay to ensure edit state is cleared
                          setTimeout(() => onDeleteProduct(product), 10)
                        }
                      }}
                      className="flex items-center px-3 py-1 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </button>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={onCancelEdit}
                        className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-800"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updating}
                        className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {updating ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{product.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          product.withTrim === 'With Trim'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {product.withTrim}
                        </span>
                        {product.archived && (
                          <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                            Archived
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{product.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                    <span>{product._count.productSubOptions} categories</span>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onDuplicateProduct(product)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Duplicate product"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onStartEdit(product)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit product"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectProduct(product)}
                    className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="text-xs text-blue-600">
                      Click to view template →
                    </div>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No products created yet. Create your first product template!
        </div>
      )}

      {/* Show Archived Toggle */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={() => setShowArchived(!showArchived)}
            className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          Show archived products
        </button>
      </div>

      {/* Create Product Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="e.g., Standard Door"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Brief description..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                <select
                  value={newProductType}
                  onChange={(e) => setNewProductType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="SWING_DOOR">Swing Door</option>
                  <option value="SLIDING_DOOR">Sliding Door</option>
                  <option value="FIXED_PANEL">Fixed Panel</option>
                  <option value="CORNER_90">90° Corner</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trim</label>
                <select
                  value={newProductWithTrim}
                  onChange={(e) => setNewProductWithTrim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="Without Trim">Without Trim</option>
                  <option value="With Trim">With Trim</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={newProductInstallationPrice}
                    onChange={(e) => setNewProductInstallationPrice(parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Base installation cost for this product type (optional)
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setNewProductName('')
                    setNewProductDescription('')
                    setNewProductType('SWING_DOOR')
                    setNewProductWithTrim('Without Trim')
                    setNewProductInstallationPrice(0)
                    setShowCreateForm(false)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProductName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoriesTab({ categories, onSelectCategory, onRefresh }: {
  categories: Category[]
  onSelectCategory: (category: Category) => void
  onRefresh: () => void
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingCategory, setEditingCategory] = useState<number | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryDescription, setEditCategoryDescription] = useState('')
  const [updating, setUpdating] = useState(false)

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDescription
        })
      })

      if (response.ok) {
        setNewCategoryName('')
        setNewCategoryDescription('')
        setShowCreateForm(false)
        onRefresh()
        alert('Category created successfully!')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      alert('Error creating category')
    } finally {
      setCreating(false)
    }
  }

  function startEditCategory(category: Category) {
    setEditingCategory(category.id)
    setEditCategoryName(category.name)
    setEditCategoryDescription(category.description || '')
  }

  function cancelEditCategory() {
    setEditingCategory(null)
    setEditCategoryName('')
    setEditCategoryDescription('')
  }

  async function handleUpdateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!editCategoryName.trim() || !editingCategory) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/categories/${editingCategory}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCategoryName,
          description: editCategoryDescription
        })
      })

      if (response.ok) {
        setEditingCategory(null)
        setEditCategoryName('')
        setEditCategoryDescription('')
        onRefresh()
        alert('Category updated successfully!')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      alert('Error updating category')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteCategory(categoryId: number, categoryName: string) {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"? This will also delete all its options.`)) return

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onRefresh()
        alert('Category deleted successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      alert('Error deleting category')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sub-Option Categories</h2>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Category
        </button>
      </div>
      
      {categories.length > 0 ? (
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-lg p-4">
              {editingCategory === category.id ? (
                <form onSubmit={handleUpdateCategory} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium"
                      placeholder="Category name"
                      required
                    />
                  </div>
                  <div>
                    <textarea
                      value={editCategoryDescription}
                      onChange={(e) => setEditCategoryDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Category description"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={cancelEditCategory}
                      className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-800"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {updating ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <button
                      onClick={() => onSelectCategory(category)}
                      className="text-left w-full group"
                    >
                      <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{category.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{category.description || 'No description'}</p>
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500">{category._count.individualOptions} options</span>
                    <button
                      onClick={() => onSelectCategory(category)}
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="View options"
                    >
                      View Options
                    </button>
                    <button
                      onClick={() => startEditCategory(category)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No categories created yet. Create your first category!
        </div>
      )}

      {/* Create Category Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Category</h2>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="e.g., Door Handles"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Brief description..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function OptionsTab({ options, categories, onRefresh }: { 
  options: IndividualOption[], 
  categories: Category[], 
  onRefresh: () => void 
}) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newOptionName, setNewOptionName] = useState('')
  const [newOptionDescription, setNewOptionDescription] = useState('')
  const [newOptionPrice, setNewOptionPrice] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingOption, setEditingOption] = useState<number | null>(null)
  const [editOptionName, setEditOptionName] = useState('')
  const [editOptionDescription, setEditOptionDescription] = useState('')
  const [editOptionPrice, setEditOptionPrice] = useState('')
  const [updating, setUpdating] = useState(false)

  async function handleCreateOption(e: React.FormEvent) {
    e.preventDefault()
    if (!newOptionName.trim() || !selectedCategoryId) return

    setCreating(true)
    try {
      const response = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          name: newOptionName,
          description: newOptionDescription,
          price: parseFloat(newOptionPrice) || 0
        })
      })

      if (response.ok) {
        setNewOptionName('')
        setNewOptionDescription('')
        setNewOptionPrice('')
        setSelectedCategoryId('')
        setShowCreateForm(false)
        onRefresh()
      }
    } catch (error) {
      console.error('Error creating option:', error)
      alert('Error creating option')
    } finally {
      setCreating(false)
    }
  }

  function startEditOption(option: IndividualOption) {
    setEditingOption(option.id)
    setEditOptionName(option.name)
    setEditOptionDescription(option.description || '')
    setEditOptionPrice(option.price.toString())
  }

  function cancelEditOption() {
    setEditingOption(null)
    setEditOptionName('')
    setEditOptionDescription('')
    setEditOptionPrice('')
  }

  async function handleUpdateOption(e: React.FormEvent) {
    e.preventDefault()
    if (!editOptionName.trim() || !editingOption) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/options/${editingOption}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editOptionName,
          description: editOptionDescription,
          price: editOptionPrice
        })
      })

      if (response.ok) {
        setEditingOption(null)
        setEditOptionName('')
        setEditOptionDescription('')
        setEditOptionPrice('')
        onRefresh()
        alert('Option updated successfully!')
      }
    } catch (error) {
      console.error('Error updating option:', error)
      alert('Error updating option')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteOption(optionId: number, optionName: string) {
    if (!confirm(`Are you sure you want to delete the option "${optionName}"?`)) return

    try {
      const response = await fetch(`/api/options/${optionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onRefresh()
        alert('Option deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting option:', error)
      alert('Error deleting option')
    }
  }

  // Group options by category
  const optionsByCategory = options.reduce((acc, option) => {
    const categoryName = option.category?.name || 'Unknown Category'
    if (!acc[categoryName]) {
      acc[categoryName] = []
    }
    acc[categoryName].push(option)
    return acc
  }, {} as Record<string, IndividualOption[]>)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Individual Options</h2>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Option
        </button>
      </div>
      
      {Object.keys(optionsByCategory).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(optionsByCategory).map(([categoryName, categoryOptions]) => (
            <div key={categoryName}>
              <h3 className="font-medium text-gray-900 mb-3">{categoryName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryOptions.map((option) => (
                  <div key={option.id} className="border border-gray-200 rounded-lg p-3">
                    {editingOption === option.id ? (
                      <form onSubmit={handleUpdateOption} className="space-y-2">
                        <div>
                          <input
                            type="text"
                            value={editOptionName}
                            onChange={(e) => setEditOptionName(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 font-medium"
                            placeholder="Option name"
                            required
                          />
                        </div>
                        <div>
                          <textarea
                            value={editOptionDescription}
                            onChange={(e) => setEditOptionDescription(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-gray-900"
                            placeholder="Description"
                            rows={2}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editOptionPrice}
                            onChange={(e) => setEditOptionPrice(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                            placeholder="Price"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={cancelEditOption}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            type="submit"
                            disabled={updating}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{option.name}</span>
                          {option.description && (
                            <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-green-600">
                            {option.price > 0 ? `+$${option.price.toFixed(2)}` : 'Free'}
                          </span>
                          <button
                            onClick={() => startEditOption(option)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit option"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteOption(option.id, option.name)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete option"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No options created yet. Create categories first, then add options!
        </div>
      )}

      {/* Create Option Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Option</h2>
            <form onSubmit={handleCreateOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Option Name</label>
                <input
                  type="text"
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="e.g., Lever Handle"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newOptionDescription}
                  onChange={(e) => setNewOptionDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOptionPrice}
                  onChange={(e) => setNewOptionPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newOptionName.trim() || !selectedCategoryId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

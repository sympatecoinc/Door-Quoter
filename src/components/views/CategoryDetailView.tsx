'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, Edit2, Trash2, Save, X, Search } from 'lucide-react'

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

export default function CategoryDetailView({ 
  category, 
  onBack, 
  onRefresh 
}: {
  category: Category,
  onBack: () => void,
  onRefresh: () => void
}) {
  const [categoryDetails, setCategoryDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddOptionForm, setShowAddOptionForm] = useState(false)
  const [availableMasterParts, setAvailableMasterParts] = useState<any[]>([])
  const [filteredMasterParts, setFilteredMasterParts] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMasterParts, setSelectedMasterParts] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [editingOption, setEditingOption] = useState<number | null>(null)
  const [editOptionName, setEditOptionName] = useState('')
  const [editOptionDescription, setEditOptionDescription] = useState('')
  const [editOptionPrice, setEditOptionPrice] = useState('')
  const [updating, setUpdating] = useState(false)

  // Fetch detailed category data and available master parts
  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch category details
        const categoryResponse = await fetch(`/api/categories/${category.id}`)
        if (categoryResponse.ok) {
          const categoryData = await categoryResponse.json()
          setCategoryDetails(categoryData)
        }

        // Fetch available master parts for options
        const masterPartsResponse = await fetch('/api/master-parts?optionsOnly=true')
        if (masterPartsResponse.ok) {
          const masterPartsData = await masterPartsResponse.json()
          setAvailableMasterParts(masterPartsData)
          setFilteredMasterParts(masterPartsData)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [category.id])

  // Filter master parts based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMasterParts(availableMasterParts)
    } else {
      const filtered = availableMasterParts.filter(part =>
        part.baseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (part.description && part.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredMasterParts(filtered)
    }
  }, [searchTerm, availableMasterParts])

  async function handleAddOption(e: React.FormEvent) {
    e.preventDefault()
    if (selectedMasterParts.length === 0) return

    setCreating(true)
    try {
      // Create options for all selected master parts
      const promises = selectedMasterParts.map(masterPart =>
        fetch('/api/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: category.id,
            name: masterPart.baseName,
            description: masterPart.description || `${masterPart.partNumber} - ${masterPart.baseName}`,
            price: masterPart.cost || 0
          })
        })
      )

      const responses = await Promise.all(promises)

      // Check if all requests were successful
      if (responses.every(res => res.ok)) {
        setSelectedMasterParts([])
        setSearchTerm('')
        setShowAddOptionForm(false)
        onRefresh()
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
      }
    } catch (error) {
      console.error('Error adding options:', error)
      alert('Error adding options')
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
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
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
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
        alert('Option deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting option:', error)
      alert('Error deleting option')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Categories
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
            <p className="text-gray-600">{category.description || 'No description'}</p>
          </div>
        </div>
      </div>

      {/* Options Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Options in this Category</h3>
          <button
            onClick={() => setShowAddOptionForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Option
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : categoryDetails?.individualOptions?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryDetails.individualOptions.map((option: any) => (
              <div key={option.id} className="border border-gray-200 rounded-lg p-4">
                {editingOption === option.id ? (
                  <form onSubmit={handleUpdateOption} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Option Name</label>
                      <input
                        type="text"
                        value={editOptionName}
                        onChange={(e) => setEditOptionName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="Option name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editOptionDescription}
                        onChange={(e) => setEditOptionDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="Option description"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editOptionPrice}
                        onChange={(e) => setEditOptionPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={cancelEditOption}
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
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{option.name}</h4>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditOption(option)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit option"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteOption(option.id, option.name)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {option.description && (
                      <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-green-600">
                        {option.price > 0 ? `+$${option.price.toFixed(2)}` : 'Free'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <div className="text-center">
              <Plus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No options in this category yet</p>
              <p className="text-sm mt-1">Add your first option to get started</p>
              <button
                onClick={() => setShowAddOptionForm(true)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add First Option
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Option Modal */}
      {showAddOptionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Hardware Option to {category.name}</h2>
            <form onSubmit={handleAddOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Hardware Item</label>
                
                {/* Search Field */}
                {availableMasterParts.length > 0 && (
                  <div className="relative mb-3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Search by name, part number, or description..."
                    />
                  </div>
                )}
                
                {availableMasterParts.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-lg">
                    {filteredMasterParts.length > 0 ? (
                      filteredMasterParts.map((part) => {
                        const isSelected = selectedMasterParts.some(p => p.id === part.id)
                        return (
                          <div key={part.id}
                               className={`p-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}
                               onClick={() => {
                                 if (isSelected) {
                                   setSelectedMasterParts(selectedMasterParts.filter(p => p.id !== part.id))
                                 } else {
                                   setSelectedMasterParts([...selectedMasterParts, part])
                                 }
                               }}>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                value={part.id}
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedMasterParts(selectedMasterParts.filter(p => p.id !== part.id))
                                  } else {
                                    setSelectedMasterParts([...selectedMasterParts, part])
                                  }
                                }}
                                className="mr-3 text-blue-600 h-4 w-4"
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-900">{part.baseName}</p>
                                    <p className="text-sm text-gray-600">Part #: {part.partNumber}</p>
                                    {part.description && (
                                      <p className="text-xs text-gray-500 mt-1">{part.description}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-green-600">
                                      ${part.cost ? part.cost.toFixed(2) : '0.00'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No hardware parts match your search</p>
                        {searchTerm && (
                          <p className="text-xs mt-1">Try a different search term</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border border-gray-300 rounded-lg">
                    <p className="text-sm">No hardware parts are marked as "Available as Category Option"</p>
                    <p className="text-xs mt-1">Create master parts with this option enabled first</p>
                  </div>
                )}
              </div>
              
              {selectedMasterParts.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Selected Options ({selectedMasterParts.length}):
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedMasterParts.map((part) => (
                      <div key={part.id} className="text-sm bg-white p-2 rounded border border-gray-200">
                        <p className="font-medium">{part.baseName}</p>
                        <p className="text-xs text-gray-600">Part #: {part.partNumber} • ${part.cost ? part.cost.toFixed(2) : '0.00'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddOptionForm(false)
                    setSelectedMasterParts([])
                    setSearchTerm('')
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || selectedMasterParts.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Adding...' : `Add ${selectedMasterParts.length} Option${selectedMasterParts.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
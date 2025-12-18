'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, Trash2, Search, Camera, X, Upload, Copy, Check, Pencil, Scissors } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface Category {
  id: number
  name: string
  description?: string
  svgOriginId?: string
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
  partNumber?: string
  price: number
  addToPackingList: boolean
  addFinishToPartNumber: boolean
  elevationImagePath?: string
  elevationImageOriginalName?: string
  planImagePath?: string
  planImageOriginalName?: string
  isCutListItem?: boolean
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
  const [selectedOptionForImages, setSelectedOptionForImages] = useState<IndividualOption | null>(null)
  const [uploadingElevation, setUploadingElevation] = useState(false)
  const [uploadingPlan, setUploadingPlan] = useState(false)
  const [copiedOriginId, setCopiedOriginId] = useState(false)
  const [editingOption, setEditingOption] = useState<IndividualOption | null>(null)
  const [saving, setSaving] = useState(false)

  // Copy SVG Origin ID to clipboard
  const handleCopyOriginId = async () => {
    const originId = categoryDetails?.svgOriginId || category.svgOriginId
    if (originId) {
      await navigator.clipboard.writeText(originId)
      setCopiedOriginId(true)
      setTimeout(() => setCopiedOriginId(false), 2000)
    }
  }

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: editingOption !== null, isBlocked: saving, onClose: () => setEditingOption(null) },
    { isOpen: selectedOptionForImages !== null, isBlocked: uploadingElevation || uploadingPlan, onClose: () => setSelectedOptionForImages(null) },
    { isOpen: showAddOptionForm, isBlocked: creating, onClose: () => setShowAddOptionForm(false) },
  ])

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

  // Filter master parts based on search term and exclude already added options
  useEffect(() => {
    // Get part numbers that are already in the category
    const existingPartNumbers = new Set(
      categoryDetails?.individualOptions
        ?.map((opt: IndividualOption) => opt.partNumber)
        .filter(Boolean) || []
    )

    // Filter out parts already in the category
    let partsToShow = availableMasterParts.filter(part => !existingPartNumbers.has(part.partNumber))

    // Apply search filter
    if (searchTerm.trim()) {
      partsToShow = partsToShow.filter(part =>
        part.baseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (part.description && part.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredMasterParts(partsToShow)
  }, [searchTerm, availableMasterParts, categoryDetails?.individualOptions])

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
            price: masterPart.cost || 0,
            partNumber: masterPart.partNumber,
            addToPackingList: masterPart.addToPackingList ?? true,
            addFinishToPartNumber: masterPart.addFinishToPartNumber ?? false
          })
        })
      )

      const responses = await Promise.all(promises)

      // Check results and collect any errors
      const errors: string[] = []
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          const errorData = await responses[i].json()
          errors.push(`${selectedMasterParts[i].baseName}: ${errorData.error || 'Failed to add'}`)
        }
      }

      if (errors.length > 0) {
        alert(`Some options could not be added:\n${errors.join('\n')}`)
      }

      // Refresh if at least some were successful
      if (responses.some(res => res.ok)) {
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

  async function handleSaveOption(e: React.FormEvent) {
    e.preventDefault()
    if (!editingOption) return

    setSaving(true)
    try {
      const response = await fetch(`/api/options/${editingOption.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingOption.name,
          description: editingOption.description,
          price: editingOption.price,
          partNumber: editingOption.partNumber,
          addToPackingList: editingOption.addToPackingList,
          addFinishToPartNumber: editingOption.addFinishToPartNumber,
          isCutListItem: editingOption.isCutListItem || false
        })
      })

      if (response.ok) {
        onRefresh()
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
        setEditingOption(null)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save option')
      }
    } catch (error) {
      console.error('Error saving option:', error)
      alert('Error saving option')
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(file: File, imageType: 'elevation' | 'plan') {
    if (!selectedOptionForImages) return

    const setUploading = imageType === 'elevation' ? setUploadingElevation : setUploadingPlan
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('imageType', imageType)

      const response = await fetch(`/api/options/${selectedOptionForImages.id}/images`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedOptionForImages(data.option)
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const categoryData = await detailsResponse.json()
          setCategoryDetails(categoryData)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload image')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Error uploading image')
    } finally {
      setUploading(false)
    }
  }

  async function handleImageDelete(imageType: 'elevation' | 'plan') {
    if (!selectedOptionForImages) return
    if (!confirm(`Are you sure you want to delete the ${imageType} image?`)) return

    const setUploading = imageType === 'elevation' ? setUploadingElevation : setUploadingPlan
    setUploading(true)

    try {
      const response = await fetch(`/api/options/${selectedOptionForImages.id}/images?imageType=${imageType}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedOptionForImages(data.option)
        // Refresh category details
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const categoryData = await detailsResponse.json()
          setCategoryDetails(categoryData)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete image')
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Error deleting image')
    } finally {
      setUploading(false)
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

      {/* SVG Origin ID Info Box */}
      {(categoryDetails?.svgOriginId || category.svgOriginId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-800 mb-1">SVG Origin ID</h3>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1.5 rounded border border-blue-200 text-sm font-mono text-blue-900">
                  {categoryDetails?.svgOriginId || category.svgOriginId}
                </code>
                <button
                  onClick={handleCopyOriginId}
                  className="flex items-center gap-1 px-2 py-1.5 text-sm text-blue-700 hover:bg-blue-100 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  {copiedOriginId ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Add this ID to an element in your door SVG to place hardware at that location.
                Example: <code className="bg-white px-1 rounded">&lt;rect id="{categoryDetails?.svgOriginId || category.svgOriginId}" x="149" y="3527"/&gt;</code>
              </p>
            </div>
          </div>
        </div>
      )}

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
              <div
                key={option.id}
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                onClick={() => setSelectedOptionForImages(option)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{option.name}</h4>
                  <div className="flex items-center gap-2">
                    {(option.elevationImagePath || option.planImagePath) && (
                      <span className="text-green-600" title="Has images">
                        <Camera className="w-4 h-4" />
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingOption(option)
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit option"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteOption(option.id, option.name)
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove from category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {option.partNumber && (
                  <p className="text-xs text-gray-500 mb-1">Part #: {option.partNumber}</p>
                )}
                {option.description && (
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-600">
                    {option.price > 0 ? `+$${option.price.toFixed(2)}` : 'Free'}
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    {option.isCutListItem && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Scissors className="w-3 h-3" />
                        BOM Item
                      </span>
                    )}
                    {option.addToPackingList && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Packing List</span>
                    )}
                    {option.addFinishToPartNumber && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">+ Finish</span>
                    )}
                  </div>
                </div>
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

      {/* Image Upload Modal */}
      {selectedOptionForImages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hardware Images</h2>
                <p className="text-sm text-gray-600">{selectedOptionForImages.name}</p>
                {selectedOptionForImages.partNumber && (
                  <p className="text-xs text-gray-500">Part #: {selectedOptionForImages.partNumber}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedOptionForImages(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Elevation Image Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Elevation View</h3>
                {selectedOptionForImages.elevationImagePath ? (
                  <div className="space-y-3">
                    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={`/uploads/option-images/${selectedOptionForImages.id}/${selectedOptionForImages.elevationImagePath}`}
                        alt="Elevation view"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedOptionForImages.elevationImageOriginalName}
                    </p>
                    <button
                      onClick={() => handleImageDelete('elevation')}
                      disabled={uploadingElevation}
                      className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {uploadingElevation ? 'Removing...' : 'Remove Image'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block">
                      <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        {uploadingElevation ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Click to upload</span>
                            <span className="text-xs text-gray-400 mt-1">PNG or JPEG</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, 'elevation')
                          e.target.value = ''
                        }}
                        disabled={uploadingElevation}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Plan Image Section */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Plan View</h3>
                {selectedOptionForImages.planImagePath ? (
                  <div className="space-y-3">
                    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={`/uploads/option-images/${selectedOptionForImages.id}/${selectedOptionForImages.planImagePath}`}
                        alt="Plan view"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {selectedOptionForImages.planImageOriginalName}
                    </p>
                    <button
                      onClick={() => handleImageDelete('plan')}
                      disabled={uploadingPlan}
                      className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {uploadingPlan ? 'Removing...' : 'Remove Image'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block">
                      <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                        {uploadingPlan ? (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500">Click to upload</span>
                            <span className="text-xs text-gray-400 mt-1">PNG or JPEG</span>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, 'plan')
                          e.target.value = ''
                        }}
                        disabled={uploadingPlan}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedOptionForImages(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Option Modal */}
      {editingOption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Option</h2>
              <button
                onClick={() => setEditingOption(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingOption.name}
                  onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                <input
                  type="text"
                  value={editingOption.partNumber || ''}
                  onChange={(e) => setEditingOption({ ...editingOption, partNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingOption.price}
                  onChange={(e) => setEditingOption({ ...editingOption, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
              </div>

              {/* Show in Product BOM */}
              <div className="border-t pt-4 mt-4">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      Show in Product BOM
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      When enabled, this option appears in the Product BOM section where formulas can be assigned per-product
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingOption.isCutListItem || false}
                    onChange={(e) => setEditingOption({ ...editingOption, isCutListItem: e.target.checked })}
                    className="h-5 w-5 text-orange-600 rounded"
                  />
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
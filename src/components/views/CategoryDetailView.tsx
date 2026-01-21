'use client'

import { useState, useEffect } from 'react'
import { Plus, ArrowLeft, Trash2, Search, Camera, X, Upload, Copy, Check, Pencil, Scissors, Link, EyeOff } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

interface Category {
  id: number
  name: string
  description?: string
  svgOriginId?: string
  excludeFromQuote?: boolean
  _count: {
    individualOptions: number
    productSubOptions: number
  }
  individualOptions: IndividualOption[]
}

interface OptionVariant {
  id: number
  optionId: number
  name: string
  isDefault: boolean
  sortOrder: number
}

interface LinkedPart {
  id: number
  optionId: number
  masterPartId: number
  variantId: number | null
  quantity: number
  masterPart: {
    id: number
    partNumber: string
    baseName: string
    description?: string
    unit?: string
    cost?: number
    partType?: string
  }
  variant?: {
    id: number
    name: string
  } | null
}

interface IndividualOption {
  id: number
  categoryId: number
  name: string
  description?: string
  partNumber?: string
  price?: number | null
  addToPackingList: boolean
  addFinishToPartNumber: boolean
  elevationImagePath?: string
  elevationImageOriginalName?: string
  planImagePath?: string
  planImageOriginalName?: string
  isCutListItem?: boolean
  masterPartType?: string | null
  linkedParts?: LinkedPart[]
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

  // Linked parts state
  const [selectedOptionForLinkedParts, setSelectedOptionForLinkedParts] = useState<IndividualOption | null>(null)
  const [linkedParts, setLinkedParts] = useState<LinkedPart[]>([])
  const [loadingLinkedParts, setLoadingLinkedParts] = useState(false)
  const [allMasterParts, setAllMasterParts] = useState<any[]>([])
  const [linkedPartSearchTerm, setLinkedPartSearchTerm] = useState('')
  const [addingLinkedPart, setAddingLinkedPart] = useState(false)
  const [newLinkedPartId, setNewLinkedPartId] = useState<number | null>(null)
  const [newLinkedPartQty, setNewLinkedPartQty] = useState('1')
  const [newLinkedPartVariantId, setNewLinkedPartVariantId] = useState<number | null>(null)
  const [editingLinkedPartId, setEditingLinkedPartId] = useState<number | null>(null)
  const [editingLinkedPartQty, setEditingLinkedPartQty] = useState('')
  const [savingLinkedPart, setSavingLinkedPart] = useState(false)

  // Variant state
  const [variants, setVariants] = useState<OptionVariant[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')
  const [addingVariant, setAddingVariant] = useState(false)
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null)
  const [editingVariantName, setEditingVariantName] = useState('')

  // Copy SVG Origin ID to clipboard
  const handleCopyOriginId = async () => {
    const originId = categoryDetails?.svgOriginId || category.svgOriginId
    if (originId) {
      await navigator.clipboard.writeText(originId)
      setCopiedOriginId(true)
      setTimeout(() => setCopiedOriginId(false), 2000)
    }
  }

  // Toggle exclude from quote setting
  const handleToggleExcludeFromQuote = async () => {
    const newValue = !(categoryDetails?.excludeFromQuote || category.excludeFromQuote)
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryDetails?.name || category.name,
          description: categoryDetails?.description || category.description,
          excludeFromQuote: newValue
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCategoryDetails(data)
        onRefresh()
      }
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: selectedOptionForLinkedParts !== null, isBlocked: addingLinkedPart, onClose: () => setSelectedOptionForLinkedParts(null) },
    { isOpen: editingOption !== null, isBlocked: saving, onClose: () => setEditingOption(null) },
    { isOpen: selectedOptionForImages !== null, isBlocked: uploadingElevation || uploadingPlan, onClose: () => setSelectedOptionForImages(null) },
    { isOpen: showAddOptionForm, isBlocked: creating, onClose: () => setShowAddOptionForm(false) },
  ])

  // Cmd+N to add new option
  useNewShortcut(
    () => setShowAddOptionForm(true),
    { disabled: showAddOptionForm || editingOption !== null || selectedOptionForImages !== null }
  )

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
            partNumber: masterPart.partNumber,
            price: masterPart.cost ?? null, // Use master part cost as initial option price
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

  // Fetch linked parts when modal opens
  async function fetchLinkedParts(optionId: number) {
    setLoadingLinkedParts(true)
    try {
      const response = await fetch(`/api/options/${optionId}/parts`)
      if (response.ok) {
        const data = await response.json()
        setLinkedParts(data)
      }
    } catch (error) {
      console.error('Error fetching linked parts:', error)
    } finally {
      setLoadingLinkedParts(false)
    }
  }

  // Fetch all master parts for dropdown
  async function fetchAllMasterParts() {
    try {
      const response = await fetch('/api/master-parts')
      if (response.ok) {
        const data = await response.json()
        setAllMasterParts(data)
      }
    } catch (error) {
      console.error('Error fetching master parts:', error)
    }
  }

  // Fetch variants for an option
  async function fetchVariants(optionId: number) {
    setLoadingVariants(true)
    try {
      const response = await fetch(`/api/options/${optionId}/variants`)
      if (response.ok) {
        const data = await response.json()
        setVariants(data)
      }
    } catch (error) {
      console.error('Error fetching variants:', error)
    } finally {
      setLoadingVariants(false)
    }
  }

  // Add a new variant
  async function handleAddVariant() {
    if (!selectedOptionForLinkedParts || !newVariantName.trim()) return

    setAddingVariant(true)
    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVariantName.trim(),
          isDefault: variants.length === 0 // First variant is default
        })
      })

      if (response.ok) {
        await fetchVariants(selectedOptionForLinkedParts.id)
        setNewVariantName('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add variant')
      }
    } catch (error) {
      console.error('Error adding variant:', error)
      alert('Error adding variant')
    } finally {
      setAddingVariant(false)
    }
  }

  // Update variant
  async function handleUpdateVariant(variantId: number) {
    if (!selectedOptionForLinkedParts || !editingVariantName.trim()) return

    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingVariantName.trim() })
      })

      if (response.ok) {
        await fetchVariants(selectedOptionForLinkedParts.id)
        await fetchLinkedParts(selectedOptionForLinkedParts.id) // Refresh to get updated variant names
        setEditingVariantId(null)
        setEditingVariantName('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update variant')
      }
    } catch (error) {
      console.error('Error updating variant:', error)
    }
  }

  // Delete variant
  async function handleDeleteVariant(variantId: number) {
    if (!selectedOptionForLinkedParts) return
    if (!confirm('Delete this variant? Linked parts specific to this variant will also be deleted.')) return

    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/variants/${variantId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchVariants(selectedOptionForLinkedParts.id)
        await fetchLinkedParts(selectedOptionForLinkedParts.id) // Refresh linked parts as some may have been deleted
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete variant')
      }
    } catch (error) {
      console.error('Error deleting variant:', error)
    }
  }

  // Set variant as default
  async function handleSetDefaultVariant(variantId: number) {
    if (!selectedOptionForLinkedParts) return

    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      })

      if (response.ok) {
        await fetchVariants(selectedOptionForLinkedParts.id)
      }
    } catch (error) {
      console.error('Error setting default variant:', error)
    }
  }

  // Open linked parts modal
  async function handleOpenLinkedParts(option: IndividualOption, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedOptionForLinkedParts(option)
    setLinkedPartSearchTerm('')
    setNewLinkedPartId(null)
    setNewLinkedPartQty('1')
    setNewLinkedPartVariantId(null)
    setNewVariantName('')
    setEditingVariantId(null)
    setEditingVariantName('')
    fetchLinkedParts(option.id)
    fetchVariants(option.id)
    if (allMasterParts.length === 0) {
      fetchAllMasterParts()
    }
  }

  // Add linked part
  async function handleAddLinkedPart() {
    if (!selectedOptionForLinkedParts || !newLinkedPartId) return

    setAddingLinkedPart(true)
    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPartId: newLinkedPartId,
          quantity: parseFloat(newLinkedPartQty) || 1,
          variantId: newLinkedPartVariantId
        })
      })

      if (response.ok) {
        await fetchLinkedParts(selectedOptionForLinkedParts.id)
        setNewLinkedPartId(null)
        setNewLinkedPartQty('1')
        setNewLinkedPartVariantId(null)
        setLinkedPartSearchTerm('')
        // Refresh category details to update badge
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add linked part')
      }
    } catch (error) {
      console.error('Error adding linked part:', error)
      alert('Error adding linked part')
    } finally {
      setAddingLinkedPart(false)
    }
  }

  // Delete linked part
  async function handleDeleteLinkedPart(partId: number) {
    if (!selectedOptionForLinkedParts) return
    if (!confirm('Remove this linked part?')) return

    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/parts?partId=${partId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchLinkedParts(selectedOptionForLinkedParts.id)
        // Refresh category details to update badge
        const detailsResponse = await fetch(`/api/categories/${category.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setCategoryDetails(data)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove linked part')
      }
    } catch (error) {
      console.error('Error removing linked part:', error)
    }
  }

  // Start editing a linked part
  function startEditLinkedPart(lp: LinkedPart) {
    setEditingLinkedPartId(lp.id)
    setEditingLinkedPartQty(lp.quantity?.toString() || '1')
  }

  // Cancel editing
  function cancelEditLinkedPart() {
    setEditingLinkedPartId(null)
    setEditingLinkedPartQty('')
  }

  // Save edited linked part
  async function handleUpdateLinkedPart() {
    if (!selectedOptionForLinkedParts || !editingLinkedPartId) return

    setSavingLinkedPart(true)
    try {
      const response = await fetch(`/api/options/${selectedOptionForLinkedParts.id}/parts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId: editingLinkedPartId,
          quantity: parseFloat(editingLinkedPartQty) || 1
        })
      })

      if (response.ok) {
        await fetchLinkedParts(selectedOptionForLinkedParts.id)
        cancelEditLinkedPart()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update linked part')
      }
    } catch (error) {
      console.error('Error updating linked part:', error)
      alert('Error updating linked part')
    } finally {
      setSavingLinkedPart(false)
    }
  }

  // Filter master parts for linked parts dropdown
  const filteredLinkedMasterParts = allMasterParts.filter(part => {
    // Exclude parts already linked to the same variant (allow same part on different variants)
    if (linkedParts.some(lp => lp.masterPartId === part.id && lp.variantId === newLinkedPartVariantId)) return false
    // Apply search filter
    if (linkedPartSearchTerm.trim()) {
      return (
        part.baseName.toLowerCase().includes(linkedPartSearchTerm.toLowerCase()) ||
        part.partNumber.toLowerCase().includes(linkedPartSearchTerm.toLowerCase())
      )
    }
    return true
  })

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

      {/* Category Settings */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Category Settings</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-gray-500" />
            <div>
              <span className="text-sm font-medium text-gray-700">Exclude from Quote</span>
              <p className="text-xs text-gray-500">Options in this category won't appear on the quote output</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleExcludeFromQuote}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              (categoryDetails?.excludeFromQuote || category.excludeFromQuote)
                ? 'bg-orange-500'
                : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                (categoryDetails?.excludeFromQuote || category.excludeFromQuote)
                  ? 'translate-x-6'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </label>
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
                      onClick={(e) => handleOpenLinkedParts(option, e)}
                      className={`p-1 transition-colors ${option.linkedParts && option.linkedParts.length > 0 ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-green-600'}`}
                      title="Linked parts"
                    >
                      <Link className="w-4 h-4" />
                    </button>
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
                {(option.partNumber || option.price != null) && (
                  <p className="text-xs text-gray-500 mb-1">
                    {option.partNumber && <span>Part #: {option.partNumber}</span>}
                    {option.partNumber && option.price != null && <span className="mx-2">|</span>}
                    {option.price != null && <span className="text-green-600">${option.price.toFixed(2)}</span>}
                  </p>
                )}
                {option.description && (
                  <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                )}
                <div className="flex justify-end items-center">
                  <div className="flex gap-1 flex-wrap">
                    {option.linkedParts && option.linkedParts.length > 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Link className="w-3 h-3" />
                        {option.linkedParts.length} linked
                      </span>
                    )}
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Option to {category.name}</h2>
            <form onSubmit={handleAddOption} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Part</label>
                
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
                        <p className="text-sm">No parts match your search</p>
                        {searchTerm && (
                          <p className="text-xs mt-1">Try a different search term</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 border border-gray-300 rounded-lg">
                    <p className="text-sm">No parts are marked as "Available as Category Option"</p>
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

              {/* Show in Product BOM - For extrusions and cut stock parts */}
              {(editingOption.masterPartType === 'Extrusion' || editingOption.masterPartType === 'CutStock') && (
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
              )}

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

      {/* Linked Parts Modal */}
      {selectedOptionForLinkedParts && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Linked Parts
                </h2>
                <p className="text-sm text-gray-600">{selectedOptionForLinkedParts.name}</p>
                {selectedOptionForLinkedParts.partNumber && (
                  <p className="text-xs text-gray-500">Part #: {selectedOptionForLinkedParts.partNumber}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedOptionForLinkedParts(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Parts linked here will be automatically added to the BOM when this option is selected.
            </p>

            {/* Variants Section */}
            <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-900 mb-3">Variants</h3>
              <p className="text-xs text-gray-500 mb-3">
                Create variants to have different linked parts for different configurations (e.g., "Locking" vs "Non-Locking").
              </p>

              {loadingVariants ? (
                <div className="flex justify-center py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {variants.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {variants.map((variant) => (
                        <div key={variant.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                          {editingVariantId === variant.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editingVariantName}
                                onChange={(e) => setEditingVariantName(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateVariant(variant.id)
                                  if (e.key === 'Escape') {
                                    setEditingVariantId(null)
                                    setEditingVariantName('')
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleUpdateVariant(variant.id)}
                                className="p-1 text-green-600 hover:text-green-700"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingVariantId(null)
                                  setEditingVariantName('')
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{variant.name}</span>
                                {variant.isDefault && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Default</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {!variant.isDefault && (
                                  <button
                                    onClick={() => handleSetDefaultVariant(variant.id)}
                                    className="p-1 text-gray-400 hover:text-green-600 text-xs"
                                    title="Set as default"
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingVariantId(variant.id)
                                    setEditingVariantName(variant.name)
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-600"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteVariant(variant.id)}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      placeholder="New variant name..."
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddVariant()
                      }}
                    />
                    <button
                      onClick={handleAddVariant}
                      disabled={addingVariant || !newVariantName.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingVariant ? '...' : 'Add'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Current linked parts - grouped by variant */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-3">Current Linked Parts</h3>
              {loadingLinkedParts ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : linkedParts.length > 0 ? (
                <div className="space-y-4">
                  {/* Parts for all variants (variantId = null) */}
                  {linkedParts.filter(lp => lp.variantId === null).length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Variants</h4>
                      <div className="space-y-2">
                        {linkedParts.filter(lp => lp.variantId === null).map((lp) => (
                          <div key={lp.id} className="p-3 bg-gray-50 rounded-lg">
                            {editingLinkedPartId === lp.id ? (
                              <div className="space-y-3">
                                <p className="font-medium text-gray-900">{lp.masterPart.baseName}</p>
                                <p className="text-xs text-gray-500">Part #: {lp.masterPart.partNumber} | {lp.masterPart.unit || 'EA'}</p>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                    <input
                                      type="number"
                                      value={editingLinkedPartQty}
                                      onChange={(e) => setEditingLinkedPartQty(e.target.value)}
                                      min="0.01"
                                      step="0.01"
                                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleUpdateLinkedPart}
                                    disabled={savingLinkedPart}
                                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {savingLinkedPart ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEditLinkedPart}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{lp.masterPart.baseName}</p>
                                  <p className="text-xs text-gray-500">
                                    Part #: {lp.masterPart.partNumber} | {lp.masterPart.unit || 'EA'} | Qty: {lp.quantity}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => startEditLinkedPart(lp)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="Edit linked part"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLinkedPart(lp.id)}
                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Remove linked part"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Parts for each variant */}
                  {variants.map((variant) => {
                    const variantParts = linkedParts.filter(lp => lp.variantId === variant.id)
                    if (variantParts.length === 0) return null
                    return (
                      <div key={variant.id}>
                        <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                          {variant.name} {variant.isDefault && '(Default)'}
                        </h4>
                        <div className="space-y-2">
                          {variantParts.map((lp) => (
                            <div key={lp.id} className="p-3 bg-purple-50 rounded-lg">
                              {editingLinkedPartId === lp.id ? (
                                <div className="space-y-3">
                                  <p className="font-medium text-gray-900">{lp.masterPart.baseName}</p>
                                  <p className="text-xs text-gray-500">Part #: {lp.masterPart.partNumber} | {lp.masterPart.unit || 'EA'}</p>
                                  <div className="flex gap-2">
                                    <div className="flex-1">
                                      <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                      <input
                                        type="number"
                                        value={editingLinkedPartQty}
                                        onChange={(e) => setEditingLinkedPartQty(e.target.value)}
                                        min="0.01"
                                        step="0.01"
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={handleUpdateLinkedPart}
                                      disabled={savingLinkedPart}
                                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      {savingLinkedPart ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={cancelEditLinkedPart}
                                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{lp.masterPart.baseName}</p>
                                    <p className="text-xs text-gray-500">
                                      Part #: {lp.masterPart.partNumber} | {lp.masterPart.unit || 'EA'} | Qty: {lp.quantity}
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => startEditLinkedPart(lp)}
                                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Edit linked part"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLinkedPart(lp.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                      title="Remove linked part"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No linked parts yet</p>
              )}
            </div>

            {/* Add new linked part */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-3">Add Linked Part</h3>
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={linkedPartSearchTerm}
                    onChange={(e) => setLinkedPartSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Search parts..."
                  />
                </div>

                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredLinkedMasterParts.slice(0, 50).map((part) => (
                    <div
                      key={part.id}
                      className={`p-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${newLinkedPartId === part.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setNewLinkedPartId(part.id)}
                    >
                      <p className="font-medium text-sm text-gray-900">{part.baseName}</p>
                      <p className="text-xs text-gray-500">Part #: {part.partNumber}</p>
                    </div>
                  ))}
                  {filteredLinkedMasterParts.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No parts found</p>
                  )}
                </div>

                {newLinkedPartId && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          value={newLinkedPartQty}
                          onChange={(e) => setNewLinkedPartQty(e.target.value)}
                          min="0.01"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        />
                      </div>
                      {variants.length > 0 && (
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                          <select
                            value={newLinkedPartVariantId ?? ''}
                            onChange={(e) => setNewLinkedPartVariantId(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          >
                            <option value="">All Variants</option>
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}{v.isDefault ? ' (Default)' : ''}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleAddLinkedPart}
                      disabled={addingLinkedPart}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {addingLinkedPart ? 'Adding...' : 'Add Linked Part'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={() => setSelectedOptionForLinkedParts(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
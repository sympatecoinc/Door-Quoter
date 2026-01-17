'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Package, Settings, Save, X, Upload, Search, ChevronDown, Sparkles, Tag } from 'lucide-react'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'
import { useAppStore } from '../../stores/appStore'
import CategoryDetailView from './CategoryDetailView'

interface MasterPart {
  id: number
  partNumber: string
  baseName: string
  description?: string
  unit?: string
  cost?: number
  weightPerUnit?: number
  weightPerFoot?: number
  partType: string
  isOption?: boolean
  isMillFinish?: boolean
  addFinishToPartNumber?: boolean
  addToPackingList?: boolean
  includeOnPickList?: boolean
  includeInJambKit?: boolean
  createdAt: string
  updatedAt: string
  pricingRules?: {
    basePrice: number | null
    isActive: boolean
  }[]
  stockLengthRules?: {
    basePrice: number | null
    isActive: boolean
  }[]
}

interface StockLengthRule {
  id: number
  name: string
  description?: string
  minHeight?: number
  maxHeight?: number
  minWidth?: number
  maxWidth?: number
  stockLength?: number
  piecesPerUnit?: number
  maxLength?: number
  maxLengthAppliesTo?: string
  appliesTo: string
  partType: string
  isActive: boolean
  basePrice?: number
  weightPerFoot?: number
  formula?: string
  minQuantity?: number
  maxQuantity?: number
  masterPartId?: number
  masterPart?: {
    id: number
    partNumber: string
    baseName: string
    unit?: string
  }
  createdAt: string
  updatedAt: string
}

interface PricingRule {
  id: number
  name: string
  description?: string
  basePrice?: number
  formula?: string
  minQuantity?: number
  maxQuantity?: number
  partType: string
  isActive: boolean
  masterPartId?: number
  masterPart?: {
    id: number
    partNumber: string
    baseName: string
  }
  createdAt: string
  updatedAt: string
}

interface GlassTypePart {
  id: number
  glassTypeId: number
  masterPartId: number
  formula?: string
  quantity?: number
  masterPart: {
    id: number
    partNumber: string
    baseName: string
    unit?: string
    cost?: number
    partType: string
  }
}

interface GlassType {
  id: number
  name: string
  description?: string
  pricePerSqFt: number
  parts?: GlassTypePart[]
  createdAt: string
  updatedAt: string
}

interface Category {
  id: number
  name: string
  description?: string
  _count: {
    individualOptions: number
    productSubOptions: number
  }
  individualOptions?: IndividualOption[]
  createdAt: string
  updatedAt: string
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

// Skeleton Loading Components
function MasterPartsSkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="w-4 h-4 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-48 bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-12 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2 justify-end">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="w-6 h-6 bg-gray-200 rounded" />
        </div>
      </td>
    </tr>
  )
}

function GlassTypesSkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="w-4 h-4 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2 justify-end">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="w-6 h-6 bg-gray-200 rounded" />
        </div>
      </td>
    </tr>
  )
}

function CategoriesSkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-4 w-28 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex space-x-2 justify-end">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="w-6 h-6 bg-gray-200 rounded" />
        </div>
      </td>
    </tr>
  )
}

export default function MasterPartsView() {
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const { triggerNotificationRefresh } = useAppStore()
  const [activeTab, setActiveTab] = useState<'masterParts' | 'partRules' | 'glass' | 'categories'>('masterParts')
  
  // Current master part for viewing rules
  const [selectedMasterPartId, setSelectedMasterPartId] = useState<number | null>(null)
  const [selectedMasterPart, setSelectedMasterPart] = useState<MasterPart | null>(null)
  
  // Master Parts State
  const [masterParts, setMasterParts] = useState<MasterPart[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'partNumber' | 'baseName' | 'partType'>('newest')
  const [loading, setLoading] = useState(true)
  const [showAddPartForm, setShowAddPartForm] = useState(false)
  const [editingPart, setEditingPart] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  
  // Master Part Form State
  const [partNumber, setPartNumber] = useState('')
  const [baseName, setBaseName] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('')
  const [weightPerUnit, setWeightPerUnit] = useState('')
  const [partType, setPartType] = useState('')
  const [isOption, setIsOption] = useState(false)
  const [isMillFinish, setIsMillFinish] = useState(false)
  const [addFinishToPartNumber, setAddFinishToPartNumber] = useState(false)
  const [addToPackingList, setAddToPackingList] = useState(false)
  const [includeOnPickList, setIncludeOnPickList] = useState(false)
  const [includeInJambKit, setIncludeInJambKit] = useState(false)

  // Stock Rules State
  const [stockRules, setStockRules] = useState<StockLengthRule[]>([])
  const [showAddRuleForm, setShowAddRuleForm] = useState(false)
  const [editingRule, setEditingRule] = useState<number | null>(null)
  const [creatingRule, setCreatingRule] = useState(false)
  const [updatingRule, setUpdatingRule] = useState(false)
  
  // Stock Rule Form State
  const [ruleName, setRuleName] = useState('')
  const [minHeight, setMinHeight] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const [stockLength, setStockLength] = useState('')
  const [rulePartType, setRulePartType] = useState('Extrusion')
  const [isActive, setIsActive] = useState(true)

  // Pricing Rules State - NOTE: Hardware parts don't use pricing rules, only Extrusions and other part types
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [showAddPricingForm, setShowAddPricingForm] = useState(false)
  const [editingPricingRule, setEditingPricingRule] = useState<number | null>(null)
  const [creatingPricingRule, setCreatingPricingRule] = useState(false)
  const [updatingPricingRule, setUpdatingPricingRule] = useState(false)

  // Pricing Rule Form State
  const [pricingName, setPricingName] = useState('')
  const [pricingDescription, setPricingDescription] = useState('')
  const [formula, setFormula] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [maxQuantity, setMaxQuantity] = useState('')
  const [pricingPartType, setPricingPartType] = useState('Extrusion')
  const [pricingIsActive, setPricingIsActive] = useState(true)

  // Glass Types State
  const [glassTypes, setGlassTypes] = useState<GlassType[]>([])
  const [loadingGlass, setLoadingGlass] = useState(false)
  const [showAddGlassForm, setShowAddGlassForm] = useState(false)
  const [editingGlassType, setEditingGlassType] = useState<number | null>(null)
  const [creatingGlass, setCreatingGlass] = useState(false)
  const [updatingGlass, setUpdatingGlass] = useState(false)

  // Glass Type Form State
  const [glassName, setGlassName] = useState('')
  const [glassDescription, setGlassDescription] = useState('')
  const [glassPricePerSqFt, setGlassPricePerSqFt] = useState('')

  // Glass Type Parts State
  const [expandedGlassTypeId, setExpandedGlassTypeId] = useState<number | null>(null)
  const [showAddGlassPartForm, setShowAddGlassPartForm] = useState<number | null>(null)
  const [addingGlassPart, setAddingGlassPart] = useState(false)
  const [deletingGlassPart, setDeletingGlassPart] = useState(false)
  const [editingGlassPart, setEditingGlassPart] = useState<{glassTypeId: number, partId: number} | null>(null)
  const [updatingGlassPart, setUpdatingGlassPart] = useState(false)

  // Glass Type Part Form State
  const [glassPartMasterPartId, setGlassPartMasterPartId] = useState<string>('')
  const [glassPartFormula, setGlassPartFormula] = useState('')
  const [glassPartQuantity, setGlassPartQuantity] = useState('1')

  // Product Categories State
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<number | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [updatingCategory, setUpdatingCategory] = useState(false)

  // Category Form State
  const [categoryName, setCategoryName] = useState('')
  const [categoryDescription, setCategoryDescription] = useState('')

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteModalType, setDeleteModalType] = useState<'masterPart' | 'stockRule' | 'pricingRule' | 'glassType' | 'category'>('masterPart')
  const [deleteItemId, setDeleteItemId] = useState<number | null>(null)
  const [deleteItemName, setDeleteItemName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // Bulk Selection State
  const [selectedPartIds, setSelectedPartIds] = useState<Set<number>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: showBulkDeleteModal, isBlocked: isBulkDeleting, onClose: () => setShowBulkDeleteModal(false) },
    { isOpen: showDeleteModal, isBlocked: isDeleting, onClose: () => { setShowDeleteModal(false); setDeleteItemId(null); setDeleteItemName('') } },
    { isOpen: showAddPartForm, isBlocked: creating, onClose: () => setShowAddPartForm(false) },
    { isOpen: editingPart !== null, isBlocked: updating, onClose: () => setEditingPart(null) },
    { isOpen: showAddRuleForm, isBlocked: creatingRule, onClose: () => setShowAddRuleForm(false) },
    { isOpen: editingRule !== null, isBlocked: updatingRule, onClose: () => setEditingRule(null) },
    { isOpen: showAddPricingForm, isBlocked: creatingPricingRule, onClose: () => setShowAddPricingForm(false) },
    { isOpen: editingPricingRule !== null, isBlocked: updatingPricingRule, onClose: () => setEditingPricingRule(null) },
    { isOpen: showAddGlassForm, isBlocked: creatingGlass, onClose: () => setShowAddGlassForm(false) },
    { isOpen: editingGlassType !== null, isBlocked: updatingGlass, onClose: () => setEditingGlassType(null) },
    { isOpen: showAddCategoryForm, isBlocked: creatingCategory, onClose: () => setShowAddCategoryForm(false) },
    { isOpen: editingCategory !== null, isBlocked: updatingCategory, onClose: () => setEditingCategory(null) },
  ])

  // Cmd+N to add new item based on active tab
  const anyModalOpen = showAddPartForm || editingPart !== null || showAddRuleForm || editingRule !== null ||
    showAddPricingForm || editingPricingRule !== null || showAddGlassForm || editingGlassType !== null ||
    showAddCategoryForm || editingCategory !== null || showDeleteModal || showBulkDeleteModal
  useNewShortcut(
    () => {
      switch (activeTab) {
        case 'masterParts':
          setShowAddPartForm(true)
          break
        case 'partRules':
          setShowAddRuleForm(true)
          break
        case 'glass':
          setShowAddGlassForm(true)
          break
        case 'categories':
          setShowAddCategoryForm(true)
          break
      }
    },
    { disabled: anyModalOpen }
  )

  // Filter and sort master parts
  const filteredMasterParts = masterParts
    .filter(part => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      return (
        part.partNumber.toLowerCase().includes(searchLower) ||
        part.baseName.toLowerCase().includes(searchLower) ||
        part.description?.toLowerCase().includes(searchLower) ||
        part.partType.toLowerCase().includes(searchLower)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'partNumber':
          return a.partNumber.localeCompare(b.partNumber)
        case 'baseName':
          return a.baseName.localeCompare(b.baseName)
        case 'partType':
          return a.partType.localeCompare(b.partType)
        default:
          return 0
      }
    })

  useEffect(() => {
    fetchMasterParts()
    fetchGlassTypes()
    fetchCategories()
  }, [])

  async function fetchMasterParts() {
    try {
      const response = await fetch('/api/master-parts')
      if (response.ok) {
        const data = await response.json()
        setMasterParts(data)
      }
    } catch (error) {
      console.error('Error fetching master parts:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStockRules(masterPartId: number) {
    try {
      const response = await fetch(`/api/stock-length-rules?masterPartId=${masterPartId}`)
      if (response.ok) {
        const data = await response.json()
        setStockRules(data)
      }
    } catch (error) {
      console.error('Error fetching stock rules:', error)
    }
  }

  async function fetchPricingRules(masterPartId: number) {
    try {
      const response = await fetch(`/api/pricing-rules?masterPartId=${masterPartId}`)
      if (response.ok) {
        const data = await response.json()
        setPricingRules(data)
      }
    } catch (error) {
      console.error('Error fetching pricing rules:', error)
    }
  }

  function resetPartForm() {
    setPartNumber('')
    setBaseName('')
    setDescription('')
    setUnit('')
    setWeightPerUnit('')
    setPartType('')
    setIsOption(false)
    setIsMillFinish(false)
    setAddFinishToPartNumber(false)
    setAddToPackingList(false)
    setIncludeOnPickList(false)
    setIncludeInJambKit(false)
  }

  async function handleCreateMasterPart(e: React.FormEvent) {
    e.preventDefault()
    if (!partNumber.trim() || !baseName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/master-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber,
          baseName,
          description,
          unit: (partType === 'Extrusion' || partType === 'CutStock') ? 'IN' : unit,
          weightPerUnit: weightPerUnit ? parseFloat(weightPerUnit) : null,
          weightPerFoot: weightPerUnit ? parseFloat(weightPerUnit) : null,
          partType,
          isOption: (partType === 'Hardware' || partType === 'Extrusion' || partType === 'CutStock') ? isOption : false,
          isMillFinish: partType === 'Extrusion' ? isMillFinish : false,
          addFinishToPartNumber: partType === 'Hardware' ? addFinishToPartNumber : false,
          addToPackingList: partType === 'Hardware' ? addToPackingList : false,
          includeOnPickList: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? includeOnPickList : false,
          includeInJambKit: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? includeInJambKit : false
        })
      })

      if (response.ok) {
        resetPartForm()
        setShowAddPartForm(false)
        fetchMasterParts()
        triggerNotificationRefresh() // Update sidebar notification badge
        showSuccess('Master part created successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to create master part')
      }
    } catch (error) {
      console.error('Error creating master part:', error)
      showError('Error creating master part')
    } finally {
      setCreating(false)
    }
  }

  async function handleUpdateMasterPart(e: React.FormEvent) {
    e.preventDefault()
    if (!partNumber.trim() || !baseName.trim() || !editingPart) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/master-parts/${editingPart}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber,
          baseName,
          description,
          unit: (partType === 'Extrusion' || partType === 'CutStock') ? 'IN' : unit,
          weightPerUnit: weightPerUnit ? parseFloat(weightPerUnit) : null,
          weightPerFoot: weightPerUnit ? parseFloat(weightPerUnit) : null,
          partType,
          isOption: (partType === 'Hardware' || partType === 'Extrusion' || partType === 'CutStock') ? isOption : false,
          isMillFinish: partType === 'Extrusion' ? isMillFinish : false,
          addFinishToPartNumber: partType === 'Hardware' ? addFinishToPartNumber : false,
          addToPackingList: partType === 'Hardware' ? addToPackingList : false,
          includeOnPickList: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? includeOnPickList : false,
          includeInJambKit: (partType === 'Hardware' || partType === 'Fastener' || partType === 'Extrusion') ? includeInJambKit : false
        })
      })

      if (response.ok) {
        resetPartForm()
        setEditingPart(null)
        fetchMasterParts()
        showSuccess('Master part updated successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update master part')
      }
    } catch (error) {
      console.error('Error updating master part:', error)
      showError('Error updating master part')
    } finally {
      setUpdating(false)
    }
  }

  function showDeleteConfirmation(type: typeof deleteModalType, id: number, name: string) {
    setDeleteModalType(type)
    setDeleteItemId(id)
    setDeleteItemName(name)
    setShowDeleteModal(true)
  }

  async function handleConfirmDelete() {
    if (!deleteItemId) return

    setIsDeleting(true)
    try {
      let url = ''
      let successMessage = ''
      let errorMessage = ''

      switch (deleteModalType) {
        case 'masterPart':
          url = `/api/master-parts/${deleteItemId}`
          successMessage = 'Master part deleted successfully!'
          errorMessage = 'Error deleting master part'
          break
        case 'stockRule':
          url = `/api/stock-length-rules/${deleteItemId}`
          successMessage = 'Stock length rule deleted successfully!'
          errorMessage = 'Error deleting stock length rule'
          break
        case 'pricingRule':
          url = `/api/pricing-rules/${deleteItemId}`
          successMessage = 'Pricing rule deleted successfully!'
          errorMessage = 'Error deleting pricing rule'
          break
        case 'glassType':
          url = `/api/glass-types/${deleteItemId}`
          successMessage = 'Glass type deleted successfully!'
          errorMessage = 'Error deleting glass type'
          break
        case 'category':
          url = `/api/categories/${deleteItemId}`
          successMessage = 'Category deleted successfully!'
          errorMessage = 'Cannot delete category that is linked to products'
          break
      }

      const response = await fetch(url, { method: 'DELETE' })

      if (response.ok) {
        // Refresh the appropriate data based on type
        switch (deleteModalType) {
          case 'masterPart':
            fetchMasterParts()
            break
          case 'stockRule':
            if (selectedMasterPartId) fetchStockRules(selectedMasterPartId)
            break
          case 'pricingRule':
            if (selectedMasterPartId) fetchPricingRules(selectedMasterPartId)
            break
          case 'glassType':
            fetchGlassTypes()
            break
          case 'category':
            fetchCategories()
            break
        }
        showSuccess(successMessage)
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || errorMessage)
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      showError('Error deleting item')
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
      setDeleteItemId(null)
      setDeleteItemName('')
    }
  }

  function handleDeleteMasterPart(id: number, name: string) {
    showDeleteConfirmation('masterPart', id, name)
  }

  // Bulk Selection Functions
  function togglePartSelection(id: number) {
    setSelectedPartIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  function toggleSelectAll() {
    if (selectedPartIds.size === filteredMasterParts.length) {
      // Deselect all
      setSelectedPartIds(new Set())
    } else {
      // Select all filtered parts
      setSelectedPartIds(new Set(filteredMasterParts.map(p => p.id)))
    }
  }

  function clearSelection() {
    setSelectedPartIds(new Set())
  }

  async function handleBulkDelete() {
    if (selectedPartIds.size === 0) return

    setIsBulkDeleting(true)
    try {
      const response = await fetch('/api/master-parts/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedPartIds) })
      })

      if (response.ok) {
        const data = await response.json()
        showSuccess(`${data.deletedCount} master part(s) deleted successfully`)
        setSelectedPartIds(new Set())
        fetchMasterParts()
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || 'Error deleting master parts')
      }
    } catch (error) {
      console.error('Error bulk deleting master parts:', error)
      showError('Error deleting master parts')
    } finally {
      setIsBulkDeleting(false)
      setShowBulkDeleteModal(false)
    }
  }

  function startEditMasterPart(part: MasterPart) {
    setEditingPart(part.id)
    setPartNumber(part.partNumber)
    setBaseName(part.baseName)
    setDescription(part.description || '')
    setUnit(part.unit || '')
    // For hardware/fastener/packaging use weightPerUnit, for extrusions use weightPerFoot
    setWeightPerUnit(((part.partType === 'Hardware' || part.partType === 'Fastener' || part.partType === 'Packaging') ? part.weightPerUnit : part.weightPerFoot)?.toString() || '')
    setPartType(part.partType)
    setIsOption(part.isOption || false)
    setIsMillFinish(part.isMillFinish || false)
    setAddFinishToPartNumber(part.addFinishToPartNumber || false)
    setAddToPackingList(part.addToPackingList || false)
    setIncludeOnPickList(part.includeOnPickList || false)
    setIncludeInJambKit(part.includeInJambKit || false)
  }

  function viewMasterPartRules(part: MasterPart) {
    setSelectedMasterPartId(part.id)
    setSelectedMasterPart(part)
    setActiveTab('partRules')
    fetchStockRules(part.id)
    fetchPricingRules(part.id)
  }

  async function handleCreateStockRule(e: React.FormEvent) {
    e.preventDefault()
    if (!ruleName.trim() || !selectedMasterPartId) return
    
    // Validate that stockLength is provided
    if (!stockLength) {
      showError('Stock length is required')
      return
    }

    setCreatingRule(true)
    try {
      const response = await fetch('/api/stock-length-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          minHeight: minHeight ? parseFloat(minHeight) : null,
          maxHeight: maxHeight ? parseFloat(maxHeight) : null,
          stockLength: stockLength ? parseFloat(stockLength) : null,
          partType: rulePartType,
          isActive,
          masterPartId: selectedMasterPartId
        })
      })

      if (response.ok) {
        resetRuleForm()
        setShowAddRuleForm(false)
        fetchStockRules(selectedMasterPartId)
        showSuccess('Stock length rule created successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to create stock rule')
      }
    } catch (error) {
      console.error('Error creating stock rule:', error)
      showError('Error creating stock rule')
    } finally {
      setCreatingRule(false)
    }
  }

  async function handleUpdateStockRule(e: React.FormEvent) {
    e.preventDefault()
    if (!ruleName.trim() || !editingRule) return
    
    // Validate that stockLength is provided
    if (!stockLength) {
      showError('Stock length is required')
      return
    }

    setUpdatingRule(true)
    try {
      const response = await fetch(`/api/stock-length-rules/${editingRule}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleName,
          minHeight: minHeight ? parseFloat(minHeight) : null,
          maxHeight: maxHeight ? parseFloat(maxHeight) : null,
          stockLength: stockLength ? parseFloat(stockLength) : null,
          partType: rulePartType,
          isActive,
          masterPartId: selectedMasterPartId
        })
      })

      if (response.ok) {
        resetRuleForm()
        setEditingRule(null)
        fetchStockRules(selectedMasterPartId!)
        showSuccess('Stock length rule updated successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update stock rule')
      }
    } catch (error) {
      console.error('Error updating stock rule:', error)
      showError('Error updating stock rule')
    } finally {
      setUpdatingRule(false)
    }
  }

  function handleDeleteStockRule(id: number, name: string) {
    showDeleteConfirmation('stockRule', id, name)
  }

  function startEditStockRule(rule: StockLengthRule) {
    setEditingRule(rule.id)
    setRuleName(rule.name)
    setMinHeight(rule.minHeight?.toString() || '')
    setMaxHeight(rule.maxHeight?.toString() || '')
    setStockLength(rule.stockLength?.toString() || '')
    setRulePartType(rule.partType)
    setIsActive(rule.isActive)
    setFormula(rule.formula || '')
    setMinQuantity(rule.minQuantity?.toString() || '')
    setMaxQuantity(rule.maxQuantity?.toString() || '')
  }

  function resetRuleForm() {
    setRuleName('')
    setMinHeight('')
    setMaxHeight('')
    setStockLength('')
    setRulePartType('Extrusion')
    setIsActive(true)
    setFormula('')
    setMinQuantity('')
    setMaxQuantity('')
  }

  async function handleCreatePricingRule(e: React.FormEvent) {
    e.preventDefault()
    if (!pricingName.trim() || !selectedMasterPartId) return

    setCreatingPricingRule(true)
    try {
      const response = await fetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pricingName,
          description: pricingDescription,
          formula,
          minQuantity: minQuantity ? parseFloat(minQuantity) : null,
          maxQuantity: maxQuantity ? parseFloat(maxQuantity) : null,
          partType: pricingPartType,
          isActive: pricingIsActive,
          masterPartId: selectedMasterPartId
        })
      })

      if (response.ok) {
        resetPricingForm()
        setShowAddPricingForm(false)
        fetchPricingRules(selectedMasterPartId)
        } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to create pricing rule')
      }
    } catch (error) {
      console.error('Error creating pricing rule:', error)
      showError('Error creating pricing rule')
    } finally {
      setCreatingPricingRule(false)
    }
  }

  async function handleUpdatePricingRule(e: React.FormEvent) {
    e.preventDefault()
    if (!pricingName.trim() || !editingPricingRule) return

    setUpdatingPricingRule(true)
    try {
      const response = await fetch(`/api/pricing-rules/${editingPricingRule}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pricingName,
          description: pricingDescription,
          formula,
          minQuantity: minQuantity ? parseFloat(minQuantity) : null,
          maxQuantity: maxQuantity ? parseFloat(maxQuantity) : null,
          partType: pricingPartType,
          isActive: pricingIsActive
        })
      })

      if (response.ok) {
        resetPricingForm()
        setEditingPricingRule(null)
        fetchPricingRules(selectedMasterPartId!)
        showSuccess('Pricing rule updated successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update pricing rule')
      }
    } catch (error) {
      console.error('Error updating pricing rule:', error)
      showError('Error updating pricing rule')
    } finally {
      setUpdatingPricingRule(false)
    }
  }

  function handleDeletePricingRule(id: number, name: string) {
    showDeleteConfirmation('pricingRule', id, name)
  }

  function startEditPricingRule(rule: PricingRule) {
    setEditingPricingRule(rule.id)
    setPricingName(rule.name)
    setPricingDescription(rule.description || '')
    setFormula(rule.formula || '')
    setMinQuantity(rule.minQuantity?.toString() || '')
    setMaxQuantity(rule.maxQuantity?.toString() || '')
    setPricingPartType(rule.partType)
    setPricingIsActive(rule.isActive)
  }

  function resetPricingForm() {
    setPricingName('')
    setPricingDescription('')
    setFormula('')
    setMinQuantity('')
    setMaxQuantity('')
    setPricingPartType('Extrusion') // Default to Extrusion since Hardware parts don't use pricing rules
    setPricingIsActive(true)
  }

  // Glass Type Functions
  async function fetchGlassTypes() {
    setLoadingGlass(true)
    try {
      const response = await fetch('/api/glass-types?includeParts=true')
      if (response.ok) {
        const data = await response.json()
        setGlassTypes(data)
      }
    } catch (error) {
      console.error('Error fetching glass types:', error)
      showError('Error fetching glass types')
    } finally {
      setLoadingGlass(false)
    }
  }

  // Glass Type Parts Functions
  function resetGlassPartForm() {
    setGlassPartMasterPartId('')
    setGlassPartFormula('')
    setGlassPartQuantity('1')
  }

  async function handleAddGlassTypePart(glassTypeId: number) {
    if (!glassPartMasterPartId) {
      showError('Please select a master part')
      return
    }

    setAddingGlassPart(true)
    try {
      const response = await fetch(`/api/glass-types/${glassTypeId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPartId: parseInt(glassPartMasterPartId),
          formula: glassPartFormula.trim() || null,
          quantity: glassPartFormula.trim() ? null : parseFloat(glassPartQuantity) || 1
        })
      })

      if (response.ok) {
        resetGlassPartForm()
        setShowAddGlassPartForm(null)
        fetchGlassTypes()
        showSuccess('Part added to glass type')
      } else {
        const error = await response.json()
        showError(error.error || 'Failed to add part')
      }
    } catch (error) {
      console.error('Error adding glass type part:', error)
      showError('Error adding part to glass type')
    } finally {
      setAddingGlassPart(false)
    }
  }

  async function handleUpdateGlassTypePart(glassTypeId: number, partId: number) {
    setUpdatingGlassPart(true)
    try {
      const response = await fetch(`/api/glass-types/${glassTypeId}/parts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId,
          formula: glassPartFormula.trim() || null,
          quantity: glassPartFormula.trim() ? null : parseFloat(glassPartQuantity) || 1
        })
      })

      if (response.ok) {
        resetGlassPartForm()
        setEditingGlassPart(null)
        fetchGlassTypes()
        showSuccess('Part updated')
      } else {
        const error = await response.json()
        showError(error.error || 'Failed to update part')
      }
    } catch (error) {
      console.error('Error updating glass type part:', error)
      showError('Error updating part')
    } finally {
      setUpdatingGlassPart(false)
    }
  }

  async function handleDeleteGlassTypePart(glassTypeId: number, partId: number) {
    setDeletingGlassPart(true)
    try {
      const response = await fetch(`/api/glass-types/${glassTypeId}/parts?partId=${partId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchGlassTypes()
        showSuccess('Part removed from glass type')
      } else {
        const error = await response.json()
        showError(error.error || 'Failed to remove part')
      }
    } catch (error) {
      console.error('Error deleting glass type part:', error)
      showError('Error removing part from glass type')
    } finally {
      setDeletingGlassPart(false)
    }
  }

  function startEditGlassTypePart(glassTypeId: number, part: GlassTypePart) {
    setEditingGlassPart({ glassTypeId, partId: part.id })
    setGlassPartMasterPartId(part.masterPartId.toString())
    setGlassPartFormula(part.formula || '')
    setGlassPartQuantity(part.quantity?.toString() || '1')
  }

  async function handleCreateGlassType(e: React.FormEvent) {
    e.preventDefault()
    if (!glassName.trim() || !glassPricePerSqFt) return

    setCreatingGlass(true)
    try {
      const response = await fetch('/api/glass-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: glassName,
          description: glassDescription,
          pricePerSqFt: parseFloat(glassPricePerSqFt)
        })
      })

      if (response.ok) {
        resetGlassForm()
        setShowAddGlassForm(false)
        fetchGlassTypes()
        showSuccess('Glass type created successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to create glass type')
      }
    } catch (error) {
      console.error('Error creating glass type:', error)
      showError('Error creating glass type')
    } finally {
      setCreatingGlass(false)
    }
  }

  async function handleUpdateGlassType(e: React.FormEvent) {
    e.preventDefault()
    if (!glassName.trim() || !glassPricePerSqFt || !editingGlassType) return

    setUpdatingGlass(true)
    try {
      const response = await fetch(`/api/glass-types/${editingGlassType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: glassName,
          description: glassDescription,
          pricePerSqFt: parseFloat(glassPricePerSqFt)
        })
      })

      if (response.ok) {
        resetGlassForm()
        setEditingGlassType(null)
        fetchGlassTypes()
        showSuccess('Glass type updated successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update glass type')
      }
    } catch (error) {
      console.error('Error updating glass type:', error)
      showError('Error updating glass type')
    } finally {
      setUpdatingGlass(false)
    }
  }

  function handleDeleteGlassType(id: number, name: string) {
    showDeleteConfirmation('glassType', id, name)
  }

  function startEditGlassType(glassType: GlassType) {
    setEditingGlassType(glassType.id)
    setGlassName(glassType.name)
    setGlassDescription(glassType.description || '')
    setGlassPricePerSqFt(glassType.pricePerSqFt.toString())
  }

  function resetGlassForm() {
    setGlassName('')
    setGlassDescription('')
    setGlassPricePerSqFt('')
  }

  // Category Management Functions
  async function fetchCategories() {
    setLoadingCategories(true)
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      showError('Error fetching categories')
    } finally {
      setLoadingCategories(false)
    }
  }

  function resetCategoryForm() {
    setCategoryName('')
    setCategoryDescription('')
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryName.trim()) return

    setCreatingCategory(true)
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName,
          description: categoryDescription
        })
      })

      if (response.ok) {
        resetCategoryForm()
        setShowAddCategoryForm(false)
        fetchCategories()
        showSuccess('Category created successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to create category')
      }
    } catch (error) {
      console.error('Error creating category:', error)
      showError('Error creating category')
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleUpdateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryName.trim() || !editingCategory) return

    setUpdatingCategory(true)
    try {
      const response = await fetch(`/api/categories/${editingCategory}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName,
          description: categoryDescription
        })
      })

      if (response.ok) {
        resetCategoryForm()
        setEditingCategory(null)
        fetchCategories()
        showSuccess('Category updated successfully!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update category')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      showError('Error updating category')
    } finally {
      setUpdatingCategory(false)
    }
  }

  function handleDeleteCategory(id: number, name: string) {
    showDeleteConfirmation('category', id, name)
  }

  function startEditCategory(category: Category) {
    setEditingCategory(category.id)
    setCategoryName(category.name)
    setCategoryDescription(category.description || '')
  }

  function cancelEditCategory() {
    setEditingCategory(null)
    resetCategoryForm()
  }

  // Fetch glass types when glass tab is opened
  useEffect(() => {
    if (activeTab === 'glass') {
      fetchGlassTypes()
    }
  }, [activeTab])

  // Fetch categories when categories tab is opened
  useEffect(() => {
    if (activeTab === 'categories') {
      fetchCategories()
    }
  }, [activeTab])

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Master Parts</h1>
          <p className="text-gray-600 mt-2">Manage your parts catalog and rules</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('masterParts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'masterParts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="w-5 h-5 inline-block mr-2" />
            Master Parts ({masterParts.length})
          </button>
          {selectedMasterPart && selectedMasterPart.partType !== 'Hardware' && selectedMasterPart.partType !== 'Fastener' && selectedMasterPart.partType !== 'Packaging' && (
            <button
              onClick={() => setActiveTab('partRules')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'partRules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="w-5 h-5 inline-block mr-2" />
              {selectedMasterPart.partNumber} Rules
            </button>
          )}
          <button
            onClick={() => setActiveTab('glass')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'glass'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Sparkles className="w-5 h-5 inline-block mr-2" />
            Glass ({glassTypes.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Tag className="w-5 h-5 inline-block mr-2" />
            Product Categories ({categories.length})
          </button>
        </nav>
      </div>

      {/* Master Parts Tab */}
      {activeTab === 'masterParts' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">Master Parts Database</h2>
              {selectedPartIds.size > 0 && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {selectedPartIds.size} selected
                </span>
              )}
            </div>
            <div className="flex space-x-3">
              {selectedPartIds.size > 0 && (
                <>
                  <button
                    onClick={clearSelection}
                    className="flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Clear Selection
                  </button>
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete Selected ({selectedPartIds.size})
                  </button>
                </>
              )}
              <button
                onClick={() => setShowAddPartForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Master Part
              </button>
            </div>
          </div>

          {/* Search and Sort Controls */}
          <div className="mb-4">
            <div className="flex gap-4 items-end">
              {/* Search Input */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search parts by part number, name, description, or type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Sort Dropdown */}
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="partNumber">Part Number</option>
                    <option value="baseName">Name</option>
                    <option value="partType">Part Type</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>
            
            {searchTerm && (
              <div className="mt-2 text-sm text-gray-600">
                {filteredMasterParts.length} part{filteredMasterParts.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left w-10"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...Array(8)].map((_, i) => (
                      <MasterPartsSkeletonRow key={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : filteredMasterParts.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={filteredMasterParts.length > 0 && selectedPartIds.size === filteredMasterParts.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          title={selectedPartIds.size === filteredMasterParts.length ? "Deselect all" : "Select all"}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMasterParts.map((part) => (
                      <tr key={part.id} className={`hover:bg-gray-50 ${selectedPartIds.has(part.id) ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPartIds.has(part.id)}
                            onChange={() => togglePartSelection(part.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{part.partNumber}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{part.baseName}</div>
                          {part.description && (
                            <div className="text-xs text-gray-500">{part.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            part.partType === 'Hardware'
                              ? 'bg-green-100 text-green-800'
                              : part.partType === 'Fastener'
                              ? 'bg-orange-100 text-orange-800'
                              : part.partType === 'Packaging'
                              ? 'bg-purple-100 text-purple-800'
                              : part.partType === 'CutStock'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {part.partType === 'CutStock' ? 'Cut Stock' : part.partType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {part.unit || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {(part.partType === 'Hardware' || part.partType === 'Fastener' || part.partType === 'Packaging') && part.weightPerUnit
                            ? `${part.weightPerUnit} oz`
                            : part.partType === 'Extrusion' && part.weightPerFoot
                            ? `${part.weightPerFoot} lb/ft`
                            : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2 justify-end">
                            {part.partType !== 'Hardware' && part.partType !== 'Fastener' && part.partType !== 'Packaging' && (
                              <button
                                onClick={() => viewMasterPartRules(part)}
                                className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                title="View part rules"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => startEditMasterPart(part)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit part"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMasterPart(part.id, part.partNumber)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete part"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-4">
                {searchTerm ? `No parts found matching "${searchTerm}"` : 'No master parts found'}
              </p>
              <button
                onClick={() => setShowAddPartForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Master Part
              </button>
            </div>
          )}
        </div>
      )}

      {/* Part-Specific Rules Tab */}
      {activeTab === 'partRules' && selectedMasterPart && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Rules for {selectedMasterPart.partNumber}
              </h2>
              <p className="text-gray-600 mt-1">{selectedMasterPart.baseName}</p>
            </div>
            <button
              onClick={() => {
                setSelectedMasterPartId(null)
                setSelectedMasterPart(null)
                setActiveTab('masterParts')
              }}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Master Parts
            </button>
          </div>

          {/* Stock Length Rules for this part - Full Width */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedMasterPart?.unit === 'IN' ? 'Stock Length Rules' : 'Pieces Per Unit Rules'} ({stockRules.length})
              </h3>
              <button
                onClick={() => setShowAddRuleForm(true)}
                className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Rule
              </button>
            </div>
            <div className="p-6">
              {stockRules.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rule Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dimensions
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {selectedMasterPart?.unit === 'IN' ? 'Stock Length' : 'Pieces Per Unit'}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {stockRules.map((rule) => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{rule.name}</div>
                                {rule.description && (
                                  <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="space-y-1">
                                {(rule.minHeight || rule.maxHeight) && (
                                  <div className="text-sm text-gray-600">
                                    Part Length: {rule.minHeight || '0'}" - {rule.maxHeight || '∞'}"
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {rule.stockLength && (
                                <span className="font-medium">{rule.stockLength}"</span>
                              )}
                              {rule.piecesPerUnit && (
                                <span className="font-medium">{rule.piecesPerUnit}</span>
                              )}
                              {rule.maxLength && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Max: {rule.maxLength}" ({rule.maxLengthAppliesTo})
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                rule.isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => startEditStockRule(rule)}
                                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Edit rule"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStockRule(rule.id, rule.name)}
                                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Delete rule"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No {selectedMasterPart?.unit === 'IN' ? 'stock length' : 'pieces per unit'} rules found for this part.
                </div>
              )}
            </div>
          </div>

          {/* Pricing Rules for this part - only show for non-extrusion, non-hardware, non-fastener, and non-packaging parts */}
          {selectedMasterPart?.partType !== 'Extrusion' && selectedMasterPart?.partType !== 'Hardware' && selectedMasterPart?.partType !== 'Fastener' && selectedMasterPart?.partType !== 'Packaging' && (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 mt-6">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Pricing Rules ({pricingRules.length})</h3>
                <button
                  onClick={() => setShowAddPricingForm(true)}
                  className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Rule
                </button>
              </div>
              <div className="p-6 space-y-4">
                {pricingRules.length > 0 ? (
                  pricingRules.map((rule) => (
                    <div key={rule.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{rule.name}</h4>
                          {rule.description && (
                            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                          )}
                          <div className="mt-2 text-sm text-gray-600">
                            {rule.formula && (
                              <div>Formula: <span className="font-medium">{rule.formula}</span></div>
                            )}
                            {(rule.minQuantity || rule.maxQuantity) && (
                              <div>
                                Quantity Range: {rule.minQuantity || '∞'} - {rule.maxQuantity || '∞'}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => startEditPricingRule(rule)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePricingRule(rule.id, rule.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No pricing rules found for this part.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Glass Tab */}
      {activeTab === 'glass' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Glass Types</h2>
            <button
              onClick={() => setShowAddGlassForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Glass Type
            </button>
          </div>

          {loadingGlass ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price per SqFt</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attached Parts</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...Array(5)].map((_, i) => (
                      <GlassTypesSkeletonRow key={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : glassTypes.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price per SqFt
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attached Parts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {glassTypes.map((glassType) => (
                      <React.Fragment key={glassType.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <button
                              onClick={() => setExpandedGlassTypeId(expandedGlassTypeId === glassType.id ? null : glassType.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title={expandedGlassTypeId === glassType.id ? 'Collapse' : 'Expand'}
                            >
                              <ChevronDown className={`w-4 h-4 transform transition-transform ${expandedGlassTypeId === glassType.id ? 'rotate-180' : ''}`} />
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{glassType.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">
                              {glassType.description || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              ${glassType.pricePerSqFt.toFixed(2)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">
                              {glassType.parts?.length || 0} part{(glassType.parts?.length || 0) !== 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex space-x-2 justify-end">
                              <button
                                onClick={() => startEditGlassType(glassType)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit glass type"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGlassType(glassType.id, glassType.name)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete glass type"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Parts Section */}
                        {expandedGlassTypeId === glassType.id && (
                          <tr key={`${glassType.id}-parts`}>
                            <td colSpan={6} className="px-6 py-4 bg-gray-50">
                              <div className="ml-8">
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-sm font-medium text-gray-700">Attached Parts</h4>
                                  <button
                                    onClick={() => {
                                      resetGlassPartForm()
                                      setShowAddGlassPartForm(glassType.id)
                                    }}
                                    className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Part
                                  </button>
                                </div>

                                {/* Add Part Form */}
                                {showAddGlassPartForm === glassType.id && (
                                  <div className="mb-4 p-4 border border-blue-200 rounded-lg bg-white">
                                    <h5 className="text-sm font-medium text-gray-700 mb-3">Add Part to Glass Type</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Master Part</label>
                                        <select
                                          value={glassPartMasterPartId}
                                          onChange={(e) => setGlassPartMasterPartId(e.target.value)}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                          <option value="">Select a part...</option>
                                          {masterParts
                                            .filter(p => p.partType === 'Hardware' || p.partType === 'Other')
                                            .map(part => (
                                              <option key={part.id} value={part.id}>
                                                {part.partNumber} - {part.baseName}
                                              </option>
                                            ))
                                          }
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          Formula <span className="text-gray-400">(e.g., height / 12)</span>
                                        </label>
                                        <input
                                          type="text"
                                          value={glassPartFormula}
                                          onChange={(e) => setGlassPartFormula(e.target.value)}
                                          placeholder="height, width, glassHeight, glassWidth"
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                          Fixed Quantity <span className="text-gray-400">(if no formula)</span>
                                        </label>
                                        <input
                                          type="number"
                                          value={glassPartQuantity}
                                          onChange={(e) => setGlassPartQuantity(e.target.value)}
                                          disabled={!!glassPartFormula.trim()}
                                          step="0.01"
                                          min="0"
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-end space-x-2 mt-4">
                                      <button
                                        onClick={() => {
                                          resetGlassPartForm()
                                          setShowAddGlassPartForm(null)
                                        }}
                                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleAddGlassTypePart(glassType.id)}
                                        disabled={addingGlassPart || !glassPartMasterPartId}
                                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        {addingGlassPart ? 'Adding...' : 'Add Part'}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Parts List */}
                                {glassType.parts && glassType.parts.length > 0 ? (
                                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Formula/Qty</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-200 bg-white">
                                        {glassType.parts.map((part) => (
                                          <tr key={part.id} className="hover:bg-gray-50">
                                            {editingGlassPart?.glassTypeId === glassType.id && editingGlassPart?.partId === part.id ? (
                                              <>
                                                <td className="px-4 py-2 text-gray-900">{part.masterPart.partNumber}</td>
                                                <td className="px-4 py-2 text-gray-600">{part.masterPart.baseName}</td>
                                                <td className="px-4 py-2">
                                                  <input
                                                    type="text"
                                                    value={glassPartFormula}
                                                    onChange={(e) => setGlassPartFormula(e.target.value)}
                                                    placeholder="height / 12"
                                                    className="w-24 px-2 py-1 text-xs border border-gray-300 rounded"
                                                  />
                                                  {!glassPartFormula.trim() && (
                                                    <input
                                                      type="number"
                                                      value={glassPartQuantity}
                                                      onChange={(e) => setGlassPartQuantity(e.target.value)}
                                                      step="0.01"
                                                      min="0"
                                                      className="w-16 ml-1 px-2 py-1 text-xs border border-gray-300 rounded"
                                                    />
                                                  )}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                  <button
                                                    onClick={() => handleUpdateGlassTypePart(glassType.id, part.id)}
                                                    disabled={updatingGlassPart}
                                                    className="p-1 text-green-600 hover:text-green-800 mr-1"
                                                    title="Save"
                                                  >
                                                    <Save className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      resetGlassPartForm()
                                                      setEditingGlassPart(null)
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-600"
                                                    title="Cancel"
                                                  >
                                                    <X className="w-4 h-4" />
                                                  </button>
                                                </td>
                                              </>
                                            ) : (
                                              <>
                                                <td className="px-4 py-2 text-gray-900">{part.masterPart.partNumber}</td>
                                                <td className="px-4 py-2 text-gray-600">{part.masterPart.baseName}</td>
                                                <td className="px-4 py-2 text-gray-600">
                                                  {part.formula ? (
                                                    <span className="font-mono text-xs bg-gray-100 px-1 rounded">{part.formula}</span>
                                                  ) : (
                                                    <span>{part.quantity || 1}</span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                  <button
                                                    onClick={() => startEditGlassTypePart(glassType.id, part)}
                                                    className="p-1 text-gray-400 hover:text-blue-600"
                                                    title="Edit"
                                                  >
                                                    <Edit2 className="w-4 h-4" />
                                                  </button>
                                                  <button
                                                    onClick={() => handleDeleteGlassTypePart(glassType.id, part.id)}
                                                    disabled={deletingGlassPart}
                                                    className="p-1 text-gray-400 hover:text-red-600"
                                                    title="Delete"
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                </td>
                                              </>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="text-sm text-gray-500 italic py-4">
                                    No parts attached. Click &quot;Add Part&quot; to attach hardware parts to this glass type.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-4">No glass types found</p>
              <button
                onClick={() => setShowAddGlassForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Your First Glass Type
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Master Part Modal */}
      {(showAddPartForm || editingPart) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPart ? 'Edit Master Part' : 'Add Master Part'}
              </h3>
              <button
                onClick={() => {
                  resetPartForm()
                  setShowAddPartForm(false)
                  setEditingPart(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingPart ? handleUpdateMasterPart : handleCreateMasterPart} className="space-y-4">
              {/* Always show Part Number and Part Type first */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number *</label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AD-E-12382H"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Type *</label>
                <select
                  value={partType}
                  onChange={(e) => {
                    const selectedType = e.target.value
                    setPartType(selectedType)
                    // Auto-set unit to "IN" for extrusions and reset other fields
                    if (selectedType === 'Extrusion') {
                      setUnit('IN')
                      // Keep isOption - extrusions can be category options too
                    } else {
                      setUnit('') // Reset unit for other types
                      if (selectedType !== 'Hardware' && selectedType !== 'Extrusion') {
                        setIsOption(false) // Reset isOption for non-hardware/extrusion types
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Part Type</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Extrusion">Extrusion</option>
                  <option value="CutStock">Cut Stock</option>
                  <option value="Fastener">Fastener</option>
                  <option value="Packaging">Packaging</option>
                </select>
              </div>

              {/* Show additional fields only after part type is selected */}
              {partType && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Name *</label>
                    <input
                      type="text"
                      value={baseName}
                      onChange={(e) => setBaseName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Vertical Extrusion"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>

                  {/* Show different fields based on part type */}

                  {partType === 'Hardware' && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                          <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select Unit</option>
                            <option value="EA">EA (Each)</option>
                            <option value="LF">LF (Linear Feet)</option>
                            <option value="IN">IN (Inches)</option>
                            <option value="SQ FT">SQ FT (Square Feet)</option>
                            <option value="SET">SET</option>
                            <option value="PAIR">PAIR</option>
                            <option value="BOX">BOX</option>
                            <option value="ROLL">ROLL</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weight (oz)
                            <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={weightPerUnit}
                            onChange={(e) => setWeightPerUnit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      {/* Is Option checkbox for hardware parts */}
                      <div className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          id="isOption"
                          checked={isOption}
                          onChange={(e) => setIsOption(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isOption" className="text-sm font-medium text-gray-700">
                          Available as Category Option
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (Can be selected when adding options to product categories)
                        </span>
                      </div>

                      {/* Add finish to part number checkbox */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="addFinishToPartNumber"
                          checked={addFinishToPartNumber}
                          onChange={(e) => setAddFinishToPartNumber(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="addFinishToPartNumber" className="text-sm font-medium text-gray-700">
                          Add finish color to part number in BOM
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (Appends finish code like -BL, -C2 to part number)
                        </span>
                      </div>

                      {/* Add to packing list checkbox */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="addToPackingList"
                          checked={addToPackingList}
                          onChange={(e) => setAddToPackingList(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="addToPackingList" className="text-sm font-medium text-gray-700">
                          Add to packing list
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (This hardware item will appear in the project packing list)
                        </span>
                      </div>

                      {/* Include on pick list checkbox */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="includeOnPickList"
                          checked={includeOnPickList}
                          onChange={(e) => setIncludeOnPickList(e.target.checked)}
                          className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="includeOnPickList" className="text-sm font-medium text-gray-700">
                          Include on pick list
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (This item will appear on production pick lists)
                        </span>
                      </div>

                      {/* Include in Jamb Kit checkbox */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="includeInJambKit"
                          checked={includeInJambKit}
                          onChange={(e) => setIncludeInJambKit(e.target.checked)}
                          className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="includeInJambKit" className="text-sm font-medium text-gray-700">
                          Include in Jamb Kit
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (This item will appear on jamb kit lists)
                        </span>
                      </div>
                    </>
                  )}

                  {/* Fastener specific fields */}
                  {partType === 'Fastener' && (
                    <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Unit</option>
                          <option value="EA">EA (Each)</option>
                          <option value="LF">LF (Linear Feet)</option>
                          <option value="IN">IN (Inches)</option>
                          <option value="SQ FT">SQ FT (Square Feet)</option>
                          <option value="SET">SET</option>
                          <option value="PAIR">PAIR</option>
                          <option value="BOX">BOX</option>
                          <option value="ROLL">ROLL</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (oz)
                          <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={weightPerUnit}
                          onChange={(e) => setWeightPerUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Include on pick list checkbox */}
                    <div className="flex items-center mt-3">
                      <input
                        type="checkbox"
                        id="fastenerIncludeOnPickList"
                        checked={includeOnPickList}
                        onChange={(e) => setIncludeOnPickList(e.target.checked)}
                        className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="fastenerIncludeOnPickList" className="text-sm font-medium text-gray-700">
                        Include on pick list
                      </label>
                      <span className="ml-2 text-xs text-gray-500">
                        (This item will appear on production pick lists)
                      </span>
                    </div>

                    {/* Include in Jamb Kit checkbox */}
                    <div className="flex items-center mt-2">
                      <input
                        type="checkbox"
                        id="fastenerIncludeInJambKit"
                        checked={includeInJambKit}
                        onChange={(e) => setIncludeInJambKit(e.target.checked)}
                        className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="fastenerIncludeInJambKit" className="text-sm font-medium text-gray-700">
                        Include in Jamb Kit
                      </label>
                      <span className="ml-2 text-xs text-gray-500">
                        (This item will appear on jamb kit lists)
                      </span>
                    </div>
                    </>
                  )}

                  {/* Packaging specific fields */}
                  {partType === 'Packaging' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Unit</option>
                          <option value="EA">EA (Each)</option>
                          <option value="LF">LF (Linear Feet)</option>
                          <option value="IN">IN (Inches)</option>
                          <option value="SQ FT">SQ FT (Square Feet)</option>
                          <option value="SET">SET</option>
                          <option value="PAIR">PAIR</option>
                          <option value="BOX">BOX</option>
                          <option value="ROLL">ROLL</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (oz)
                          <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={weightPerUnit}
                          onChange={(e) => setWeightPerUnit(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  {/* Extrusion specific fields */}
                  {partType === 'Extrusion' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Weight (lb/ft)
                          <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={weightPerUnit}
                        onChange={(e) => setWeightPerUnit(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 2.5"
                      />
                      <p className="mt-1 text-xs text-gray-500">Weight in pounds per linear foot</p>
                      </div>

                      {/* Is Mill Finish checkbox for extrusions */}
                      <div className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          id="isMillFinish"
                          checked={isMillFinish}
                          onChange={(e) => setIsMillFinish(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isMillFinish" className="text-sm font-medium text-gray-700">
                          Mill Finish
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (No finish codes like -BL, -C2, -AL will be added to part numbers)
                        </span>
                      </div>

                      {/* Is Option checkbox for extrusions */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="isOptionExtrusion"
                          checked={isOption}
                          onChange={(e) => setIsOption(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isOptionExtrusion" className="text-sm font-medium text-gray-700">
                          Available as Category Option
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (Can be selected when adding options to product categories)
                        </span>
                      </div>

                      {/* Include on pick list checkbox for extrusions */}
                      <div className="flex items-center mt-3">
                        <input
                          type="checkbox"
                          id="extrusionIncludeOnPickList"
                          checked={includeOnPickList}
                          onChange={(e) => setIncludeOnPickList(e.target.checked)}
                          className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="extrusionIncludeOnPickList" className="text-sm font-medium text-gray-700">
                          Include on pick list
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (This item will appear on production pick lists)
                        </span>
                      </div>

                      {/* Include in Jamb Kit checkbox for extrusions */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="extrusionIncludeInJambKit"
                          checked={includeInJambKit}
                          onChange={(e) => setIncludeInJambKit(e.target.checked)}
                          className="mr-2 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor="extrusionIncludeInJambKit" className="text-sm font-medium text-gray-700">
                          Include in Jamb Kit
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (This item will appear on jamb kit lists)
                        </span>
                      </div>
                    </>
                  )}

                  {/* CutStock specific fields */}
                  {partType === 'CutStock' && (
                    <>
                      <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
                        Cut Stock items are cut-to-length like extrusions but have fixed pricing per stock piece.
                        Use Stock Length Rules to define available stock lengths and their prices.
                      </p>
                      {/* Is Option checkbox for CutStock */}
                      <div className="flex items-center mt-2">
                        <input
                          type="checkbox"
                          id="isOptionCutStock"
                          checked={isOption}
                          onChange={(e) => setIsOption(e.target.checked)}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isOptionCutStock" className="text-sm font-medium text-gray-700">
                          Available as Category Option
                        </label>
                        <span className="ml-2 text-xs text-gray-500">
                          (Can be selected when adding options to product categories)
                        </span>
                      </div>
                    </>
                  )}

                </>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetPartForm()
                    setShowAddPartForm(false)
                    setEditingPart(null)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {creating || updating ? 'Saving...' : editingPart ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Stock Rule Modal */}
      {(showAddRuleForm || editingRule) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingRule ? 'Edit Stock Rule' : 'Add Stock Rule'}
              </h3>
              <button
                onClick={() => {
                  resetRuleForm()
                  setShowAddRuleForm(false)
                  setEditingRule(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingRule ? handleUpdateStockRule : handleCreateStockRule} className="space-y-4">
              {/* Name and Price on same row - Name takes 2/3, Price takes 1/3 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Standard Height Rule"
                    required
                  />
                </div>
              </div>

              {/* All three length fields on same row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Part Length (inches) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={minHeight}
                    onChange={(e) => setMinHeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., 84"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Part Length (inches) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maxHeight}
                    onChange={(e) => setMaxHeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., 96"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Length (inches) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={stockLength}
                    onChange={(e) => setStockLength(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., 96"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  Rule is active
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetRuleForm()
                    setShowAddRuleForm(false)
                    setEditingRule(null)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRule || updatingRule}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {creatingRule || updatingRule ? 'Saving...' : editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Pricing Rule Modal */}
      {(showAddPricingForm || editingPricingRule) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingPricingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
              </h3>
              <button
                onClick={() => {
                  resetPricingForm()
                  setShowAddPricingForm(false)
                  setEditingPricingRule(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingPricingRule ? handleUpdatePricingRule : handleCreatePricingRule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={pricingName}
                  onChange={(e) => setPricingName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., Standard Hardware Pricing"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={pricingDescription}
                  onChange={(e) => setPricingDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Type</label>
                <select
                  value={pricingPartType}
                  onChange={(e) => setPricingPartType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Extrusion">Extrusion</option>
                  <option value="CutStock">Cut Stock</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
                <input
                  type="text"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., basePrice * quantity or width * height * 0.25"
                />
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Leave empty for no limit"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="pricingIsActive"
                  checked={pricingIsActive}
                  onChange={(e) => setPricingIsActive(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="pricingIsActive" className="ml-2 block text-sm text-gray-700">
                  Rule is active
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetPricingForm()
                    setShowAddPricingForm(false)
                    setEditingPricingRule(null)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPricingRule || updatingPricingRule}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {creatingPricingRule || updatingPricingRule ? 'Saving...' : editingPricingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Glass Type Modal */}
      {(showAddGlassForm || editingGlassType) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingGlassType ? 'Edit Glass Type' : 'Add Glass Type'}
              </h3>
              <button
                onClick={() => {
                  resetGlassForm()
                  setShowAddGlassForm(false)
                  setEditingGlassType(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={editingGlassType ? handleUpdateGlassType : handleCreateGlassType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={glassName}
                  onChange={(e) => setGlassName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Clear, Frosted, Tempered"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={glassDescription}
                  onChange={(e) => setGlassDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per SqFt ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={glassPricePerSqFt}
                  onChange={(e) => setGlassPricePerSqFt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    resetGlassForm()
                    setShowAddGlassForm(false)
                    setEditingGlassType(null)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGlass || updatingGlass}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {creatingGlass || updatingGlass ? 'Saving...' : editingGlassType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          {selectedCategory ? (
            <CategoryDetailView
              category={selectedCategory}
              onBack={() => setSelectedCategory(null)}
              onRefresh={fetchCategories}
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Product Categories</h2>
                <button
                  onClick={() => setShowAddCategoryForm(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Category
                </button>
              </div>

              {loadingCategories ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used in Products</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {[...Array(5)].map((_, i) => (
                          <CategoriesSkeletonRow key={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : categories.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Options
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Used in Products
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {categories.map((category) => (
                          <tr
                            key={category.id}
                            className={`hover:bg-gray-50 ${editingCategory !== category.id ? 'cursor-pointer' : ''}`}
                            onClick={() => editingCategory !== category.id && setSelectedCategory(category)}
                          >
                            <td className="px-6 py-4">
                              {editingCategory === category.id ? (
                                <form onSubmit={handleUpdateCategory} className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Category name"
                                    required
                                    autoFocus
                                  />
                                  <button
                                    type="submit"
                                    disabled={updatingCategory}
                                    className="p-1 text-green-600 hover:text-green-700"
                                    title="Save"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditCategory}
                                    className="p-1 text-gray-600 hover:text-gray-700"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </form>
                              ) : (
                                <div className="text-sm font-medium text-blue-600">
                                  {category.name}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {editingCategory === category.id ? (
                                <input
                                  type="text"
                                  value={categoryDescription}
                                  onChange={(e) => setCategoryDescription(e.target.value)}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Description (optional)"
                                />
                              ) : (
                                <div className="text-sm text-gray-600">
                                  {category.description || '-'}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {category._count.individualOptions} option{category._count.individualOptions !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                {category._count.productSubOptions} product{category._count.productSubOptions !== 1 ? 's' : ''}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end space-x-2">
                                {editingCategory !== category.id && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startEditCategory(category)
                                      }}
                                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                      title="Edit category"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteCategory(category.id, category.name)
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                      title="Delete category"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Tag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Categories Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Create categories to organize hardware options for your products.
                  </p>
                  <button
                    onClick={() => setShowAddCategoryForm(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create First Category
                  </button>
                </div>
              )}

              {/* Add Category Modal */}
              {showAddCategoryForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-xl p-6 w-full max-w-md">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Create Product Category</h2>
                    <form onSubmit={handleCreateCategory} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category Name *
                        </label>
                        <input
                          type="text"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          placeholder="e.g., Handle Type, Lock Type"
                          required
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={categoryDescription}
                          onChange={(e) => setCategoryDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                          placeholder="Optional description"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategoryForm(false)
                            resetCategoryForm()
                          }}
                          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={creatingCategory}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {creatingCategory ? 'Creating...' : 'Create Category'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete {deleteModalType === 'masterPart' ? 'Master Part' :
                     deleteModalType === 'stockRule' ? 'Stock Length Rule' :
                     deleteModalType === 'pricingRule' ? 'Pricing Rule' :
                     deleteModalType === 'glassType' ? 'Glass Type' :
                     deleteModalType === 'finish' ? 'Finish Type' : 'Category'}
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{deleteItemName}</strong>"? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteItemId(null)
                  setDeleteItemName('')
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete {selectedPartIds.size} Master Part{selectedPartIds.size !== 1 ? 's' : ''}
            </h3>

            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete <strong>{selectedPartIds.size}</strong> master part{selectedPartIds.size !== 1 ? 's' : ''}?
              This action cannot be undone.
            </p>

            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-6">
              This will also delete any related Individual Options and Product BOM entries that reference these parts.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isBulkDeleting ? 'Deleting...' : `Delete ${selectedPartIds.size} Part${selectedPartIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

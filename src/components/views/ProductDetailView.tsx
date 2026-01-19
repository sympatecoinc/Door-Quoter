'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, ArrowLeft, Tag, Wrench, Link, X, Edit2, Trash2, Save, Upload, Image as ImageIcon, ChevronDown, ChevronRight, Star, Download } from 'lucide-react'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import { useEscapeKey } from '../../hooks/useEscapeKey'

// Debounce utility function
function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: NodeJS.Timeout
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Helper function to render formula with variable highlighting
function renderFormulaWithHighlights(formula: string) {
  if (!formula) return null
  
  // Split the formula by words and operators to highlight width/height variables (case-insensitive)
  const parts = formula.split(/(\s+|[+\-*/()=])/g)
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === 'width' || part.toLowerCase() === 'height') {
      return (
        <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium mx-1">
          {part}
        </span>
      )
    }
    return part
  })
}

// Function to evaluate glass formula with implicit Width/Height variables
function evaluateGlassFormulaWithTestValues(formula: string, baseValue: number): string {
  if (!formula) return ''
  
  try {
    // If formula starts with operator, prepend the base value (implicit variable)
    let evaluatedFormula = formula.trim()
    if (evaluatedFormula.match(/^[+\-*/]/)) {
      evaluatedFormula = baseValue + evaluatedFormula
    } else if (evaluatedFormula.match(/^[0-9]/)) {
      // If it's just a number, use it as is
      evaluatedFormula = evaluatedFormula
    } else {
      // Replace explicit width/height variables if used
      evaluatedFormula = evaluatedFormula.replace(/\bwidth\b/gi, '36')
      evaluatedFormula = evaluatedFormula.replace(/\bheight\b/gi, '96')
    }
    
    // Clean up common mathematical operations and formatting
    evaluatedFormula = evaluatedFormula.replace(/\s+/g, '') // Remove spaces
    evaluatedFormula = evaluatedFormula.replace(/([0-9]+)in/gi, '$1') // Remove 'in' units
    
    // Validate that the formula contains only allowed characters
    const allowedPattern = /^[0-9+\-*/.()]+$/
    if (!allowedPattern.test(evaluatedFormula)) {
      return 'Invalid'
    }
    
    // Basic mathematical evaluation (for display purposes only)
    const result = eval(evaluatedFormula)
    return isNaN(result) ? 'Invalid' : Number(result).toFixed(1)
  } catch (error) {
    return 'Invalid'
  }
}

// Function to evaluate formula with test values (for BOM parts)
function evaluateFormulaWithTestValues(formula: string): string {
  if (!formula) return ''
  
  try {
    // Replace variables with test values (case-insensitive)
    let evaluatedFormula = formula.replace(/\bwidth\b/gi, '36')
    evaluatedFormula = evaluatedFormula.replace(/\bheight\b/gi, '96')
    
    // Clean up common mathematical operations and formatting
    evaluatedFormula = evaluatedFormula.replace(/\s+/g, '') // Remove spaces
    evaluatedFormula = evaluatedFormula.replace(/([0-9]+)in/gi, '$1') // Remove 'in' units
    
    // Validate that the formula contains only allowed characters
    const allowedPattern = /^[0-9+\-*/.()]+$/
    if (!allowedPattern.test(evaluatedFormula)) {
      return 'Invalid characters in formula'
    }
    
    // Basic mathematical evaluation (for display purposes only)
    // Note: This is a simplified evaluation for preview only
    const result = eval(evaluatedFormula)
    return isNaN(result) ? 'Invalid formula' : Number(result).toFixed(3)
  } catch (error) {
    return 'Invalid formula'
  }
}

// Formula input component with live highlighting
function FormulaInput({ 
  value, 
  onChange, 
  placeholder 
}: { 
  value: string
  onChange: (value: string) => void
  placeholder: string 
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        placeholder={placeholder}
      />
      {value && (
        <div className="mt-2 space-y-2">
          <div className="p-2 bg-gray-50 rounded-lg text-sm">
            <span className="text-gray-600">Formula: </span>
            {renderFormulaWithHighlights(value)}
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-sm">
            <span className="text-blue-600">Example output: </span>
            <span className="font-mono text-blue-800">
              {evaluateFormulaWithTestValues(value)}
            </span>
            <span className="text-xs text-blue-600 ml-2">
              (using width=36, height=96)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Glass Formula Input Component (compact version)
function GlassFormulaInput({ 
  value, 
  onChange, 
  placeholder,
  baseValue
}: { 
  value: string
  onChange: (value: string) => void
  placeholder: string
  baseValue: number
}) {
  return (
    <div className="flex items-center space-x-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
        placeholder={placeholder}
      />
      {value && (
        <span className="text-xs text-gray-500 font-mono">
          = {evaluateGlassFormulaWithTestValues(value, baseValue)}
        </span>
      )}
    </div>
  )
}

// Glass Formulas Display Component
function GlassFormulasDisplay({ product }: { product: Product }) {
  const hasFormulas = product.glassWidthFormula || product.glassHeightFormula || product.glassQuantityFormula

  if (!hasFormulas) {
    return (
      <div className="text-gray-500 text-sm italic">
        No glass size formulas configured. Click "Edit Glass Formulas" to add them.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {product.glassWidthFormula && (
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 w-16">Width:</span>
          <span className="text-sm font-mono text-gray-900">{product.glassWidthFormula}</span>
          <span className="text-xs text-gray-500">
            (Example: {evaluateGlassFormulaWithTestValues(product.glassWidthFormula, 36)} IN)
          </span>
        </div>
      )}
      
      {product.glassHeightFormula && (
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 w-16">Height:</span>
          <span className="text-sm font-mono text-gray-900">{product.glassHeightFormula}</span>
          <span className="text-xs text-gray-500">
            (Example: {evaluateGlassFormulaWithTestValues(product.glassHeightFormula, 96)} IN)
          </span>
        </div>
      )}
      
      {product.glassQuantityFormula && (
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700 w-16">Quantity:</span>
          <span className="text-sm font-mono text-gray-900">{product.glassQuantityFormula}</span>
          <span className="text-xs text-gray-500">
            (Example: {evaluateGlassFormulaWithTestValues(product.glassQuantityFormula, 1)})
          </span>
        </div>
      )}
    </div>
  )
}

// Glass Size Calculator Modal Component
function GlassSizeCalculatorModal({ 
  product, 
  isOpen, 
  onClose, 
  onRefresh 
}: { 
  product: Product
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const [widthFormula, setWidthFormula] = useState(product.glassWidthFormula || '')
  const [heightFormula, setHeightFormula] = useState(product.glassHeightFormula || '')
  const [quantityFormula, setQuantityFormula] = useState(product.glassQuantityFormula || '')
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Strip 'width' and 'height' prefix when loading existing formulas for editing
      const existingWidthFormula = product.glassWidthFormula || ''
      const existingHeightFormula = product.glassHeightFormula || ''

      // Remove 'width' prefix if present (case-insensitive)
      const widthForEdit = existingWidthFormula.trim().toLowerCase().startsWith('width')
        ? existingWidthFormula.trim().substring(5).trim()
        : existingWidthFormula.trim()

      // Remove 'height' prefix if present (case-insensitive)
      const heightForEdit = existingHeightFormula.trim().toLowerCase().startsWith('height')
        ? existingHeightFormula.trim().substring(6).trim()
        : existingHeightFormula.trim()

      setWidthFormula(widthForEdit)
      setHeightFormula(heightForEdit)
      setQuantityFormula(product.glassQuantityFormula || '')
    }
  }, [isOpen, product])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Auto-prepend 'width' and 'height' to user input if not already present
      const finalWidthFormula = widthFormula.trim()
        ? (widthFormula.trim().toLowerCase().includes('width') ? widthFormula.trim() : `width ${widthFormula.trim()}`)
        : ''

      const finalHeightFormula = heightFormula.trim()
        ? (heightFormula.trim().toLowerCase().includes('height') ? heightFormula.trim() : `height ${heightFormula.trim()}`)
        : ''

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glassWidthFormula: finalWidthFormula,
          glassHeightFormula: finalHeightFormula,
          glassQuantityFormula: quantityFormula.trim()
        })
      })

      if (response.ok) {
        onRefresh()
        onClose()
      } else {
        console.error('Error saving glass formulas:', response.statusText)
      }
    } catch (error) {
      console.error('Error saving glass formulas:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Edit Glass Size Formulas</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Glass Width Deduction (inches)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Enter deduction amount. Example: <code className="bg-gray-100 px-1 rounded">- 5</code> for 5" smaller than component width
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 font-mono">width</span>
              <GlassFormulaInput
                value={widthFormula}
                onChange={setWidthFormula}
                placeholder="- 5"
                baseValue={36}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Glass Height Deduction (inches)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Enter deduction amount. Example: <code className="bg-gray-100 px-1 rounded">- 10</code> for 10" smaller than component height
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 font-mono">height</span>
              <GlassFormulaInput
                value={heightFormula}
                onChange={setHeightFormula}
                placeholder="- 10"
                baseValue={96}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Glass Quantity
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Usually <code className="bg-gray-100 px-1 rounded">1</code> for single pane
            </p>
            <GlassFormulaInput
              value={quantityFormula}
              onChange={setQuantityFormula}
              placeholder="1"
              baseValue={1}
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Formulas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Product {
  id: number
  name: string
  description?: string
  type: string
  productType: string
  archived: boolean
  glassWidthFormula?: string
  glassHeightFormula?: string
  glassQuantityFormula?: string
  installationPrice?: number
  minWidth?: number | null
  maxWidth?: number | null
  minHeight?: number | null
  maxHeight?: number | null
  pairedProductId?: number | null
  pairedProduct?: {
    id: number
    name: string
    productType: string
  } | null
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

interface ProductBOM {
  id: number
  productId: number
  materialType: string
  partName: string
  formula: string
  variable: string
  product?: {
    name: string
  }
}

interface ProductPlanView {
  id: number
  productId: number
  name: string
  imageData: string
  fileName?: string
  fileType?: string
  orientation?: string
  displayOrder: number
  createdAt: string
  updatedAt: string
}

// Product type display mapping for badges
const productTypeDisplay: Record<string, { label: string; colors: string }> = {
  'SWING_DOOR': { label: 'Swing Door', colors: 'bg-blue-100 text-blue-700' },
  'SLIDING_DOOR': { label: 'Sliding Door', colors: 'bg-green-100 text-green-700' },
  'FIXED_PANEL': { label: 'Fixed Panel', colors: 'bg-orange-100 text-orange-700' },
  'CORNER_90': { label: '90 Degree Corner', colors: 'bg-purple-100 text-purple-700' },
  'FRAME': { label: 'Frame', colors: 'bg-gray-100 text-gray-700' },
}

export default function ProductDetailView({ 
  product, 
  categories, 
  productBOMs, 
  onBack, 
  onRefresh,
  onEdit,
  onDelete
}: {
  product: Product,
  categories: Category[],
  productBOMs: ProductBOM[],
  onBack: () => void,
  onRefresh: () => void,
  onEdit?: (product: Product) => void,
  onDelete?: (product: Product) => void
}) {
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [newPartFormula, setNewPartFormula] = useState('')
  const [newPartQuantity, setNewPartQuantity] = useState('')
  const [newPartNumber, setNewPartNumber] = useState('')
  const [newPartIsMilled, setNewPartIsMilled] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingPart, setEditingPart] = useState<number | null>(null)
  const [editPartType, setEditPartType] = useState('')
  const [editPartName, setEditPartName] = useState('')
  const [editPartDescription, setEditPartDescription] = useState('')
  const [editPartFormula, setEditPartFormula] = useState('')
  const [editPartVariable, setEditPartVariable] = useState('')
  const [editPartUnit, setEditPartUnit] = useState('')
  const [editPartQuantity, setEditPartQuantity] = useState('')
  const [editPartNumber, setEditPartNumber] = useState('')
  const [editPartIsMilled, setEditPartIsMilled] = useState(true)
  const [editPartAddFinish, setEditPartAddFinish] = useState(false)
  const [editPartAddToPacking, setEditPartAddToPacking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [productDetails, setProductDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showLinkCategoryForm, setShowLinkCategoryForm] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [linking, setLinking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editProductType, setEditProductType] = useState('SWING_DOOR')
  const [editPairedProductId, setEditPairedProductId] = useState<string>('')
  const [frameProducts, setFrameProducts] = useState<{id: number, name: string, productType: string}[]>([])
  const [saving, setSaving] = useState(false)
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [csvPreview, setCsvPreview] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [masterPartSuggestions, setMasterPartSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [masterPartFound, setMasterPartFound] = useState<any>(null)
  const [searchPerformed, setSearchPerformed] = useState(false)
  const [showGlassModal, setShowGlassModal] = useState(false)
  const [planViews, setPlanViews] = useState<ProductPlanView[]>([])
  const [showPlanViewForm, setShowPlanViewForm] = useState(false)
  const [newPlanViewName, setNewPlanViewName] = useState('')
  const [newPlanViewFile, setNewPlanViewFile] = useState<File | null>(null)
  const [newPlanViewOrientation, setNewPlanViewOrientation] = useState<string>('bottom')
  const [uploadingPlanView, setUploadingPlanView] = useState(false)
  const [showDeletePlanViewModal, setShowDeletePlanViewModal] = useState(false)
  const [deletingPlanViewId, setDeletingPlanViewId] = useState<number | null>(null)
  const [deletingPlanViewName, setDeletingPlanViewName] = useState('')
  const [isDeletingPlanView, setIsDeletingPlanView] = useState(false)
  const [showElevationUpload, setShowElevationUpload] = useState(false)
  const [elevationFile, setElevationFile] = useState<File | null>(null)
  const [uploadingElevation, setUploadingElevation] = useState(false)
  const [editingInstallationPrice, setEditingInstallationPrice] = useState(false)
  const [installationPriceValue, setInstallationPriceValue] = useState('')
  const [savingInstallationPrice, setSavingInstallationPrice] = useState(false)
  const [editingSizeConstraints, setEditingSizeConstraints] = useState(false)
  const [minWidthValue, setMinWidthValue] = useState('')
  const [maxWidthValue, setMaxWidthValue] = useState('')
  const [minHeightValue, setMinHeightValue] = useState('')
  const [maxHeightValue, setMaxHeightValue] = useState('')
  const [savingSizeConstraints, setSavingSizeConstraints] = useState(false)
  // Product Settings (Category & Default Width)
  const [editingProductSettings, setEditingProductSettings] = useState(false)
  const [productCategoryValue, setProductCategoryValue] = useState('')
  const [defaultWidthValue, setDefaultWidthValue] = useState('')
  const [savingProductSettings, setSavingProductSettings] = useState(false)
  // Paired Product inline editing
  const [editingPairedProduct, setEditingPairedProduct] = useState(false)
  const [pairedProductValue, setPairedProductValue] = useState<string>('')
  const [savingPairedProduct, setSavingPairedProduct] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null)
  const [settingStandard, setSettingStandard] = useState(false)
  const [optionBomModalOpen, setOptionBomModalOpen] = useState(false)
  const [editingOptionBom, setEditingOptionBom] = useState<any>(null)
  const [optionBomFormula, setOptionBomFormula] = useState('')
  const [optionBomQuantity, setOptionBomQuantity] = useState('1')
  const [optionBomQuantityMode, setOptionBomQuantityMode] = useState<'FIXED' | 'RANGE'>('FIXED')
  const [optionBomMinQuantity, setOptionBomMinQuantity] = useState('')
  const [optionBomMaxQuantity, setOptionBomMaxQuantity] = useState('')
  const [optionBomDefaultQuantity, setOptionBomDefaultQuantity] = useState('')
  const [optionBomIsMachined, setOptionBomIsMachined] = useState(false)
  const [savingOptionBom, setSavingOptionBom] = useState(false)

  // Determine if this is a Frame product (hide certain sections)
  const isFrameProduct = (productDetails?.productType || product?.productType) === 'FRAME'

  // Delete BOM Part Modal State
  const [showDeletePartModal, setShowDeletePartModal] = useState(false)
  const [deletingPartId, setDeletingPartId] = useState<number | null>(null)
  const [deletingPartName, setDeletingPartName] = useState('')
  const [isDeletingPart, setIsDeletingPart] = useState(false)

  // BOM Sort State
  const [bomSortOption, setBomSortOption] = useState<'partType' | 'partNumber' | 'recentlyAdded'>('partType')

  // Fetch detailed product data including linked categories and plan views
  useEffect(() => {
    async function fetchProductDetails() {
      try {
        const response = await fetch(`/api/products/${product.id}`)
        if (response.ok) {
          const data = await response.json()
          setProductDetails(data)
          setEditName(data.name)
          setEditDescription(data.description || '')
        }
      } catch (error) {
        console.error('Error fetching product details:', error)
      } finally {
        setLoading(false)
      }
    }

    async function fetchPlanViews() {
      try {
        const response = await fetch(`/api/products/${product.id}/plan-views`)
        if (response.ok) {
          const data = await response.json()
          setPlanViews(data)
        }
      } catch (error) {
        console.error('Error fetching plan views:', error)
      }
    }

    async function fetchFrameProducts() {
      try {
        // Fetch all products that can be paired (typically FRAME products)
        const response = await fetch('/api/products')
        if (response.ok) {
          const data = await response.json()
          // Filter to FRAME products only (products that are typically auto-added)
          const frames = data.filter((p: any) => p.productType === 'FRAME' && p.id !== product.id)
          setFrameProducts(frames)
        }
      } catch (error) {
        console.error('Error fetching frame products:', error)
      }
    }

    fetchProductDetails()
    fetchPlanViews()
    fetchFrameProducts()
  }, [product.id])

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: showDeletePartModal, isBlocked: isDeletingPart, onClose: () => { setShowDeletePartModal(false); setDeletingPartId(null); setDeletingPartName('') } },
    { isOpen: showDeletePlanViewModal, isBlocked: isDeletingPlanView, onClose: () => { setShowDeletePlanViewModal(false); setDeletingPlanViewId(null); setDeletingPlanViewName('') } },
    { isOpen: showGlassModal, onClose: () => setShowGlassModal(false) },
    { isOpen: showPlanViewForm, isBlocked: uploadingPlanView, onClose: () => { setShowPlanViewForm(false); setNewPlanViewName(''); setNewPlanViewFile(null) } },
    { isOpen: showElevationUpload, isBlocked: uploadingElevation, onClose: () => { setShowElevationUpload(false); setElevationFile(null) } },
    { isOpen: showLinkCategoryForm, isBlocked: linking, onClose: () => setShowLinkCategoryForm(false) },
    { isOpen: showEditModal, isBlocked: saving, onClose: () => setShowEditModal(false) },
    { isOpen: editingPart !== null, isBlocked: updating, onClose: () => setEditingPart(null) },
  ])

  async function handleSaveProduct() {
    if (!editName.trim()) return
    
    setSaving(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          productType: editProductType,
          pairedProductId: editPairedProductId ? parseInt(editPairedProductId) : null
        })
      })

      if (response.ok) {
        setEditing(false)
        setShowEditModal(false)
        onRefresh()
        showSuccess('Product updated successfully!')
      } else {
        showError('Error updating product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      showError('Error updating product')
    } finally {
      setSaving(false)
    }
  }

  function handleCSVFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file && file.type === 'text/csv') {
      setCsvFile(file)
      parseCSVFile(file)
    } else {
      alert('Please select a valid CSV file')
    }
  }

  function parseCSVFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(line => line.trim() !== '')
      
      if (lines.length === 0) {
        alert('CSV file is empty')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      setCsvHeaders(headers)
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        return row
      })
      
      setCsvPreview(data.slice(0, 5)) // Show first 5 rows for preview
      setShowPreview(true)
    }
    reader.readAsText(file)
  }

  async function handleCSVUpload() {
    if (!csvFile) {
      alert('Please select a CSV file first')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('csvFile', csvFile)
      formData.append('productId', product.id.toString())

      const response = await fetch('/api/product-boms/upload-csv', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Successfully imported ${result.imported} parts from CSV`)
        setShowCSVUpload(false)
        setCsvFile(null)
        setCsvPreview([])
        setCsvHeaders([])
        setShowPreview(false)
        onRefresh()
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to upload CSV')
      }
    } catch (error) {
      console.error('Error uploading CSV:', error)
      alert('Error uploading CSV file')
    } finally {
      setUploading(false)
    }
  }

  async function searchMasterParts(searchTerm: string) {
    if (!searchTerm.trim()) {
      setMasterPartSuggestions([])
      setShowSuggestions(false)
      setMasterPartFound(null)
      setSearchPerformed(false)
      return
    }

    try {
      // Use the enhanced search endpoint that searches across multiple fields
      const response = await fetch(`/api/master-parts?search=${encodeURIComponent(searchTerm)}`)
      if (response.ok) {
        const suggestions = await response.json()
        setMasterPartSuggestions(suggestions)
        setShowSuggestions(suggestions.length > 0)
        setSearchPerformed(true)
        
        // Check for exact part number match first, then exact name match
        const exactPartNumberMatch = suggestions.find((p: any) => 
          p.partNumber.toLowerCase() === searchTerm.toLowerCase()
        )
        const exactNameMatch = suggestions.find((p: any) => 
          p.baseName.toLowerCase() === searchTerm.toLowerCase()
        )
        
        if (exactPartNumberMatch) {
          setMasterPartFound(exactPartNumberMatch)
        } else if (exactNameMatch) {
          setMasterPartFound(exactNameMatch)
        } else {
          setMasterPartFound(null)
        }
      }
    } catch (error) {
      console.error('Error searching master parts:', error)
      setSearchPerformed(true)
    }
  }

  function selectMasterPart(masterPart: any) {
    setNewPartNumber(masterPart.partNumber)
    setMasterPartFound(masterPart)
    setShowSuggestions(false)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleUploadElevation() {
    if (!elevationFile) {
      alert('Please select an elevation image file')
      return
    }

    setUploadingElevation(true)
    try {
      const elevationData = await fileToBase64(elevationFile)

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elevationImageData: elevationData,
          elevationFileName: elevationFile.name
        })
      })

      if (response.ok) {
        alert('Elevation image uploaded successfully!')
        setShowElevationUpload(false)
        setElevationFile(null)
        onRefresh()
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
      } else {
        alert('Failed to upload elevation image')
      }
    } catch (error) {
      console.error('Error uploading elevation image:', error)
      alert('Error uploading elevation image')
    } finally {
      setUploadingElevation(false)
    }
  }

  async function handleAddPlanView(e: React.FormEvent) {
    e.preventDefault()

    const isFixedPanel = product.productType === 'FIXED_PANEL'
    const planViewName = isFixedPanel ? 'Fixed Panel' : newPlanViewName.trim()

    if (!planViewName || !newPlanViewFile) {
      alert('Please provide both a name and an image for the plan view')
      return
    }

    setUploadingPlanView(true)
    try {
      const imageData = await fileToBase64(newPlanViewFile)

      const response = await fetch(`/api/products/${product.id}/plan-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planViewName,
          imageData,
          fileName: newPlanViewFile.name,
          fileType: newPlanViewFile.type,
          orientation: newPlanViewOrientation
        })
      })

      if (response.ok) {
        // Refresh plan views list
        const planViewsResponse = await fetch(`/api/products/${product.id}/plan-views`)
        if (planViewsResponse.ok) {
          const data = await planViewsResponse.json()
          setPlanViews(data)
        }
        setNewPlanViewName('')
        setNewPlanViewFile(null)
        setNewPlanViewOrientation('bottom')
        setShowPlanViewForm(false)
        alert('Plan view added successfully!')
      } else {
        alert('Failed to add plan view')
      }
    } catch (error) {
      console.error('Error adding plan view:', error)
      alert('Error adding plan view')
    } finally {
      setUploadingPlanView(false)
    }
  }

  function handleDeletePlanView(planViewId: number, planViewName: string) {
    setDeletingPlanViewId(planViewId)
    setDeletingPlanViewName(planViewName)
    setShowDeletePlanViewModal(true)
  }

  async function confirmDeletePlanView() {
    if (!deletingPlanViewId) return

    setIsDeletingPlanView(true)
    try {
      const response = await fetch(`/api/products/${product.id}/plan-views/${deletingPlanViewId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh plan views list
        const planViewsResponse = await fetch(`/api/products/${product.id}/plan-views`)
        if (planViewsResponse.ok) {
          const data = await planViewsResponse.json()
          setPlanViews(data)
        }
        setShowDeletePlanViewModal(false)
        setDeletingPlanViewId(null)
        setDeletingPlanViewName('')
      } else {
        alert('Failed to delete plan view')
      }
    } catch (error) {
      console.error('Error deleting plan view:', error)
      alert('Error deleting plan view')
    } finally {
      setIsDeletingPlanView(false)
    }
  }

  function startEditInstallationPrice() {
    setInstallationPriceValue((productDetails?.installationPrice || 0).toString())
    setEditingInstallationPrice(true)
  }

  function cancelEditInstallationPrice() {
    setInstallationPriceValue('')
    setEditingInstallationPrice(false)
  }

  async function handleSaveInstallationPrice() {
    const price = parseFloat(installationPriceValue) || 0

    setSavingInstallationPrice(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installationPrice: price
        })
      })

      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        setEditingInstallationPrice(false)
        onRefresh()
        showSuccess('Installation price updated successfully!')
      } else {
        showError('Failed to update installation price')
      }
    } catch (error) {
      console.error('Error updating installation price:', error)
      showError('Error updating installation price')
    } finally {
      setSavingInstallationPrice(false)
    }
  }

  function startEditSizeConstraints() {
    setMinWidthValue(productDetails?.minWidth?.toString() || '')
    setMaxWidthValue(productDetails?.maxWidth?.toString() || '')
    setMinHeightValue(productDetails?.minHeight?.toString() || '')
    setMaxHeightValue(productDetails?.maxHeight?.toString() || '')
    setEditingSizeConstraints(true)
  }

  function cancelEditSizeConstraints() {
    setMinWidthValue('')
    setMaxWidthValue('')
    setMinHeightValue('')
    setMaxHeightValue('')
    setEditingSizeConstraints(false)
  }

  async function handleSaveSizeConstraints() {
    setSavingSizeConstraints(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minWidth: minWidthValue || null,
          maxWidth: maxWidthValue || null,
          minHeight: minHeightValue || null,
          maxHeight: maxHeightValue || null
        })
      })

      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        setEditingSizeConstraints(false)
        onRefresh()
        showSuccess('Size constraints updated successfully!')
      } else {
        showError('Failed to update size constraints')
      }
    } catch (error) {
      console.error('Error updating size constraints:', error)
      showError('Error updating size constraints')
    } finally {
      setSavingSizeConstraints(false)
    }
  }

  function startEditProductSettings() {
    setProductCategoryValue(productDetails?.productCategory || 'BOTH')
    setDefaultWidthValue(productDetails?.defaultWidth?.toString() || '')
    setEditingProductSettings(true)
  }

  function cancelEditProductSettings() {
    setProductCategoryValue('')
    setDefaultWidthValue('')
    setEditingProductSettings(false)
  }

  async function handleSaveProductSettings() {
    setSavingProductSettings(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCategory: productCategoryValue || 'BOTH',
          defaultWidth: defaultWidthValue || null
        })
      })

      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        setEditingProductSettings(false)
        onRefresh()
        showSuccess('Product settings updated successfully!')
      } else {
        showError('Failed to update product settings')
      }
    } catch (error) {
      console.error('Error updating product settings:', error)
      showError('Error updating product settings')
    } finally {
      setSavingProductSettings(false)
    }
  }

  function startEditPairedProduct() {
    setPairedProductValue(productDetails?.pairedProductId?.toString() || '')
    setEditingPairedProduct(true)
  }

  function cancelEditPairedProduct() {
    setPairedProductValue('')
    setEditingPairedProduct(false)
  }

  async function handleSavePairedProduct() {
    setSavingPairedProduct(true)
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairedProductId: pairedProductValue ? parseInt(pairedProductValue) : null
        })
      })
      if (response.ok) {
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        setEditingPairedProduct(false)
        onRefresh()
        showSuccess('Paired product updated successfully!')
      } else {
        showError('Failed to update paired product')
      }
    } catch (error) {
      console.error('Error updating paired product:', error)
      showError('Error updating paired product')
    } finally {
      setSavingPairedProduct(false)
    }
  }

  async function handleLinkCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCategoryId) return

    setLinking(true)
    try {
      const response = await fetch(`/api/products/${product.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategoryId
        })
      })

      if (response.ok) {
        setSelectedCategoryId('')
        setShowLinkCategoryForm(false)
        // Refresh product details to show the new linked category
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to link category')
      }
    } catch (error) {
      console.error('Error linking category:', error)
      alert('Error linking category')
    } finally {
      setLinking(false)
    }
  }

  async function handleUnlinkCategory(categoryId: number) {
    if (!confirm('Are you sure you want to unlink this category?')) return

    try {
      const response = await fetch(`/api/products/${product.id}/categories?categoryId=${categoryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Refresh product details to remove the unlinked category
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to unlink category')
      }
    } catch (error) {
      console.error('Error unlinking category:', error)
      alert('Error unlinking category')
    }
  }

  async function handleToggleMandatory(categoryId: number, currentValue: boolean) {
    try {
      const response = await fetch(`/api/products/${product.id}/categories/${categoryId}/mandatory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMandatory: !currentValue })
      })

      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        showSuccess(`Category ${!currentValue ? 'marked as mandatory' : 'no longer mandatory'}`)
      } else {
        showError('Failed to update mandatory status')
      }
    } catch (error) {
      console.error('Error toggling mandatory:', error)
      showError('Error updating mandatory status')
    }
  }

  async function handleSetStandard(categoryId: number, optionId: number | null) {
    setSettingStandard(true)
    try {
      const response = await fetch(
        `/api/products/${product.id}/categories/${categoryId}/standard`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ standardOptionId: optionId })
        }
      )
      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        showSuccess(optionId ? 'Standard hardware set!' : 'Standard hardware cleared!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to update standard hardware')
      }
    } catch (error) {
      console.error('Error setting standard:', error)
      showError('Failed to set standard hardware')
    } finally {
      setSettingStandard(false)
    }
  }

  function openOptionBomModal(option: any, existingBom: any) {
    setEditingOptionBom({ option, existingBom })
    setOptionBomFormula(existingBom?.formula || '')
    setOptionBomQuantity(existingBom?.quantity?.toString() || '1')
    setOptionBomQuantityMode(existingBom?.quantityMode || 'FIXED')
    setOptionBomMinQuantity(existingBom?.minQuantity?.toString() || '')
    setOptionBomMaxQuantity(existingBom?.maxQuantity?.toString() || '')
    setOptionBomDefaultQuantity(existingBom?.defaultQuantity?.toString() || '')
    setOptionBomIsMachined(existingBom?.isMilled ?? false)
    setOptionBomModalOpen(true)
  }

  async function handleSaveOptionBom() {
    if (!editingOptionBom?.option) return

    // Validate RANGE mode
    if (optionBomQuantityMode === 'RANGE') {
      if (!optionBomMinQuantity || !optionBomMaxQuantity) {
        showError('RANGE mode requires min and max quantity values')
        return
      }
      const min = parseFloat(optionBomMinQuantity)
      const max = parseFloat(optionBomMaxQuantity)
      if (min >= max) {
        showError('Min quantity must be less than max quantity')
        return
      }
    }

    setSavingOptionBom(true)
    try {
      const method = editingOptionBom.existingBom ? 'PUT' : 'POST'

      const response = await fetch('/api/product-boms', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOptionBom.existingBom?.id,
          productId: product.id,
          optionId: editingOptionBom.option.id,
          partType: 'Extrusion',
          partName: editingOptionBom.option.name,
          partNumber: editingOptionBom.option.partNumber,
          formula: optionBomFormula,
          quantity: parseFloat(optionBomQuantity) || 1,
          unit: 'IN',
          quantityMode: optionBomQuantityMode,
          minQuantity: optionBomQuantityMode === 'RANGE' ? parseFloat(optionBomMinQuantity) : null,
          maxQuantity: optionBomQuantityMode === 'RANGE' ? parseFloat(optionBomMaxQuantity) : null,
          defaultQuantity: optionBomQuantityMode === 'RANGE' && optionBomDefaultQuantity ? parseFloat(optionBomDefaultQuantity) : null,
          isMilled: optionBomIsMachined
        })
      })

      if (response.ok) {
        // Refresh product details
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        setOptionBomModalOpen(false)
        setEditingOptionBom(null)
        showSuccess('Option BOM saved!')
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'Failed to save option BOM')
      }
    } catch (error) {
      console.error('Error saving option BOM:', error)
      showError('Failed to save option BOM')
    } finally {
      setSavingOptionBom(false)
    }
  }

  function toggleCategoryExpand(categoryId: number) {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId)
  }

  async function handleAddPart(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate that a master part is selected
    if (!masterPartFound) {
      alert('Please select an existing part from Master Parts.')
      return
    }

    // For extrusions and CutStock, validate formula and quantity
    if ((masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') && !newPartFormula.trim()) {
      alert('Please enter a length formula for the extrusion/cut stock')
      return
    }
    if ((masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') && !newPartQuantity.trim()) {
      alert('Please enter a quantity for the extrusion/cut stock')
      return
    }
    
    // For hardware and fasteners, validate quantity
    if ((masterPartFound.partType === 'Hardware' || masterPartFound.partType === 'Fastener') && !newPartQuantity.trim()) {
      alert(`Please enter a quantity for the ${masterPartFound.partType.toLowerCase()}`)
      return
    }

    setCreating(true)
    try {
      // Use master part data with appropriate additional fields
      const bomData = {
        productId: product.id,
        partType: masterPartFound.partType,
        partName: masterPartFound.baseName,
        description: masterPartFound.description || null,
        formula: (masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') ? newPartFormula :
                 ((masterPartFound.unit === 'LF' || masterPartFound.unit === 'IN') && newPartFormula ? newPartFormula : null),
        variable: null,
        unit: masterPartFound.unit || 'EA',
        quantity: parseFloat(newPartQuantity),
        stockLength: null,
        partNumber: masterPartFound.partNumber,
        cost: masterPartFound.cost || null,
        isMilled: (masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') ? newPartIsMilled : true,
        addFinishToPartNumber: masterPartFound.partType === 'Hardware' ? (masterPartFound.addFinishToPartNumber || false) : false,
        addToPackingList: masterPartFound.partType === 'Hardware' ? (masterPartFound.addToPackingList || false) : false
      }

      const response = await fetch('/api/product-boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bomData)
      })

      if (response.ok) {
        // Reset form fields
        setNewPartNumber('')
        setNewPartFormula('')
        setNewPartQuantity('')
        setNewPartIsMilled(true)
        setMasterPartFound(null)
        setMasterPartSuggestions([])
        setShowSuggestions(false)
        setSearchPerformed(false)
        onRefresh()
        // Refresh product details to show the new part
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
      }
    } catch (error) {
      console.error('Error adding part:', error)
      alert('Error adding part')
    } finally {
      setCreating(false)
    }
  }

  function startEditPart(part: any) {
    setEditingPart(part.id)
    setEditPartType(part.partType)
    setEditPartName(part.partName)
    setEditPartDescription(part.description || '')
    setEditPartFormula(part.formula || '')
    setEditPartVariable(part.variable || '')
    setEditPartUnit(part.unit || '')
    setEditPartQuantity(part.quantity?.toString() || '')
    setEditPartNumber(part.partNumber || '')
    setEditPartIsMilled(part.isMilled !== false) // Default to true if not set
    setEditPartAddFinish(part.addFinishToPartNumber || false)
    setEditPartAddToPacking(part.addToPackingList || false)
  }

  function cancelEditPart() {
    setEditingPart(null)
    setEditPartType('')
    setEditPartName('')
    setEditPartDescription('')
    setEditPartFormula('')
    setEditPartVariable('')
    setEditPartUnit('')
    setEditPartQuantity('')
    setEditPartNumber('')
    setEditPartIsMilled(true)
  }

  async function handleUpdatePart(e: React.FormEvent) {
    e.preventDefault()
    if (!editPartName.trim() || !editingPart) return

    setUpdating(true)
    try {
      const response = await fetch('/api/product-boms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPart,
          partType: editPartType,
          partName: editPartName,
          description: editPartDescription,
          formula: editPartFormula || null,
          variable: editPartVariable || null,
          unit: editPartUnit || null,
          quantity: editPartQuantity ? parseFloat(editPartQuantity) : null,
          stockLength: null,
          partNumber: editPartNumber || null,
          isMilled: editPartType === 'Extrusion' ? editPartIsMilled : undefined,
          // addFinishToPartNumber and addToPackingList are set from master part, not editable per-product
        })
      })

      if (response.ok) {
        cancelEditPart()
        // Refresh product details to show the updated part
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        onRefresh()
        showSuccess('Part updated successfully!')
      }
    } catch (error) {
      console.error('Error updating part:', error)
      showError('Error updating part')
    } finally {
      setUpdating(false)
    }
  }

  function handleDeletePart(partId: number, partName: string) {
    setDeletingPartId(partId)
    setDeletingPartName(partName)
    setShowDeletePartModal(true)
  }

  async function confirmDeletePart() {
    if (!deletingPartId) return

    setIsDeletingPart(true)
    try {
      const response = await fetch('/api/product-boms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deletingPartId })
      })

      if (response.ok) {
        // Refresh product details to show the updated parts list
        const detailsResponse = await fetch(`/api/products/${product.id}`)
        if (detailsResponse.ok) {
          const data = await detailsResponse.json()
          setProductDetails(data)
        }
        onRefresh()
      } else {
        showError('Error deleting part')
      }
    } catch (error) {
      console.error('Error deleting part:', error)
      showError('Error deleting part')
    } finally {
      setIsDeletingPart(false)
      setShowDeletePartModal(false)
      setDeletingPartId(null)
      setDeletingPartName('')
    }
  }

  function handleExportProduct() {
    // Filter out option-based BOM entries
    const regularBOMs = productDetails?.productBOMs?.filter((b: any) => !b.optionId) || []

    if (regularBOMs.length === 0) {
      showError('No parts to export')
      return
    }

    // Build CSV in the exact same format as the upload expects
    const headers = ['partNumber', 'quantity', 'formula']
    const rows = regularBOMs.map((part: any) => {
      // Escape values that contain commas or quotes
      const escapeCSV = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      return [
        escapeCSV(part.partNumber),
        escapeCSV(part.quantity),
        escapeCSV(part.formula)
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${product.name.replace(/[^a-zA-Z0-9]/g, '_')}_BOM.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    showSuccess(`Exported ${regularBOMs.length} parts to CSV`)
  }

  return (
    <div>
      {/* Back Button - Outside of main content box */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </button>
      </div>

      {/* Main Content Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
            <span className={`px-3 py-1 text-sm rounded-full ${
              productTypeDisplay[product.productType]?.colors || 'bg-gray-100 text-gray-700'
            }`}>
              {productTypeDisplay[product.productType]?.label || product.productType}
            </span>
          </div>
          <p className="text-gray-600">{product.description || 'No description'}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCSVUpload(true)}
            className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm mr-2"
          >
            <Upload className="w-4 h-4 mr-1" />
            Upload CSV
          </button>
          <button
            onClick={() => {
              setEditName(product.name)
              setEditDescription(product.description || '')
              setEditProductType(product.productType || 'SWING_DOOR')
              setEditPairedProductId(productDetails?.pairedProductId?.toString() || '')
              setShowEditModal(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </button>
        </div>
      </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Parts Section */}
          <div className="col-span-full">
            <div className="bg-gray-50 rounded-lg p-6">
          {/* Filter out option-based BOM entries - those should only show in linked categories */}
          {(() => {
            const filteredBOMs = productDetails?.productBOMs?.filter((b: any) => !b.optionId) || []

            // Sort BOMs based on selected sort option
            const typeOrder: Record<string, number> = { 'Extrusion': 1, 'CutStock': 2, 'Hardware': 3, 'Fastener': 4, 'Glass': 5, 'Option': 6 }
            const regularBOMs = [...filteredBOMs].sort((a: any, b: any) => {
              if (bomSortOption === 'partType') {
                // Sort by part type, then alphabetically by part name within groups
                const aOrder = typeOrder[a.partType] || 6
                const bOrder = typeOrder[b.partType] || 6
                if (aOrder !== bOrder) return aOrder - bOrder
                return (a.partName || '').localeCompare(b.partName || '')
              } else if (bomSortOption === 'partNumber') {
                // Sort alphabetically by part number
                return (a.partNumber || '').localeCompare(b.partNumber || '')
              } else {
                // Sort by recently added (newest first) - use id as proxy for creation order
                return (b.id || 0) - (a.id || 0)
              }
            })

            return (
              <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Parts & BOM</h3>
            <div className="flex items-center gap-4">
              <select
                value={bomSortOption}
                onChange={(e) => setBomSortOption(e.target.value as 'partType' | 'partNumber' | 'recentlyAdded')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="partType">Sort: Part Type</option>
                <option value="partNumber">Sort: Part Number</option>
                <option value="recentlyAdded">Sort: Recently Added</option>
              </select>
              <span className="text-sm text-gray-500">
                {regularBOMs.length} parts
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Parts List */}
            <div>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : regularBOMs.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Part Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Formula
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Packing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {regularBOMs.map((part: any) => (
                      <tr key={part.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{part.partName}</div>
                            {part.description && (
                              <div className="text-xs text-gray-500 mt-1">{part.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            part.partType === 'Hardware'
                              ? 'bg-green-100 text-green-700'
                              : part.partType === 'Fastener'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {part.partType === 'CutStock' ? 'Cut Stock' : part.partType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {part.partNumber || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {part.unit || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {part.quantity || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 min-w-[180px] whitespace-nowrap">
                          {part.formula ? (
                            <div className="font-mono text-xs">
                              {renderFormulaWithHighlights(part.formula)}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          {part.partType === 'Hardware' && part.addToPackingList && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">
                              ✓ Included
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => startEditPart(part)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit part"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePart(part.id, part.partName)}
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
              <div className="text-center py-8 text-gray-500">
                <Wrench className="w-8 h-8 mx-auto mb-2" />
                <p>No parts defined for this product yet.</p>
                <p className="text-sm mt-2">Use the form below to add parts.</p>
              </div>
            )}
            </div>
            
            {/* Add Part Form */}
            <div>
              <div className="p-6 bg-white rounded-lg border border-gray-200">
            <h4 className="text-md font-semibold text-gray-900 mb-4">Add Part</h4>
            <form onSubmit={handleAddPart} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Part *</label>
                <input
                  type="text"
                  value={newPartNumber}
                  onChange={(e) => {
                    setNewPartNumber(e.target.value)
                    searchMasterParts(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Search by part number, name, description, or type..."
                  required
                />
                {!masterPartFound && newPartNumber && searchPerformed && masterPartSuggestions.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    ⚠️ Part must exist in Master Parts. Only existing parts can be added.
                  </p>
                )}
                {masterPartFound && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✅ <strong>Found:</strong> {masterPartFound.baseName} ({masterPartFound.partType === 'CutStock' ? 'Cut Stock' : masterPartFound.partType})
                    </p>
                  </div>
                )}
                {showSuggestions && masterPartSuggestions.length > 0 && !masterPartFound && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {masterPartSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => selectMasterPart(suggestion)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900">{suggestion.partNumber}</div>
                        <div className="text-xs text-gray-500">{suggestion.baseName} ({suggestion.partType === 'CutStock' ? 'Cut Stock' : suggestion.partType})</div>
                        {suggestion.description && (
                          <div className="text-xs text-gray-400 truncate">{suggestion.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {masterPartFound && (masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Length Formula *</label>
                    <FormulaInput
                      value={newPartFormula}
                      onChange={setNewPartFormula}
                      placeholder="e.g., Width/4-4.094, height + 2, width * 0.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use width/height variables. See Settings for full reference.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      value={newPartQuantity}
                      onChange={(e) => setNewPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., 2"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="newPartIsMilled"
                      checked={newPartIsMilled}
                      onChange={(e) => setNewPartIsMilled(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="newPartIsMilled" className="text-sm font-medium text-gray-700">
                      Milled
                    </label>
                    <span className="ml-2 text-xs text-gray-500">
                      (This part requires milling)
                    </span>
                  </div>
                </div>
              )}
              
              {masterPartFound && masterPartFound.partType === 'Hardware' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      value={newPartQuantity}
                      onChange={(e) => setNewPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., 2"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  {(masterPartFound.unit === 'LF' || masterPartFound.unit === 'IN') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length Formula</label>
                      <FormulaInput
                        value={newPartFormula}
                        onChange={setNewPartFormula}
                        placeholder="e.g., width + height, (width * 2) + (height * 2)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use width/height variables to calculate length. Leave blank to use fixed quantity.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {masterPartFound && masterPartFound.partType === 'Fastener' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      value={newPartQuantity}
                      onChange={(e) => setNewPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., 2"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  {(masterPartFound.unit === 'LF' || masterPartFound.unit === 'IN') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length Formula</label>
                      <FormulaInput
                        value={newPartFormula}
                        onChange={setNewPartFormula}
                        placeholder="e.g., width + height, (width * 2) + (height * 2)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use width/height variables to calculate length. Leave blank to use fixed quantity.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {masterPartFound && (
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPartNumber('')
                      setNewPartFormula('')
                      setNewPartQuantity('')
                      setNewPartIsMilled(true)
                      setMasterPartFound(null)
                      setMasterPartSuggestions([])
                      setShowSuggestions(false)
                      setSearchPerformed(false)
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !masterPartFound || ((masterPartFound.partType === 'Extrusion' || masterPartFound.partType === 'CutStock') && (!newPartFormula || !newPartQuantity)) || ((masterPartFound.partType === 'Hardware' || masterPartFound.partType === 'Fastener') && !newPartQuantity)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Adding...' : 'Add Part'}
                  </button>
                </div>
              )}
            </form>
              </div>
            </div>
          </div>
              </>
            )
          })()}
        </div>
        </div>

        {/* Glass Size Display Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Glass Size Formulas</h3>
                <button
                  onClick={() => setShowGlassModal(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit Glass Formulas
                </button>
              </div>

              <GlassFormulasDisplay product={productDetails || product} />
            </div>
          </div>
        )}

        {/* Elevation Image Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Elevation View</h3>
                <button
                  onClick={() => setShowElevationUpload(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Upload Elevation
                </button>
              </div>

              {productDetails?.elevationImageData ? (
                <div className="flex items-center space-x-4">
                  <img
                    src={productDetails.elevationImageData}
                    alt="Elevation view"
                    className="w-48 h-48 object-contain border border-gray-300 rounded bg-white"
                  />
                  <div className="text-sm text-gray-600">
                    <p><strong>File:</strong> {productDetails.elevationFileName || 'Unknown'}</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm italic">
                  No elevation image uploaded. Click "Upload Elevation" to add one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Plan Views Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Plan Views</h3>
                <button
                  onClick={() => setShowPlanViewForm(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Plan View
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : planViews.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {planViews.map((planView) => (
                    <div key={planView.id} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{planView.name}</h4>
                        <button
                          onClick={() => handleDeletePlanView(planView.id, planView.name)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete plan view"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <img
                        src={planView.imageData}
                        alt={planView.name}
                        className="w-full h-48 object-contain border border-gray-300 rounded bg-gray-50"
                      />
                      {planView.fileName && (
                        <p className="text-xs text-gray-500 mt-2">{planView.fileName}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                  <p>No plan views defined for this product yet.</p>
                  <p className="text-sm mt-2">Plan views will be used as opening direction options (e.g., Right-In, Right-Out).</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link Categories Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Linked Categories</h3>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500">
                  {productDetails?._count?.productSubOptions || 0} categories
                </span>
                <button
                  onClick={() => setShowLinkCategoryForm(true)}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Link className="w-4 h-4 mr-1" />
                  Link Category
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : productDetails?.productSubOptions?.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Standard Hardware
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Mandatory
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Options
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {productDetails.productSubOptions.map((productSubOption: any) => (
                        <React.Fragment key={productSubOption.id}>
                          <tr
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleCategoryExpand(productSubOption.categoryId)}
                          >
                            <td className="px-6 py-4">
                              {expandedCategory === productSubOption.categoryId ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{productSubOption.category.name}</div>
                              {productSubOption.category.description && (
                                <div className="text-xs text-gray-500">{productSubOption.category.description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {productSubOption.standardOption ? (
                                <div className="flex items-center space-x-2">
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                  <span className="text-sm text-gray-900">{productSubOption.standardOption.name}</span>
                                  <span className="text-xs text-gray-500">(${(productSubOption.standardOption.price ?? 0).toFixed(2)})</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 italic">None set</span>
                              )}
                            </td>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleMandatory(productSubOption.categoryId, productSubOption.isMandatory || false)}
                                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                                  productSubOption.isMandatory
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {productSubOption.isMandatory ? 'Required' : 'Optional'}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-500">
                                {productSubOption.category.individualOptions?.length || 0} options
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleUnlinkCategory(productSubOption.categoryId)
                                }}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Unlink category"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                          {expandedCategory === productSubOption.categoryId && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-gray-700 mb-3">
                                    Select standard hardware for this category:
                                  </div>
                                  {productSubOption.category.individualOptions?.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {productSubOption.category.individualOptions.map((option: any) => {
                                        const isStandard = productSubOption.standardOptionId === option.id
                                        const optionBom = productDetails?.productBOMs?.find((b: any) => b.optionId === option.id)
                                        return (
                                          <div
                                            key={option.id}
                                            className={`p-3 rounded-lg border ${
                                              isStandard
                                                ? 'border-yellow-400 bg-yellow-50'
                                                : option.isCutListItem
                                                  ? 'border-orange-200 bg-orange-50'
                                                  : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                                  {isStandard && (
                                                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                  )}
                                                  <span className="text-sm font-medium text-gray-900">
                                                    {option.name}
                                                  </span>
                                                  {option.isCutListItem && (
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                                      BOM
                                                    </span>
                                                  )}
                                                </div>
                                                {option.description && (
                                                  <div className="text-xs text-gray-500 mt-1">
                                                    {option.description}
                                                  </div>
                                                )}
                                                {option.isCutListItem && optionBom && (
                                                  <div className="text-xs text-orange-600 mt-2 p-2 bg-orange-100 rounded">
                                                    Formula: <code>{optionBom.formula || 'Not set'}</code>
                                                    {optionBom.quantityMode === 'RANGE' ? (
                                                      <span className="ml-2">
                                                        Qty: {optionBom.minQuantity}-{optionBom.maxQuantity}
                                                        {optionBom.defaultQuantity && ` (default: ${optionBom.defaultQuantity})`}
                                                      </span>
                                                    ) : (
                                                      optionBom.quantity && ` × ${optionBom.quantity}`
                                                    )}
                                                    <span className="ml-2 font-medium">
                                                      • {optionBom.isMilled ? 'Machined' : 'Cut'}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="flex flex-col gap-1 ml-2">
                                                {option.isCutListItem && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      openOptionBomModal(option, optionBom)
                                                    }}
                                                    className="px-3 py-1 text-xs rounded-lg bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                                                  >
                                                    Configure
                                                  </button>
                                                )}
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleSetStandard(
                                                      productSubOption.categoryId,
                                                      isStandard ? null : option.id
                                                    )
                                                  }}
                                                  disabled={settingStandard}
                                                  className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                                                    isStandard
                                                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                  } disabled:opacity-50`}
                                                >
                                                  {settingStandard ? '...' : isStandard ? 'Clear' : 'Set Standard'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500 italic">
                                      No options available in this category.
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
              <div className="text-center py-8 text-gray-500">
                <Tag className="w-8 h-8 mx-auto mb-2" />
                <p>No categories linked to this product yet.</p>
                <button
                  onClick={() => setShowLinkCategoryForm(true)}
                  className="text-blue-600 hover:text-blue-700 text-sm mt-2"
                >
                  Link your first category
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Installation Price Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Installation Price</h3>
              {!editingInstallationPrice && (
                <button
                  onClick={startEditInstallationPrice}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit Price
                </button>
              )}
            </div>

            {editingInstallationPrice ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Installation Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={installationPriceValue}
                        onChange={(e) => setInstallationPriceValue(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Base installation cost for this product type
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={cancelEditInstallationPrice}
                      disabled={savingInstallationPrice}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveInstallationPrice}
                      disabled={savingInstallationPrice}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                      {savingInstallationPrice ? (
                        <>
                          <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-900">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-semibold">
                    ${(productDetails?.installationPrice || 0).toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">per unit</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This price will be used for automatic installation cost calculations in quotes when "Per Product Total" method is selected.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Paired Product Section - Hidden for Frame products */}
        {!isFrameProduct && frameProducts.length > 0 && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Paired Product</h3>
                  <p className="text-sm text-gray-500">
                    Auto-add another product when this product is added to an opening
                  </p>
                </div>
                {!editingPairedProduct && (
                  <button
                    onClick={startEditPairedProduct}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>

              {editingPairedProduct ? (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Paired Product</label>
                      <select
                        value={pairedProductValue}
                        onChange={(e) => setPairedProductValue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">None (no paired product)</option>
                        {frameProducts.map((fp) => (
                          <option key={fp.id} value={fp.id}>
                            {fp.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        When this product is added to an opening, the paired product will be automatically added as well using the opening dimensions.
                      </p>
                    </div>
                    <div className="flex justify-end space-x-2 pt-2">
                      <button
                        onClick={cancelEditPairedProduct}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                        disabled={savingPairedProduct}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePairedProduct}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                        disabled={savingPairedProduct}
                      >
                        {savingPairedProduct ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-900">
                  {productDetails?.pairedProduct ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-medium text-blue-600">
                        {productDetails.pairedProduct.name}
                      </span>
                      <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                        {productDetails.pairedProduct.productType.replace('_', ' ')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">No paired product configured</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Settings Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Product Settings</h3>
                  <p className="text-sm text-gray-500">
                    Opening type compatibility and default component dimensions
                  </p>
                </div>
                {!editingProductSettings && (
                  <button
                    onClick={startEditProductSettings}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit Settings
                  </button>
                )}
              </div>

              {editingProductSettings ? (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Category</label>
                        <select
                          value={productCategoryValue}
                          onChange={(e) => setProductCategoryValue(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="BOTH">Both (Thinwall & Trimmed)</option>
                          <option value="THINWALL">Thinwall Only</option>
                          <option value="TRIMMED">Trimmed Only</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Controls which opening types this product appears for
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Default Width (inches)</label>
                        <input
                          type="number"
                          step="0.125"
                          min="0"
                          value={defaultWidthValue}
                          onChange={(e) => setDefaultWidthValue(e.target.value)}
                          placeholder="No default"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Pre-fills width when adding this product as a component
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-2">
                      <button
                        onClick={cancelEditProductSettings}
                        disabled={savingProductSettings}
                        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProductSettings}
                        disabled={savingProductSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                      >
                        {savingProductSettings ? (
                          <>
                            <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Product Category</h4>
                    <span className="text-gray-900">
                      {productDetails?.productCategory === 'THINWALL' ? 'Thinwall Only' :
                       productDetails?.productCategory === 'TRIMMED' ? 'Trimmed Only' :
                       'Both (Thinwall & Trimmed)'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Default Width</h4>
                    <span className="text-gray-900">
                      {productDetails?.defaultWidth ? `${productDetails.defaultWidth}"` : 'None'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Size Constraints Section - Hidden for Frame products */}
        {!isFrameProduct && (
          <div className="col-span-full mt-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Size Constraints</h3>
                  <p className="text-sm text-gray-500">
                    Optional minimum and maximum dimensions for this product type
                  </p>
              </div>
              {!editingSizeConstraints && (
                <button
                  onClick={startEditSizeConstraints}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit Constraints
                </button>
              )}
            </div>

            {editingSizeConstraints ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Width (inches)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                          <input
                            type="number"
                            step="0.125"
                            min="0"
                            value={minWidthValue}
                            onChange={(e) => setMinWidthValue(e.target.value)}
                            placeholder="No min"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                          <input
                            type="number"
                            step="0.125"
                            min="0"
                            value={maxWidthValue}
                            onChange={(e) => setMaxWidthValue(e.target.value)}
                            placeholder="No max"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Height (inches)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                          <input
                            type="number"
                            step="0.125"
                            min="0"
                            value={minHeightValue}
                            onChange={(e) => setMinHeightValue(e.target.value)}
                            placeholder="No min"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                          <input
                            type="number"
                            step="0.125"
                            min="0"
                            value={maxHeightValue}
                            onChange={(e) => setMaxHeightValue(e.target.value)}
                            placeholder="No max"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={cancelEditSizeConstraints}
                      disabled={savingSizeConstraints}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSizeConstraints}
                      disabled={savingSizeConstraints}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                      {savingSizeConstraints ? (
                        <>
                          <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Width</h4>
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-xs text-gray-500">Min:</span>
                      <span className="ml-1 text-gray-900">
                        {productDetails?.minWidth ? `${productDetails.minWidth}"` : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Max:</span>
                      <span className="ml-1 text-gray-900">
                        {productDetails?.maxWidth ? `${productDetails.maxWidth}"` : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Height</h4>
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-xs text-gray-500">Min:</span>
                      <span className="ml-1 text-gray-900">
                        {productDetails?.minHeight ? `${productDetails.minHeight}"` : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Max:</span>
                      <span className="ml-1 text-gray-900">
                        {productDetails?.maxHeight ? `${productDetails.maxHeight}"` : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Export Product Section */}
        <div className="col-span-full mt-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Export Product</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Export all extrusion quantities and formulas as a CSV file. The exported file uses the same format required for importing.
                </p>
              </div>
              {(() => {
                const exportableBOMs = productDetails?.productBOMs?.filter((b: any) => !b.optionId) || []
                return (
                  <button
                    onClick={handleExportProduct}
                    disabled={exportableBOMs.length === 0}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </button>
                )
              })()}
            </div>
            {(() => {
              const exportableBOMs = productDetails?.productBOMs?.filter((b: any) => !b.optionId) || []
              return exportableBOMs.length > 0 ? (
                <p className="text-xs text-gray-500 mt-3">
                  {exportableBOMs.length} part{exportableBOMs.length !== 1 ? 's' : ''} will be exported (partNumber, quantity, formula)
                </p>
              ) : null
            })()}
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Product</h2>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Product name..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Product description..."
                  rows={3}
                />
              </div>
              {/* Hide Product Type dropdown for FRAME products - it's a dedicated unique type */}
              {!isFrameProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                  <select
                    value={editProductType}
                    onChange={(e) => setEditProductType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="SWING_DOOR">Swing Door</option>
                    <option value="SLIDING_DOOR">Sliding Door</option>
                    <option value="FIXED_PANEL">Fixed Panel</option>
                  </select>
                </div>
              )}
              {/* Paired Product - auto-add another product when this one is added (e.g., door adds frame) */}
              {!isFrameProduct && frameProducts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paired Product</label>
                  <select
                    value={editPairedProductId}
                    onChange={(e) => setEditPairedProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="">None (no paired product)</option>
                    {frameProducts.map((fp) => (
                      <option key={fp.id} value={fp.id}>
                        {fp.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    When this product is added to an opening, the paired product will be automatically added as well.
                  </p>
                </div>
              )}
              <div className="border-t pt-4">
                <h3 className="text-md font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setShowLinkCategoryForm(true)
                    }}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center"
                  >
                    <Link className="w-4 h-4 mr-1" />
                    Link Category
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setShowCSVUpload(true)
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Upload Parts
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      onDelete(product)
                    }}
                    className="flex items-center px-4 py-2 text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !editName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Category Modal */}
      {showLinkCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Link Category to {product.name} ({product.withTrim})</h2>
            <form onSubmit={handleLinkCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                >
                  <option value="">Choose a category to link...</option>
                  {categories
                    .filter(category => !productDetails?.productSubOptions?.some((pso: any) => pso.categoryId === category.id))
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category._count.individualOptions} options)
                      </option>
                    ))}
                </select>
                {categories.filter(category => !productDetails?.productSubOptions?.some((pso: any) => pso.categoryId === category.id)).length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">All categories are already linked to this product.</p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLinkCategoryForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking || !selectedCategoryId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {linking ? 'Linking...' : 'Link Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Part Modal */}
      {editingPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Part</h2>
            <form onSubmit={handleUpdatePart} className="space-y-4">
              {editPartType === 'Hardware' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={editPartQuantity}
                      onChange={(e) => setEditPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., 2"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  {(editPartUnit === 'LF' || editPartUnit === 'IN') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Length Formula</label>
                      <FormulaInput
                        value={editPartFormula}
                        onChange={setEditPartFormula}
                        placeholder="e.g., width + 2, height * 0.5"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use "width" and "height" variables (case-insensitive). Supports +, -, *, /, parentheses, and decimal numbers.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {editPartType === 'Extrusion' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Formula</label>
                    <FormulaInput
                      value={editPartFormula}
                      onChange={setEditPartFormula}
                      placeholder="e.g., Width/4-4.094, height + 2, width * 0.5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use "width" and "height" variables (case-insensitive). Supports +, -, *, /, parentheses, and decimal numbers.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={editPartQuantity}
                      onChange={(e) => setEditPartQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="e.g., 2"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="editPartIsMilled"
                      checked={editPartIsMilled}
                      onChange={(e) => setEditPartIsMilled(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="editPartIsMilled" className="text-sm font-medium text-gray-700">
                      Milled
                    </label>
                    <span className="ml-2 text-xs text-gray-500">
                      (This part requires milling)
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={cancelEditPart}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || (editPartType === 'Hardware' && !editPartQuantity) || (editPartType === 'Extrusion' && (!editPartFormula || !editPartQuantity))}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Update Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Option BOM Modal */}
      {optionBomModalOpen && editingOptionBom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Configure BOM for {editingOptionBom.option?.name}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                <input
                  type="text"
                  value={editingOptionBom.option?.partNumber || 'No part number'}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cut Length Formula *</label>
                <FormulaInput
                  value={optionBomFormula}
                  onChange={setOptionBomFormula}
                  placeholder="e.g., height - 8, width / 2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: width, height
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Mode</label>
                <select
                  value={optionBomQuantityMode}
                  onChange={(e) => setOptionBomQuantityMode(e.target.value as 'FIXED' | 'RANGE')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="FIXED">Fixed Quantity</option>
                  <option value="RANGE">User Selectable Range</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {optionBomQuantityMode === 'FIXED'
                    ? 'Quantity is fixed when adding component to opening'
                    : 'User can select quantity from a range when adding component'}
                </p>
              </div>

              {optionBomQuantityMode === 'FIXED' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={optionBomQuantity}
                    onChange={(e) => setOptionBomQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="e.g., 2"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min *</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={optionBomMinQuantity}
                        onChange={(e) => setOptionBomMinQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={optionBomMaxQuantity}
                        onChange={(e) => setOptionBomMaxQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="4"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Default</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={optionBomDefaultQuantity}
                        onChange={(e) => setOptionBomDefaultQuantity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        placeholder="2"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    User will select from {optionBomMinQuantity || '0'} to {optionBomMaxQuantity || '?'} when adding to opening
                  </p>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="optionBomIsMachined"
                  checked={optionBomIsMachined}
                  onChange={(e) => setOptionBomIsMachined(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="optionBomIsMachined" className="text-sm font-medium text-gray-700">
                  Machined
                </label>
                <span className="ml-2 text-xs text-gray-500">
                  (This extrusion requires machining)
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setOptionBomModalOpen(false)
                    setEditingOptionBom(null)
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOptionBom}
                  disabled={
                    savingOptionBom ||
                    !optionBomFormula ||
                    (optionBomQuantityMode === 'FIXED' && !optionBomQuantity) ||
                    (optionBomQuantityMode === 'RANGE' && (!optionBomMinQuantity || !optionBomMaxQuantity))
                  }
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {savingOptionBom ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCSVUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload CSV for {product.name} BOM</h2>
            
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">CSV Format Requirements:</h3>
              <p className="text-sm text-blue-800 mb-2">Your CSV file should include these columns (headers):</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>partNumber</strong>: Part number from Master Parts (required)</li>
                <li>• <strong>quantity</strong>: Quantity needed (required)</li>
                <li>• <strong>formula</strong>: Formula using width/height (for Extrusions only)</li>
              </ul>
              <p className="text-xs text-blue-600 mt-2">
                <strong>Note:</strong> Part details (name, type, cost, etc.) are automatically retrieved from Master Parts using the part number. Download the template for the correct format.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {showPreview && csvPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows):</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-300 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {csvHeaders.map((header, index) => (
                            <th key={index} className="border border-gray-300 px-2 py-1 text-left font-medium text-gray-700">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, index) => (
                          <tr key={index} className="border-b border-gray-300">
                            {csvHeaders.map((header, cellIndex) => (
                              <td key={cellIndex} className="border border-gray-300 px-2 py-1 text-gray-900">
                                {row[header] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowCSVUpload(false)
                  setCsvFile(null)
                  setCsvPreview([])
                  setCsvHeaders([])
                  setShowPreview(false)
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCSVUpload}
                disabled={uploading || !csvFile}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Glass Size Calculator Modal */}
      <GlassSizeCalculatorModal
        product={productDetails || product}
        isOpen={showGlassModal}
        onClose={() => setShowGlassModal(false)}
        onRefresh={onRefresh}
      />

      {/* Elevation Upload Modal */}
      {showElevationUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Upload Elevation View</h3>
              <button
                onClick={() => {
                  setShowElevationUpload(false)
                  setElevationFile(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Elevation Image (SVG/PNG)
                </label>
                <input
                  type="file"
                  accept=".svg,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setElevationFile(file)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                />
                {elevationFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Selected: {elevationFile.name}</p>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowElevationUpload(false)
                    setElevationFile(null)
                  }}
                  disabled={uploadingElevation}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadElevation}
                  disabled={uploadingElevation || !elevationFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {uploadingElevation ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan View Form Modal */}
      {showPlanViewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Plan View</h3>
              <button
                onClick={() => {
                  setShowPlanViewForm(false)
                  setNewPlanViewName('')
                  setNewPlanViewFile(null)
                  setNewPlanViewOrientation('bottom')
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddPlanView} className="space-y-4">
              {product.productType === 'FIXED_PANEL' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan View Name
                  </label>
                  <input
                    type="text"
                    value="Fixed Panel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Fixed Panel products automatically use &quot;Fixed Panel&quot; as the plan view name.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan View Name *
                  </label>
                  <input
                    type="text"
                    value={newPlanViewName}
                    onChange={(e) => setNewPlanViewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="e.g., Right-In, Right-Out, Left-In"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This name will appear as an opening direction option when adding the product to an opening.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plan View Image (SVG/PNG) *
                </label>
                <input
                  type="file"
                  accept=".svg,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setNewPlanViewFile(file)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  required
                />
                {newPlanViewFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Selected: {newPlanViewFile.name}</p>
                )}
              </div>

              {product.productType !== 'FIXED_PANEL' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orientation *
                  </label>
                  <select
                    value={newPlanViewOrientation}
                    onChange={(e) => setNewPlanViewOrientation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  >
                    <option value="bottom">Bottom (align top of PNG with other components)</option>
                    <option value="top">Top (align bottom of PNG with other components)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Choose how this plan view aligns with other components in the opening.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPlanViewForm(false)
                    setNewPlanViewName('')
                    setNewPlanViewFile(null)
                    setNewPlanViewOrientation('bottom')
                  }}
                  disabled={uploadingPlanView}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPlanView || (product.productType !== 'FIXED_PANEL' && !newPlanViewName.trim()) || !newPlanViewFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {uploadingPlanView ? (
                    <>
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Plan View
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Plan View Confirmation Modal */}
      {showDeletePlanViewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete Plan View
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the plan view "<strong>{deletingPlanViewName}</strong>"?
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeletePlanViewModal(false)
                  setDeletingPlanViewId(null)
                  setDeletingPlanViewName('')
                }}
                disabled={isDeletingPlanView}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlanView}
                disabled={isDeletingPlanView}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isDeletingPlanView && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isDeletingPlanView ? 'Deleting...' : 'Delete Plan View'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete BOM Part Confirmation Modal */}
      {showDeletePartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Delete BOM Part
            </h3>

            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete "<strong>{deletingPartName}</strong>" from this product's BOM? This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeletePartModal(false)
                  setDeletingPartId(null)
                  setDeletingPartName('')
                }}
                disabled={isDeletingPart}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePart}
                disabled={isDeletingPart}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingPart ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div> {/* End of main content container */}
    </div>
  )
}
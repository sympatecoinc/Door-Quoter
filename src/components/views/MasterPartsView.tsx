'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Package, Settings, Save, X, Upload, Search, ChevronDown } from 'lucide-react'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'

interface MasterPart {
  id: number
  partNumber: string
  baseName: string
  description?: string
  unit?: string
  cost?: number
  partType: string
  isOption?: boolean
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

export default function MasterPartsView() {
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [activeTab, setActiveTab] = useState<'masterParts' | 'partRules'>('masterParts')
  
  // Current master part for viewing rules
  const [selectedMasterPartId, setSelectedMasterPartId] = useState<number | null>(null)
  const [selectedMasterPart, setSelectedMasterPart] = useState<MasterPart | null>(null)
  
  // Master Parts State
  const [masterParts, setMasterParts] = useState<MasterPart[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'partNumber' | 'baseName' | 'partType' | 'cost'>('newest')
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
  const [cost, setCost] = useState('')
  const [partType, setPartType] = useState('')
  const [isOption, setIsOption] = useState(false)

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

  // Pricing Rule Form State - Hardware parts use direct cost from master part
  const [pricingName, setPricingName] = useState('')
  const [pricingDescription, setPricingDescription] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [formula, setFormula] = useState('')
  const [minQuantity, setMinQuantity] = useState('')
  const [maxQuantity, setMaxQuantity] = useState('')
  const [pricingPartType, setPricingPartType] = useState('Extrusion')
  const [pricingIsActive, setPricingIsActive] = useState(true)

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
        case 'cost':
          const costA = a.cost || 0
          const costB = b.cost || 0
          return costB - costA // Highest cost first
        default:
          return 0
      }
    })

  useEffect(() => {
    fetchMasterParts()
  }, [])

  // Function to calculate price range from pricing rules  
  function getPriceDisplay(part: MasterPart): string {
    // Helper function to format price without unnecessary decimals
    const formatPrice = (price: number): string => {
      return price % 1 === 0 ? price.toString() : price.toFixed(2)
    }

    // For hardware parts, show direct cost
    if (part.partType === 'Hardware') {
      return part.cost ? `$${formatPrice(part.cost)}` : '-'
    }

    // For extrusions with stock length rules, show price range from stock length rules
    if (part.partType === 'Extrusion' && part.stockLengthRules && part.stockLengthRules.length > 0) {
      const prices = part.stockLengthRules
        .filter(rule => rule.basePrice !== null)
        .map(rule => rule.basePrice!)
        .sort((a, b) => a - b)
      
      if (prices.length === 0) {
        return part.cost ? `$${formatPrice(part.cost)}` : '-'
      } else if (prices.length === 1) {
        return `$${formatPrice(prices[0])}`
      } else {
        return `$${formatPrice(prices[0])}-$${formatPrice(prices[prices.length - 1])}`
      }
    }

    // Fallback to direct cost for all other cases
    return part.cost ? `$${formatPrice(part.cost)}` : '-'
  }

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
    setCost('')
    setPartType('')
    setIsOption(false)
  }

  async function handleCreateMasterPart(e: React.FormEvent) {
    e.preventDefault()
    if (!partNumber.trim() || !baseName.trim()) return
    
    // Validate cost for Hardware parts
    if (partType === 'Hardware' && (!cost.trim() || isNaN(parseFloat(cost)))) {
      showError('Hardware parts require a valid cost')
      return
    }
    

    setCreating(true)
    try {
      const response = await fetch('/api/master-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber,
          baseName,
          description,
          unit,
          cost: cost ? parseFloat(cost) : null,
          partType,
          isOption: partType === 'Hardware' ? isOption : false
        })
      })

      if (response.ok) {
        resetPartForm()
        setShowAddPartForm(false)
        fetchMasterParts()
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
    
    // Validate cost for Hardware parts
    if (partType === 'Hardware' && (!cost.trim() || isNaN(parseFloat(cost)))) {
      showError('Hardware parts require a valid cost')
      return
    }
    

    setUpdating(true)
    try {
      const response = await fetch(`/api/master-parts/${editingPart}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber,
          baseName,
          description,
          unit,
          cost: cost ? parseFloat(cost) : null,
          partType,
          isOption: partType === 'Hardware' ? isOption : false
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

  async function handleDeleteMasterPart(id: number) {
    if (!confirm('Are you sure you want to delete this master part?')) return

    try {
      const response = await fetch(`/api/master-parts/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchMasterParts()
        showSuccess('Master part deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting master part:', error)
      showError('Error deleting master part')
    }
  }


  function startEditMasterPart(part: MasterPart) {
    setEditingPart(part.id)
    setPartNumber(part.partNumber)
    setBaseName(part.baseName)
    setDescription(part.description || '')
    setUnit(part.unit || '')
    setCost(part.cost?.toString() || '')
    setPartType(part.partType)
    setIsOption(part.isOption || false)
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
          basePrice: basePrice ? parseFloat(basePrice) : null,
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
          basePrice: basePrice ? parseFloat(basePrice) : null,
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

  async function handleDeleteStockRule(id: number) {
    if (!confirm('Are you sure you want to delete this stock length rule?')) return

    try {
      const response = await fetch(`/api/stock-length-rules/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchStockRules(selectedMasterPartId!)
        showSuccess('Stock length rule deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting stock rule:', error)
      showError('Error deleting stock rule')
    }
  }

  function startEditStockRule(rule: StockLengthRule) {
    setEditingRule(rule.id)
    setRuleName(rule.name)
    setMinHeight(rule.minHeight?.toString() || '')
    setMaxHeight(rule.maxHeight?.toString() || '')
    setStockLength(rule.stockLength?.toString() || '')
    setRulePartType(rule.partType)
    setIsActive(rule.isActive)
    setBasePrice(rule.basePrice?.toString() || '')
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
    setBasePrice('')
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
          basePrice: basePrice ? parseFloat(basePrice) : null,
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
          basePrice: basePrice ? parseFloat(basePrice) : null,
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

  async function handleDeletePricingRule(id: number) {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return

    try {
      const response = await fetch(`/api/pricing-rules/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPricingRules(selectedMasterPartId!)
        showSuccess('Pricing rule deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting pricing rule:', error)
      showError('Error deleting pricing rule')
    }
  }

  function startEditPricingRule(rule: PricingRule) {
    setEditingPricingRule(rule.id)
    setPricingName(rule.name)
    setPricingDescription(rule.description || '')
    setBasePrice(rule.basePrice?.toString() || '')
    setFormula(rule.formula || '')
    setMinQuantity(rule.minQuantity?.toString() || '')
    setMaxQuantity(rule.maxQuantity?.toString() || '')
    setPricingPartType(rule.partType)
    setPricingIsActive(rule.isActive)
  }

  function resetPricingForm() {
    setPricingName('')
    setPricingDescription('')
    setBasePrice('')
    setFormula('')
    setMinQuantity('')
    setMaxQuantity('')
    setPricingPartType('Extrusion') // Default to Extrusion since Hardware parts don't use pricing rules
    setPricingIsActive(true)
  }

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
          {selectedMasterPart && selectedMasterPart.partType !== 'Hardware' && (
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
        </nav>
      </div>

      {/* Master Parts Tab */}
      {activeTab === 'masterParts' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Master Parts Database</h2>
            <div className="flex space-x-3">
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
                    <option value="cost">Cost (High to Low)</option>
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
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredMasterParts.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
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
                        Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMasterParts.map((part) => (
                      <tr key={part.id} className="hover:bg-gray-50">
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
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {part.partType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {part.unit || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {getPriceDisplay(part)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2 justify-end">
                            {part.partType !== 'Hardware' && (
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
                              onClick={() => handleDeleteMasterPart(part.id)}
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
                            Pricing
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
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {rule.basePrice && (
                                <div className="space-y-1">
                                  <div>Base: <span className="font-medium">${rule.basePrice}</span></div>
                                  {rule.formula && (
                                    <div className="text-xs text-gray-600 font-mono">
                                      {rule.formula}
                                    </div>
                                  )}
                                  {(rule.minQuantity || rule.maxQuantity) && (
                                    <div className="text-xs text-gray-600">
                                      Qty: {rule.minQuantity || '∞'} - {rule.maxQuantity || '∞'}
                                    </div>
                                  )}
                                </div>
                              )}
                              {!rule.basePrice && '-'}
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
                                  onClick={() => handleDeleteStockRule(rule.id)}
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

          {/* Pricing Rules for this part - only show for non-extrusion and non-hardware parts */}
          {selectedMasterPart?.partType !== 'Extrusion' && selectedMasterPart?.partType !== 'Hardware' && (
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
                            {rule.basePrice && (
                              <div>Base Price: <span className="font-medium">${rule.basePrice}</span></div>
                            )}
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
                            onClick={() => handleDeletePricingRule(rule.id)}
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
                      setIsOption(false) // Reset isOption for extrusions
                    } else {
                      setUnit('') // Reset unit for other types
                      if (selectedType !== 'Hardware') {
                        setIsOption(false) // Reset isOption for non-hardware types
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select Part Type</option>
                  <option value="Hardware">Hardware</option>
                  <option value="Extrusion">Extrusion</option>
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
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                          <input
                            type="text"
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., EA, LF, SF"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cost ($) *
                            <span className="text-xs text-gray-500 ml-1">(Required for Hardware)</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            required
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
              <div>
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

              {/* Description field removed for extrusions - not needed */}

              {/* Part Length Rule Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Stock length rules now work with calculated part lengths from ProductBOM formulas, 
                  not component dimensions. Set length ranges below based on the actual part lengths your formulas will calculate.
                </p>
              </div>

              {/* Part Length Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Part Length (inches)</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Part Length (inches)</label>
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
                </div>

              {/* Stock Length field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Length *</label>
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

              {/* Price field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g., 25.00"
                  required
                />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="0.00"
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
                    <option value="Other">Other</option>
                  </select>
                </div>
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

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

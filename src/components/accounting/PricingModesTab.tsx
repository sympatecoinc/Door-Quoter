'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Check, X, Star, DollarSign } from 'lucide-react'
import { PricingMode } from '@/types'

export default function PricingModesTab() {
  const [modes, setModes] = useState<PricingMode[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMode, setEditingMode] = useState<PricingMode | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    markup: 0,
    extrusionMarkup: 0,
    hardwareMarkup: 0,
    glassMarkup: 0,
    discount: 0,
    isDefault: false,
    extrusionCostingMethod: 'FULL_STOCK' as 'FULL_STOCK' | 'PERCENTAGE_BASED' | 'HYBRID'
  })

  useEffect(() => {
    fetchModes()
  }, [])

  const fetchModes = async () => {
    try {
      const response = await fetch('/api/pricing-modes')
      if (response.ok) {
        const data = await response.json()
        setModes(data)
      }
    } catch (error) {
      console.error('Error fetching pricing modes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setIsCreating(true)
    setEditingMode(null)
    setFormData({
      name: '',
      description: '',
      markup: 0,
      extrusionMarkup: 0,
      hardwareMarkup: 0,
      glassMarkup: 0,
      discount: 0,
      isDefault: false,
      extrusionCostingMethod: 'FULL_STOCK'
    })
  }

  const handleEdit = (mode: PricingMode) => {
    setEditingMode(mode)
    setIsCreating(false)
    setFormData({
      name: mode.name,
      description: mode.description || '',
      markup: mode.markup,
      extrusionMarkup: mode.extrusionMarkup || 0,
      hardwareMarkup: mode.hardwareMarkup || 0,
      glassMarkup: mode.glassMarkup || 0,
      discount: mode.discount,
      isDefault: mode.isDefault,
      extrusionCostingMethod: (mode.extrusionCostingMethod as 'FULL_STOCK' | 'PERCENTAGE_BASED' | 'HYBRID') || 'FULL_STOCK'
    })
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingMode(null)
    setFormData({
      name: '',
      description: '',
      markup: 0,
      extrusionMarkup: 0,
      hardwareMarkup: 0,
      glassMarkup: 0,
      discount: 0,
      isDefault: false,
      extrusionCostingMethod: 'FULL_STOCK'
    })
  }

  const handleSave = async () => {
    try {
      if (isCreating) {
        // Create new mode
        const response = await fetch('/api/pricing-modes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        if (response.ok) {
          await fetchModes()
          handleCancel()
          alert('Pricing mode created successfully!')
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to create pricing mode')
        }
      } else if (editingMode) {
        // Update existing mode
        const response = await fetch(`/api/pricing-modes/${editingMode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })

        if (response.ok) {
          await fetchModes()
          handleCancel()
          alert('Pricing mode updated successfully!')
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to update pricing mode')
        }
      }
    } catch (error) {
      console.error('Error saving pricing mode:', error)
      alert('Error saving pricing mode')
    }
  }

  const handleDelete = async (mode: PricingMode) => {
    if (!confirm(`Are you sure you want to delete "${mode.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/pricing-modes/${mode.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchModes()
        alert('Pricing mode deleted successfully!')
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete pricing mode')
      }
    } catch (error) {
      console.error('Error deleting pricing mode:', error)
      alert('Error deleting pricing mode')
    }
  }

  const handleSetDefault = async (mode: PricingMode) => {
    try {
      const response = await fetch(`/api/pricing-modes/${mode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mode, isDefault: true })
      })

      if (response.ok) {
        await fetchModes()
        alert('Default pricing mode updated!')
      } else {
        alert('Failed to set default pricing mode')
      }
    } catch (error) {
      console.error('Error setting default:', error)
      alert('Error setting default pricing mode')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Pricing Mode
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingMode) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {isCreating ? 'Create New Pricing Mode' : 'Edit Pricing Mode'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="e.g., Retail, Wholesale, Contractor"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Category-Specific Markups</h4>
                <p className="text-xs text-gray-600 mb-3">Set individual markups for each component type, or use global markup below</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Extrusions (%)
                    </label>
                    <input
                      type="number"
                      value={formData.extrusionMarkup}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        setFormData({
                          ...formData,
                          extrusionMarkup: value,
                          // Clear global markup if setting category-specific
                          markup: value > 0 || formData.hardwareMarkup > 0 || formData.glassMarkup > 0 ? 0 : formData.markup
                        })
                      }}
                      disabled={formData.markup > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="0"
                      min="0"
                      max="1000"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Markup for extrusion parts</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hardware (%)
                    </label>
                    <input
                      type="number"
                      value={formData.hardwareMarkup}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        setFormData({
                          ...formData,
                          hardwareMarkup: value,
                          // Clear global markup if setting category-specific
                          markup: value > 0 || formData.extrusionMarkup > 0 || formData.glassMarkup > 0 ? 0 : formData.markup
                        })
                      }}
                      disabled={formData.markup > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="0"
                      min="0"
                      max="1000"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Markup for hardware parts</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Glass (%)
                    </label>
                    <input
                      type="number"
                      value={formData.glassMarkup}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0
                        setFormData({
                          ...formData,
                          glassMarkup: value,
                          // Clear global markup if setting category-specific
                          markup: value > 0 || formData.extrusionMarkup > 0 || formData.hardwareMarkup > 0 ? 0 : formData.markup
                        })
                      }}
                      disabled={formData.markup > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="0"
                      min="0"
                      max="1000"
                      step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Markup for glass</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Global Markup (%)
                  </label>
                  <input
                    type="number"
                    value={formData.markup}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      setFormData({
                        ...formData,
                        markup: value,
                        // Clear category-specific markups if setting global
                        extrusionMarkup: value > 0 ? 0 : formData.extrusionMarkup,
                        hardwareMarkup: value > 0 ? 0 : formData.hardwareMarkup,
                        glassMarkup: value > 0 ? 0 : formData.glassMarkup
                      })
                    }}
                    disabled={formData.extrusionMarkup > 0 || formData.hardwareMarkup > 0 || formData.glassMarkup > 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0"
                    min="0"
                    max="1000"
                    step="0.1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.extrusionMarkup > 0 || formData.hardwareMarkup > 0 || formData.glassMarkup > 0
                      ? 'Disabled when category markups are set'
                      : 'Applied to all component types'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Percentage (%)
                  </label>
                  <input
                    type="number"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Subtract from final price after markup</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Extrusion Costing Method
              </label>
              <select
                value={formData.extrusionCostingMethod}
                onChange={(e) => setFormData({ ...formData, extrusionCostingMethod: e.target.value as 'FULL_STOCK' | 'PERCENTAGE_BASED' | 'HYBRID' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="FULL_STOCK">Full Stock Cost</option>
                <option value="PERCENTAGE_BASED">Percentage-Based Cost</option>
                <option value="HYBRID">Hybrid Cost</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.extrusionCostingMethod === 'HYBRID'
                  ? 'If ≥50% used: markup on used + cost on remaining. If <50% used: markup on used only'
                  : formData.extrusionCostingMethod === 'PERCENTAGE_BASED'
                    ? 'Only charge for % of stock used when >50% remains unused'
                    : 'Always charge for the full stock length'}
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                Set as default pricing mode for new projects
              </label>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4 mr-2" />
                {isCreating ? 'Create' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modes List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {modes.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pricing Modes</h3>
            <p className="text-gray-600 mb-4">
              Create your first pricing mode to get started
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Pricing Mode
            </button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Markup
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extrusion Costing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Default
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {modes.map((mode) => (
                  <tr key={mode.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{mode.name}</span>
                        {mode.isDefault && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 ml-2" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{mode.description || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{mode.markup}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{mode.discount}%</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        mode.extrusionCostingMethod === 'HYBRID'
                          ? 'bg-purple-100 text-purple-800'
                          : mode.extrusionCostingMethod === 'PERCENTAGE_BASED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {mode.extrusionCostingMethod === 'HYBRID' ? 'Hybrid' : mode.extrusionCostingMethod === 'PERCENTAGE_BASED' ? 'Percentage' : 'Full Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!mode.isDefault && (
                        <button
                          onClick={() => handleSetDefault(mode)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Set as default
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(mode)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(mode)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

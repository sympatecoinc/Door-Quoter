'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Save, X, Edit2, Trash2, DollarSign, AlertCircle } from 'lucide-react'
import { ExtrusionFinishPricing, GlobalSetting } from '@/types'

interface FinishPricingTabProps {
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

// Skeleton row for loading state
function FinishesSkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
    </tr>
  )
}

export default function FinishPricingTab({ showSuccess, showError }: FinishPricingTabProps) {
  // Global Material Price State
  const [materialPricePerLb, setMaterialPricePerLb] = useState<string>('1.50')
  const [editingMaterialPrice, setEditingMaterialPrice] = useState(false)
  const [tempMaterialPrice, setTempMaterialPrice] = useState('')
  const [savingMaterialPrice, setSavingMaterialPrice] = useState(false)

  // Finish Pricing State
  const [finishPricing, setFinishPricing] = useState<ExtrusionFinishPricing[]>([])
  const [loadingFinishPricing, setLoadingFinishPricing] = useState(true)
  const [editingFinishId, setEditingFinishId] = useState<number | null>(null)
  const [editingFinishType, setEditingFinishType] = useState('')
  const [editingFinishCode, setEditingFinishCode] = useState('')
  const [editingCostPerSqFt, setEditingCostPerSqFt] = useState('')

  // Add Finish Form State
  const [showAddFinish, setShowAddFinish] = useState(false)
  const [newFinishType, setNewFinishType] = useState('')
  const [newFinishCode, setNewFinishCode] = useState('')
  const [newCostPerSqFt, setNewCostPerSqFt] = useState('')
  const [addingFinish, setAddingFinish] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteFinishName, setDeleteFinishName] = useState('')

  // Fetch global material price
  const fetchMaterialPrice = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/global?key=materialPricePerLb')
      if (response.ok) {
        const data: GlobalSetting = await response.json()
        setMaterialPricePerLb(data.value)
      }
    } catch (error) {
      console.error('Error fetching material price:', error)
    }
  }, [])

  // Fetch finish pricing
  const fetchFinishPricing = useCallback(async () => {
    setLoadingFinishPricing(true)
    try {
      const response = await fetch('/api/settings/extrusion-finish-pricing')
      if (response.ok) {
        const data = await response.json()
        setFinishPricing(data)
      }
    } catch (error) {
      console.error('Error fetching finish pricing:', error)
      showError('Error fetching finish pricing')
    } finally {
      setLoadingFinishPricing(false)
    }
  }, [showError])

  useEffect(() => {
    fetchMaterialPrice()
    fetchFinishPricing()
  }, [fetchMaterialPrice, fetchFinishPricing])

  // Save material price
  async function handleSaveMaterialPrice() {
    const priceValue = parseFloat(tempMaterialPrice)
    if (isNaN(priceValue) || priceValue < 0) {
      showError('Please enter a valid price per pound')
      return
    }

    setSavingMaterialPrice(true)
    try {
      const response = await fetch('/api/settings/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'materialPricePerLb',
          value: priceValue.toString()
        })
      })

      if (response.ok) {
        setMaterialPricePerLb(priceValue.toString())
        setEditingMaterialPrice(false)
        showSuccess('Material price updated successfully!')
      } else {
        showError('Failed to update material price')
      }
    } catch (error) {
      console.error('Error updating material price:', error)
      showError('Error updating material price')
    } finally {
      setSavingMaterialPrice(false)
    }
  }

  // Add new finish
  async function handleAddFinish() {
    if (!newFinishType.trim()) {
      showError('Please enter a finish type')
      return
    }

    if (!newFinishCode.trim()) {
      showError('Please enter a finish code')
      return
    }

    if (!newCostPerSqFt.trim() || isNaN(parseFloat(newCostPerSqFt))) {
      showError('Please enter a valid cost per sq ft')
      return
    }

    setAddingFinish(true)
    try {
      const response = await fetch('/api/settings/extrusion-finish-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finishType: newFinishType,
          finishCode: newFinishCode.trim(),
          costPerSqFt: parseFloat(newCostPerSqFt)
        })
      })

      if (response.ok) {
        await fetchFinishPricing()
        setShowAddFinish(false)
        setNewFinishType('')
        setNewFinishCode('')
        setNewCostPerSqFt('')
        showSuccess('Finish type added successfully!')
      } else {
        const error = await response.json()
        showError(error.error || 'Failed to add finish type')
      }
    } catch (error) {
      console.error('Error adding finish type:', error)
      showError('Error adding finish type')
    } finally {
      setAddingFinish(false)
    }
  }

  // Update finish
  async function handleUpdateFinish(id: number) {
    try {
      const response = await fetch(`/api/settings/extrusion-finish-pricing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finishType: editingFinishType,
          finishCode: editingFinishCode.trim() || null,
          costPerSqFt: parseFloat(editingCostPerSqFt) || 0
        })
      })

      if (response.ok) {
        await fetchFinishPricing()
        setEditingFinishId(null)
        showSuccess('Finish pricing updated successfully!')
      } else {
        showError('Failed to update finish pricing')
      }
    } catch (error) {
      console.error('Error updating finish pricing:', error)
      showError('Error updating finish pricing')
    }
  }

  // Delete finish
  async function handleDeleteFinish() {
    if (!deletingId) return

    try {
      const response = await fetch(`/api/settings/extrusion-finish-pricing/${deletingId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchFinishPricing()
        showSuccess('Finish type deleted successfully!')
      } else {
        showError('Failed to delete finish type')
      }
    } catch (error) {
      console.error('Error deleting finish type:', error)
      showError('Error deleting finish type')
    } finally {
      setShowDeleteConfirm(false)
      setDeletingId(null)
      setDeleteFinishName('')
    }
  }

  function startEditFinish(finish: ExtrusionFinishPricing) {
    setEditingFinishId(finish.id)
    setEditingFinishType(finish.finishType)
    setEditingFinishCode(finish.finishCode || '')
    setEditingCostPerSqFt(finish.costPerSqFt.toString())
  }

  function confirmDeleteFinish(id: number, name: string) {
    setDeletingId(id)
    setDeleteFinishName(name)
    setShowDeleteConfirm(true)
  }

  return (
    <div className="space-y-6">
      {/* Global Material Price Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Material Price Per Pound</h3>
              <p className="text-sm text-gray-500">
                Global aluminum material cost used to calculate extrusion base prices
              </p>
            </div>
          </div>

          {editingMaterialPrice ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <span className="text-gray-500 mr-1">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tempMaterialPrice}
                  onChange={(e) => setTempMaterialPrice(e.target.value)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-right"
                  autoFocus
                />
                <span className="text-gray-500 ml-1">/lb</span>
              </div>
              <button
                onClick={handleSaveMaterialPrice}
                disabled={savingMaterialPrice}
                className="p-2 text-green-600 hover:text-green-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                onClick={() => setEditingMaterialPrice(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <span className="text-2xl font-semibold text-gray-900">
                ${parseFloat(materialPricePerLb).toFixed(2)}/lb
              </span>
              <button
                onClick={() => {
                  setTempMaterialPrice(materialPricePerLb)
                  setEditingMaterialPrice(true)
                }}
                className="p-2 text-blue-600 hover:text-blue-700"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">How pricing works:</p>
              <p className="mt-1">
                Base Price = Weight Per Foot × Material Price Per Lb
              </p>
              <p className="mt-1">
                Finish Cost = (Perimeter ÷ 12) × Length × Cost Per Sq Ft
              </p>
              <p className="mt-2 text-blue-600">
                Finish is calculated based on surface area (perimeter × length). Set perimeter in Master Parts for each extrusion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Finish Pricing Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Finish Pricing</h2>
            <p className="text-sm text-gray-600 mt-1">
              Additional cost per sq ft for different extrusion finishes
            </p>
          </div>
        </div>

        {loadingFinishPricing ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finish Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finish Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Per Sq Ft</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...Array(4)].map((_, i) => (
                  <FinishesSkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Finish Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Finish Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost Per Sq Ft
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {finishPricing.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No finish types configured. Add one to get started.
                      </td>
                    </tr>
                  ) : (
                    finishPricing.map((finish) => (
                      <tr key={finish.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="text"
                              value={editingFinishType}
                              onChange={(e) => setEditingFinishType(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">{finish.finishType}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="text"
                              value={editingFinishCode}
                              onChange={(e) => setEditingFinishCode(e.target.value)}
                              placeholder="e.g., BL"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900 font-mono">{finish.finishCode || '-'}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingFinishId === finish.id ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingCostPerSqFt}
                              onChange={(e) => setEditingCostPerSqFt(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          ) : (
                            <span className="text-sm text-gray-900">${finish.costPerSqFt.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {editingFinishId === finish.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleUpdateFinish(finish.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingFinishId(null)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditFinish(finish)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => confirmDeleteFinish(finish.id, finish.finishType)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {showAddFinish ? (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Add New Finish Type</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Finish Type *</label>
                    <input
                      type="text"
                      value={newFinishType}
                      onChange={(e) => setNewFinishType(e.target.value)}
                      placeholder="e.g., Powder Coated Black"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Finish Code *</label>
                    <input
                      type="text"
                      value={newFinishCode}
                      onChange={(e) => setNewFinishCode(e.target.value)}
                      placeholder="e.g., BL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Part number suffix</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 mb-1">Cost Per Sq Ft ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newCostPerSqFt}
                      onChange={(e) => setNewCostPerSqFt(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-3">
                  <button
                    onClick={() => {
                      setShowAddFinish(false)
                      setNewFinishType('')
                      setNewFinishCode('')
                      setNewCostPerSqFt('')
                    }}
                    className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddFinish}
                    disabled={addingFinish}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingFinish ? 'Adding...' : 'Add Finish'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddFinish(true)}
                className="mt-4 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Finish Type
              </button>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Finish Type</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-medium">{deleteFinishName}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingId(null)
                  setDeleteFinishName('')
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFinish}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

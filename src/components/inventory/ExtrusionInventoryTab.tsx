'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, Package, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react'
import { ExtrusionVariantGroup, ExtrusionVariantDisplay, ExtrusionFinishPricing } from '@/types'
import ExtrusionVariantCard from './ExtrusionVariantCard'
import ExtrusionVariantEditModal from './ExtrusionVariantEditModal'

interface Summary {
  totalProfiles: number
  totalVariants: number
  lowStockCount: number
  outOfStockCount: number
}

export default function ExtrusionInventoryTab() {
  const [groups, setGroups] = useState<ExtrusionVariantGroup[]>([])
  const [finishes, setFinishes] = useState<ExtrusionFinishPricing[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [materialPricePerLb, setMaterialPricePerLb] = useState<number>(1.5)

  // Filters
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState('all')

  // Modals
  const [editingVariant, setEditingVariant] = useState<ExtrusionVariantDisplay | null>(null)

  // Notification
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(stockStatus !== 'all' && { stockStatus })
      })

      const response = await fetch(`/api/extrusion-variants?${params}`)
      if (!response.ok) throw new Error('Failed to fetch extrusion variants')

      const data = await response.json()
      setGroups(data.groups)
      setFinishes(data.finishes)
      setSummary(data.summary)

      // Fetch global material price
      const priceResponse = await fetch('/api/settings/global?key=materialPricePerLb')
      if (priceResponse.ok) {
        const priceData = await priceResponse.json()
        setMaterialPricePerLb(parseFloat(priceData.value) || 1.5)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [search, stockStatus])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleEditVariant = (variant: ExtrusionVariantDisplay) => {
    setEditingVariant(variant)
  }

  const handleAddVariant = async (masterPartId: number, stockLength: number, finishPricingId: number | null) => {
    try {
      const response = await fetch('/api/extrusion-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPartId,
          stockLength,
          finishPricingId,
          qtyOnHand: 0
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create variant')
      }

      const newVariant = await response.json()
      setNotification({ type: 'success', message: 'Variant created' })

      // Refresh data and open edit modal for the new variant
      await fetchData()

      // Find the newly created variant in the updated groups and open edit modal
      const updatedResponse = await fetch(`/api/extrusion-variants?search=`)
      if (updatedResponse.ok) {
        const data = await updatedResponse.json()
        const group = data.groups.find((g: ExtrusionVariantGroup) => g.masterPart.id === masterPartId)
        if (group) {
          const variant = group.variants.find((v: ExtrusionVariantDisplay) =>
            v.stockLength === stockLength && v.finishPricingId === finishPricingId
          )
          if (variant) {
            setEditingVariant(variant)
          }
        }
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create variant'
      })
    }
  }

  const handleSaveVariant = async (id: number, data: Partial<ExtrusionVariantDisplay>) => {
    const response = await fetch(`/api/extrusion-variants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to save')
    }

    setNotification({ type: 'success', message: 'Variant updated successfully' })
    fetchData()
  }

  const handleDeleteVariant = async (id: number) => {
    const response = await fetch(`/api/extrusion-variants/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete')
    }

    setNotification({ type: 'success', message: 'Variant removed' })
    fetchData()
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalProfiles}</p>
                <p className="text-sm text-gray-500">Extrusion Profiles</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalVariants}</p>
                <p className="text-sm text-gray-500">Total Variants</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{summary.lowStockCount}</p>
                <p className="text-sm text-gray-500">Low Stock</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{summary.outOfStockCount}</p>
                <p className="text-sm text-gray-500">Out of Stock</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={`p-4 rounded-lg ${
            notification.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search extrusions..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Stock Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Stock Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 text-red-700 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Cards Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map(group => (
            <ExtrusionVariantCard
              key={group.masterPart.id}
              group={group}
              finishPricing={finishes}
              materialPricePerLb={materialPricePerLb}
              onEditVariant={handleEditVariant}
              onAddVariant={handleAddVariant}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && groups.length === 0 && (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No extrusion variants found</h3>
          <p className="mt-2 text-gray-500">
            {search || stockStatus !== 'all'
              ? 'Try adjusting your filters.'
              : 'Add stock lengths to extrusion profiles in Master Parts to track inventory.'}
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingVariant && (
        <ExtrusionVariantEditModal
          variant={editingVariant}
          onClose={() => setEditingVariant(null)}
          onSave={handleSaveVariant}
          onDelete={handleDeleteVariant}
        />
      )}
    </div>
  )
}

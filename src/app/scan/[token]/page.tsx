'use client'

import { useState, useEffect, use } from 'react'
import { Search, Plus, Minus, Check, AlertCircle, Package, MapPin } from 'lucide-react'
import { SearchItem, AdjustmentResult } from '@/types/bin-location'

interface BinInfo {
  id: number
  code: string
  name: string
  description: string | null
}

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [binInfo, setBinInfo] = useState<BinInfo | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchItem[]>([])

  // Adjustment state
  const [adjustments, setAdjustments] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch bin info on load
  useEffect(() => {
    const fetchBinInfo = async () => {
      try {
        const response = await fetch(`/api/scan/${token}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Invalid scan code')
        }
        const data = await response.json()
        setBinInfo(data.binLocation)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bin information')
      } finally {
        setLoading(false)
      }
    }

    fetchBinInfo()
  }, [token])

  // Search items
  useEffect(() => {
    const searchItems = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const response = await fetch(`/api/scan/${token}/search?q=${encodeURIComponent(searchQuery)}`)
        if (!response.ok) throw new Error('Search failed')
        const data = await response.json()
        setSearchResults(data.items)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }

    const debounce = setTimeout(searchItems, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, token])

  const getItemKey = (item: SearchItem) => `${item.type}-${item.id}`

  const handleAdjustment = (item: SearchItem, delta: number) => {
    const key = getItemKey(item)
    const current = adjustments[key] || 0
    const newValue = current + delta

    setAdjustments(prev => ({
      ...prev,
      [key]: newValue
    }))
  }

  const setAdjustmentValue = (item: SearchItem, value: number) => {
    const key = getItemKey(item)
    setAdjustments(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSubmit = async () => {
    const itemsToAdjust = searchResults
      .filter(item => adjustments[getItemKey(item)] !== 0 && adjustments[getItemKey(item)] !== undefined)
      .map(item => ({
        type: item.type,
        id: item.id,
        adjustment: adjustments[getItemKey(item)]
      }))

    if (itemsToAdjust.length === 0) {
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/scan/${token}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdjust })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to adjust inventory')
      }

      const data = await response.json()
      const results = data.adjustments as AdjustmentResult[]

      // Update search results with new quantities
      setSearchResults(prev => prev.map(item => {
        const result = results.find(r => r.type === item.type && r.id === item.id)
        if (result) {
          return { ...item, qtyOnHand: result.newQty }
        }
        return item
      }))

      // Clear adjustments
      setAdjustments({})

      // Show success message
      setSuccessMessage(`Updated ${results.length} item${results.length !== 1 ? 's' : ''}`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to adjust inventory')
    } finally {
      setSubmitting(false)
    }
  }

  const hasAdjustments = Object.values(adjustments).some(v => v !== 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !binInfo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Scan Code</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium opacity-80">Bin Location</span>
          </div>
          <h1 className="text-2xl font-bold">{binInfo?.code}</h1>
          <p className="text-blue-100">{binInfo?.name}</p>
          {binInfo?.description && (
            <p className="text-sm text-blue-200 mt-1">{binInfo.description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto p-4">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
            <Check className="h-5 w-5" />
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && binInfo && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              &times;
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>
          {searching && (
            <p className="text-sm text-gray-500 mt-2">Searching...</p>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            {searchResults.map((item) => {
              const key = getItemKey(item)
              const adjustment = adjustments[key] || 0
              const newQty = item.qtyOnHand + adjustment

              return (
                <div key={key} className="bg-white rounded-lg shadow p-4">
                  {/* Item Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.partNumber}</p>
                      <p className="text-sm text-gray-600">{item.name}</p>
                      {item.type === 'extrusion' && (
                        <div className="flex gap-1 mt-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {(item.stockLength || 0) / 12}ft
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            {item.finishType || 'Mill Finish'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Current</p>
                      <p className="text-lg font-semibold text-gray-900">{item.qtyOnHand}</p>
                    </div>
                  </div>

                  {/* Adjustment Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustment(item, -1)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 active:bg-red-300"
                      >
                        <Minus className="h-5 w-5" />
                      </button>

                      <input
                        type="number"
                        value={adjustment}
                        onChange={(e) => setAdjustmentValue(item, parseInt(e.target.value) || 0)}
                        className="w-20 text-center py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />

                      <button
                        onClick={() => handleAdjustment(item, 1)}
                        className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 active:bg-green-300"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>

                    {adjustment !== 0 && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">New Qty</p>
                        <p className={`text-lg font-semibold ${newQty < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {newQty}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty State */}
        {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No items found for &quot;{searchQuery}&quot;</p>
          </div>
        )}

        {/* Initial State */}
        {searchQuery.length < 2 && (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Search for items to adjust inventory</p>
            <p className="text-sm">Enter at least 2 characters</p>
          </div>
        )}
      </div>

      {/* Submit Button (Fixed Bottom) */}
      {hasAdjustments && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  Confirm Adjustments
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Spacer for fixed button */}
      {hasAdjustments && <div className="h-20"></div>}
    </div>
  )
}

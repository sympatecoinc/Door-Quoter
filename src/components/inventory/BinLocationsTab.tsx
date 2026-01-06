'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, Printer, Package, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { BinLocation } from '@/types/bin-location'
import BinLocationModal from './BinLocationModal'
import BinLabelPrintModal from './BinLabelPrintModal'
import BinItemsModal from './BinItemsModal'

interface BinLocationsTabProps {
  onNotification: (type: 'success' | 'error', message: string) => void
}

export default function BinLocationsTab({ onNotification }: BinLocationsTabProps) {
  const [binLocations, setBinLocations] = useState<BinLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Modal states
  const [editingBinLocation, setEditingBinLocation] = useState<BinLocation | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [printingBinLocation, setPrintingBinLocation] = useState<BinLocation | null>(null)
  const [viewingItemsBinLocation, setViewingItemsBinLocation] = useState<BinLocation | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchBinLocations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...(search && { search }),
        ...(!showInactive && { isActive: 'true' })
      })

      const response = await fetch(`/api/bin-locations?${params}`)
      if (!response.ok) throw new Error('Failed to fetch bin locations')

      const data = await response.json()
      setBinLocations(data.binLocations)
    } catch (error) {
      console.error('Error fetching bin locations:', error)
      onNotification('error', 'Failed to load bin locations')
    } finally {
      setLoading(false)
    }
  }, [search, showInactive, onNotification])

  useEffect(() => {
    fetchBinLocations()
  }, [fetchBinLocations])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bin location? Items will be unlinked but not deleted.')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/bin-locations/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete bin location')

      onNotification('success', 'Bin location deleted')
      fetchBinLocations()
    } catch (error) {
      console.error('Error deleting bin location:', error)
      onNotification('error', 'Failed to delete bin location')
    } finally {
      setDeletingId(null)
    }
  }

  const handleModalClose = (saved: boolean) => {
    setIsCreateModalOpen(false)
    setEditingBinLocation(null)
    if (saved) {
      fetchBinLocations()
    }
  }

  // Calculate summary stats
  const totalBins = binLocations.length
  const activeBins = binLocations.filter(b => b.isActive).length
  const totalItems = binLocations.reduce((sum, b) =>
    sum + (b._count?.masterParts || 0) + (b._count?.extrusionVariants || 0), 0
  )

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Bins</p>
              <p className="text-2xl font-semibold text-gray-900">{totalBins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Bins</p>
              <p className="text-2xl font-semibold text-gray-900">{activeBins}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Items with Bins</p>
              <p className="text-2xl font-semibold text-gray-900">{totalItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show inactive
        </label>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Bin Location
        </button>
      </div>

      {/* Bin Locations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bin locations...</div>
        ) : binLocations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search ? 'No bin locations match your search' : 'No bin locations created yet'}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {binLocations.map((bin) => (
                <tr key={bin.id} className={!bin.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-medium text-gray-900">{bin.code}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bin.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {bin.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => setViewingItemsBinLocation(bin)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {(bin._count?.masterParts || 0) + (bin._count?.extrusionVariants || 0)} items
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {bin.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setPrintingBinLocation(bin)}
                        className="text-gray-600 hover:text-blue-600 p-1"
                        title="Print Label"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingBinLocation(bin)}
                        className="text-gray-600 hover:text-blue-600 p-1"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(bin.id)}
                        disabled={deletingId === bin.id}
                        className="text-gray-600 hover:text-red-600 p-1 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {(isCreateModalOpen || editingBinLocation) && (
        <BinLocationModal
          binLocation={editingBinLocation}
          onClose={handleModalClose}
          onNotification={onNotification}
        />
      )}

      {printingBinLocation && (
        <BinLabelPrintModal
          binLocation={printingBinLocation}
          onClose={() => setPrintingBinLocation(null)}
        />
      )}

      {viewingItemsBinLocation && (
        <BinItemsModal
          binLocation={viewingItemsBinLocation}
          onClose={() => setViewingItemsBinLocation(null)}
        />
      )}
    </div>
  )
}

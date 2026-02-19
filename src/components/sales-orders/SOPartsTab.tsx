'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  Package,
  CheckCircle,
  Truck,
  Archive,
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { SalesOrderPart, SOPartStatus, SO_PART_STATUS_CONFIG } from '@/types/sales-order'

interface SOPartsTabProps {
  salesOrderId: number
  onPartUpdate?: () => void
}

interface PartWithAvailability extends SalesOrderPart {
  availability: {
    onHand: number
    reserved: number
    binLocation: string | null
  }
}

interface PartsSummary {
  total: number
  pending: number
  reserved: number
  picked: number
  packed: number
  shipped: number
  cancelled: number
}

export default function SOPartsTab({ salesOrderId, onPartUpdate }: SOPartsTabProps) {
  const [parts, setParts] = useState<PartWithAvailability[]>([])
  const [summary, setSummary] = useState<PartsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [partTypeFilter, setPartTypeFilter] = useState<string>('all')
  const [openingFilter, setOpeningFilter] = useState<string>('all')

  // Group by opening toggle
  const [groupByOpening, setGroupByOpening] = useState(true)
  const [expandedOpenings, setExpandedOpenings] = useState<Set<string>>(new Set())

  // Selection
  const [selectedParts, setSelectedParts] = useState<Set<number>>(new Set())

  // Filter options
  const [filterOptions, setFilterOptions] = useState<{
    openings: string[]
    partTypes: string[]
    statuses: string[]
  }>({ openings: [], partTypes: [], statuses: [] })

  const fetchParts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (partTypeFilter !== 'all') params.append('partType', partTypeFilter)
      if (openingFilter !== 'all') params.append('opening', openingFilter)

      const response = await fetch(`/api/sales-orders/${salesOrderId}/parts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch parts')

      const data = await response.json()
      setParts(data.parts)
      setSummary(data.summary)
      setFilterOptions(data.filters)

      // Expand all openings by default
      if (data.filters.openings) {
        setExpandedOpenings(new Set(data.filters.openings))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch parts')
    } finally {
      setLoading(false)
    }
  }, [salesOrderId, statusFilter, partTypeFilter, openingFilter])

  useEffect(() => {
    fetchParts()
  }, [fetchParts])

  // Filter parts by search term
  const filteredParts = parts.filter(part => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      part.partNumber.toLowerCase().includes(searchLower) ||
      part.partName.toLowerCase().includes(searchLower) ||
      (part.openingName?.toLowerCase() || '').includes(searchLower)
    )
  })

  // Group parts by opening
  const groupedParts = groupByOpening
    ? filteredParts.reduce((acc, part) => {
        const key = part.openingName || 'Ungrouped'
        if (!acc[key]) acc[key] = []
        acc[key].push(part)
        return acc
      }, {} as Record<string, PartWithAvailability[]>)
    : { 'All Parts': filteredParts }

  const toggleOpeningExpand = (opening: string) => {
    setExpandedOpenings(prev => {
      const next = new Set(prev)
      if (next.has(opening)) {
        next.delete(opening)
      } else {
        next.add(opening)
      }
      return next
    })
  }

  const togglePartSelection = (partId: number) => {
    setSelectedParts(prev => {
      const next = new Set(prev)
      if (next.has(partId)) {
        next.delete(partId)
      } else {
        next.add(partId)
      }
      return next
    })
  }

  const selectAllInOpening = (opening: string) => {
    const partsInOpening = groupedParts[opening]?.map(p => p.id) || []
    setSelectedParts(prev => {
      const next = new Set(prev)
      for (const id of partsInOpening) {
        next.add(id)
      }
      return next
    })
  }

  const bulkUpdateStatus = async (status: SOPartStatus) => {
    if (selectedParts.size === 0) return

    try {
      const updates = Array.from(selectedParts).map(partId => ({ partId, status }))

      const response = await fetch(`/api/sales-orders/${salesOrderId}/parts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      if (!response.ok) throw new Error('Failed to bulk update parts')

      setSelectedParts(new Set())
      fetchParts()
      onPartUpdate?.()
    } catch (err) {
      console.error('Error bulk updating parts:', err)
    }
  }

  const getAvailabilityColor = (available: number, required: number) => {
    if (available >= required) return 'text-green-600 bg-green-100'
    if (available > 0) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getStatusBadge = (status: SOPartStatus) => {
    const config = SO_PART_STATUS_CONFIG[status]
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bgColor} ${config.color}`}>
        {config.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading parts...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
        {error}
      </div>
    )
  }

  if (parts.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p>No parts have been generated for this order yet.</p>
        <p className="text-sm mt-1">Confirm the order to generate the parts list from the project BOM.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500">Total Parts</div>
          </div>
          <div className="bg-gray-100 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-600">{summary.pending}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600">{summary.reserved}</div>
            <div className="text-xs text-gray-500">Reserved</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-purple-600">{summary.picked}</div>
            <div className="text-xs text-gray-500">Picked</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-yellow-600">{summary.packed}</div>
            <div className="text-xs text-gray-500">Packed</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600">{summary.shipped}</div>
            <div className="text-xs text-gray-500">Shipped</div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search parts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          {filterOptions.statuses.map(s => (
            <option key={s} value={s}>{SO_PART_STATUS_CONFIG[s as SOPartStatus]?.label || s}</option>
          ))}
        </select>

        {/* Part Type Filter */}
        <select
          value={partTypeFilter}
          onChange={(e) => setPartTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {filterOptions.partTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Opening Filter */}
        <select
          value={openingFilter}
          onChange={(e) => setOpeningFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Openings</option>
          {filterOptions.openings.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        {/* Group Toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={groupByOpening}
            onChange={(e) => setGroupByOpening(e.target.checked)}
            className="rounded border-gray-300"
          />
          Group by Opening
        </label>
      </div>

      {/* Bulk Actions */}
      {selectedParts.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">
            {selectedParts.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => bulkUpdateStatus('PICKED')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <CheckCircle className="w-4 h-4" />
              Pick
            </button>
            <button
              onClick={() => bulkUpdateStatus('PACKED')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <Archive className="w-4 h-4" />
              Pack
            </button>
            <button
              onClick={() => bulkUpdateStatus('SHIPPED')}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Truck className="w-4 h-4" />
              Ship
            </button>
            <button
              onClick={() => setSelectedParts(new Set())}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Parts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={selectedParts.size === filteredParts.length && filteredParts.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedParts(new Set(filteredParts.map(p => p.id)))
                    } else {
                      setSelectedParts(new Set())
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">In Stock</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bin</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(groupedParts).map(([opening, openingParts]) => (
              <Fragment key={opening}>
                {groupByOpening && (
                  <tr
                    key={`header-${opening}`}
                    className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => toggleOpeningExpand(opening)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectAllInOpening(opening)
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td colSpan={8} className="px-3 py-2">
                      <div className="flex items-center gap-2 font-medium text-gray-700">
                        {expandedOpenings.has(opening) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {opening}
                        <span className="text-sm font-normal text-gray-500">
                          ({openingParts.length} parts)
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {(groupByOpening ? expandedOpenings.has(opening) : true) &&
                  openingParts.map(part => (
                    <tr key={part.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedParts.has(part.id)}
                          onChange={() => togglePartSelection(part.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-900">{part.partNumber}</td>
                      <td className="px-3 py-2 text-sm text-gray-600">{part.partName}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{part.partType}</td>
                      <td className="px-3 py-2 text-sm text-right text-gray-900">{part.quantity}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{part.unit}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getAvailabilityColor(part.availability.onHand, part.quantity)}`}>
                          {part.availability.onHand}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">{part.availability.binLocation || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {getStatusBadge(part.status)}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

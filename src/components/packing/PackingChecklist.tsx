'use client'

import { useState, useMemo } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Package,
  Wrench,
  Layers,
  Search
} from 'lucide-react'

interface PackingItem {
  id: number
  openingName: string
  itemType: 'component' | 'hardware' | 'jambkit'
  itemName: string
  partNumber: string | null
  dimensions?: string
  qrData: string
  status: 'pending' | 'packed'
  stickerNumber: number
  packedAt?: string | null
}

interface PackingChecklistProps {
  items: PackingItem[]
  onManualToggle?: (item: PackingItem) => void
}

const itemTypeConfig = {
  component: {
    label: 'Component',
    icon: Package,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    badgeColor: 'bg-blue-100 text-blue-800'
  },
  hardware: {
    label: 'Hardware',
    icon: Wrench,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    badgeColor: 'bg-green-100 text-green-800'
  },
  jambkit: {
    label: 'Jamb Kit',
    icon: Layers,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-800'
  }
}

export default function PackingChecklist({
  items,
  onManualToggle
}: PackingChecklistProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedOpenings, setExpandedOpenings] = useState<Set<string>>(new Set())
  const [showPackedOnly, setShowPackedOnly] = useState(false)
  const [showPendingOnly, setShowPendingOnly] = useState(false)

  // Group items by opening
  const groupedItems = useMemo(() => {
    const groups: Record<string, PackingItem[]> = {}
    for (const item of items) {
      if (!groups[item.openingName]) {
        groups[item.openingName] = []
      }
      groups[item.openingName].push(item)
    }
    return groups
  }, [items])

  // Filter items based on search and filters
  const filteredGroups = useMemo(() => {
    const result: Record<string, PackingItem[]> = {}

    for (const [openingName, openingItems] of Object.entries(groupedItems)) {
      let filtered = openingItems

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          item =>
            item.itemName.toLowerCase().includes(query) ||
            item.partNumber?.toLowerCase().includes(query) ||
            item.openingName.toLowerCase().includes(query) ||
            item.stickerNumber.toString().includes(query)
        )
      }

      // Apply status filter
      if (showPackedOnly) {
        filtered = filtered.filter(item => item.status === 'packed')
      } else if (showPendingOnly) {
        filtered = filtered.filter(item => item.status === 'pending')
      }

      if (filtered.length > 0) {
        result[openingName] = filtered
      }
    }

    return result
  }, [groupedItems, searchQuery, showPackedOnly, showPendingOnly])

  const toggleOpening = (openingName: string) => {
    setExpandedOpenings(prev => {
      const next = new Set(prev)
      if (next.has(openingName)) {
        next.delete(openingName)
      } else {
        next.add(openingName)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedOpenings(new Set(Object.keys(filteredGroups)))
  }

  const collapseAll = () => {
    setExpandedOpenings(new Set())
  }

  const getOpeningStats = (openingItems: PackingItem[]) => {
    const packed = openingItems.filter(i => i.status === 'packed').length
    return { packed, total: openingItems.length }
  }

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return null
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="w-full">
      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowPackedOnly(false)
              setShowPendingOnly(false)
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !showPackedOnly && !showPendingOnly
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => {
              setShowPackedOnly(false)
              setShowPendingOnly(true)
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showPendingOnly
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => {
              setShowPackedOnly(true)
              setShowPendingOnly(false)
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showPackedOnly
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Packed
          </button>

          <div className="flex-1" />

          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Opening Groups */}
      <div className="space-y-3">
        {Object.entries(filteredGroups).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No items match your search</p>
          </div>
        ) : (
          Object.entries(filteredGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([openingName, openingItems]) => {
              const isExpanded = expandedOpenings.has(openingName)
              const stats = getOpeningStats(openingItems)
              const isComplete = stats.packed === stats.total

              return (
                <div
                  key={openingName}
                  className={`border rounded-lg overflow-hidden ${
                    isComplete ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
                  }`}
                >
                  {/* Opening Header */}
                  <button
                    onClick={() => toggleOpening(openingName)}
                    className={`w-full flex items-center justify-between p-3 ${
                      isComplete ? 'bg-green-100' : 'bg-gray-50'
                    } hover:bg-gray-100 transition-colors`}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      )}
                      <span className="font-semibold text-gray-900">{openingName}</span>
                      {isComplete && (
                        <Check className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isComplete ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {stats.packed}/{stats.total}
                      </span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isComplete ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${(stats.packed / stats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Opening Items */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {openingItems.map((item) => {
                        const config = itemTypeConfig[item.itemType]
                        const Icon = config.icon

                        return (
                          <div
                            key={`${item.stickerNumber}-${item.qrData}`}
                            className={`p-3 flex items-center gap-3 ${
                              item.status === 'packed' ? 'bg-green-50/50' : ''
                            }`}
                            onClick={() => onManualToggle?.(item)}
                          >
                            {/* Status indicator */}
                            <div
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                item.status === 'packed'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 text-gray-400'
                              }`}
                            >
                              {item.status === 'packed' ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                <span className="text-xs font-bold">{item.stickerNumber}</span>
                              )}
                            </div>

                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.badgeColor}`}>
                                  <Icon className="h-3 w-3" />
                                  {config.label}
                                </span>
                                <span className="text-xs text-gray-400">
                                  #{item.stickerNumber}
                                </span>
                              </div>
                              <p className={`font-medium truncate ${
                                item.status === 'packed' ? 'text-gray-600' : 'text-gray-900'
                              }`}>
                                {item.itemName}
                              </p>
                              {item.partNumber && (
                                <p className="text-sm text-gray-500 truncate">
                                  {item.partNumber}
                                  {item.dimensions && ` - ${item.dimensions}`}
                                </p>
                              )}
                              {!item.partNumber && item.dimensions && (
                                <p className="text-sm text-gray-500">{item.dimensions}</p>
                              )}
                            </div>

                            {/* Packed time */}
                            {item.status === 'packed' && item.packedAt && (
                              <div className="text-right text-xs text-green-600">
                                {formatTime(item.packedAt)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}

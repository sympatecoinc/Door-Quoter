'use client'

import { useState, useMemo } from 'react'
import {
  Check,
  CheckCircle2,
  Wrench,
  MapPin,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react'

interface AssemblyItem {
  id: string
  partNumber: string
  partName: string
  partType: string | null
  quantity: number
  binLocation: string | null
  openingName: string | null
  productName: string | null
  isCompleted: boolean
  completedAt: string | null
  completedBy?: { id: number; name: string } | null
}

interface AssemblyChecklistProps {
  items: AssemblyItem[]
  onItemToggle: (itemId: string, isCompleted: boolean) => Promise<void>
  onBulkComplete: (itemIds: string[], isCompleted: boolean) => Promise<void>
  disabled?: boolean
}

export default function AssemblyChecklist({
  items,
  onItemToggle,
  onBulkComplete,
  disabled = false
}: AssemblyChecklistProps) {
  const [expandedOpenings, setExpandedOpenings] = useState<Set<string>>(new Set(['all']))
  const [isLoading, setIsLoading] = useState<Set<string>>(new Set())

  // Filter to hardware items (assembly pick list)
  const hardwareItems = useMemo(() => {
    return items.filter(item => item.partType === 'Hardware')
  }, [items])

  // Group by opening
  const itemsByOpening = useMemo(() => {
    return hardwareItems.reduce((acc, item) => {
      const opening = item.openingName || 'General Hardware'
      if (!acc[opening]) acc[opening] = []
      acc[opening].push(item)
      return acc
    }, {} as Record<string, AssemblyItem[]>)
  }, [hardwareItems])

  // Calculate progress
  const progress = useMemo(() => {
    const total = hardwareItems.length
    const completed = hardwareItems.filter(i => i.isCompleted).length
    return {
      total,
      completed,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }, [hardwareItems])

  const handleItemToggle = async (item: AssemblyItem) => {
    if (disabled || isLoading.has(item.id)) return

    setIsLoading(prev => new Set(prev).add(item.id))
    try {
      await onItemToggle(item.id, !item.isCompleted)
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleToggleOpening = (opening: string) => {
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

  const handleCompleteOpening = async (openingItems: AssemblyItem[]) => {
    if (disabled) return
    const incompleteIds = openingItems.filter(i => !i.isCompleted).map(i => i.id)
    if (incompleteIds.length === 0) return

    setIsLoading(new Set(incompleteIds))
    try {
      await onBulkComplete(incompleteIds, true)
    } finally {
      setIsLoading(new Set())
    }
  }

  const handleCompleteAll = async () => {
    if (disabled) return
    const incompleteIds = hardwareItems.filter(i => !i.isCompleted).map(i => i.id)
    if (incompleteIds.length === 0) return

    setIsLoading(new Set(incompleteIds))
    try {
      await onBulkComplete(incompleteIds, true)
    } finally {
      setIsLoading(new Set())
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-500" />
              Hardware Pick List
            </div>
            <div className="flex items-center gap-2">
              <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {progress.completed}/{progress.total} ({progress.percent}%)
              </span>
            </div>
          </div>

          {progress.completed < progress.total && (
            <button
              onClick={handleCompleteAll}
              disabled={disabled}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete All
            </button>
          )}
        </div>
      </div>

      {/* Hardware items by opening */}
      <div className="space-y-3">
        {Object.entries(itemsByOpening).map(([opening, openingItems]) => {
          const isExpanded = expandedOpenings.has(opening) || expandedOpenings.has('all')
          const openingCompleted = openingItems.filter(i => i.isCompleted).length
          const openingTotal = openingItems.length
          const allOpeningCompleted = openingCompleted === openingTotal

          // Get unique products in this opening
          const products = [...new Set(openingItems.map(i => i.productName).filter(Boolean))]

          return (
            <div key={opening} className="bg-white rounded-lg border overflow-hidden">
              {/* Opening header */}
              <div
                onClick={() => handleToggleOpening(opening)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                  <div className="text-left">
                    <div className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-500" />
                      {opening}
                    </div>
                    {products.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {products.slice(0, 2).join(', ')}
                        {products.length > 2 && ` +${products.length - 2} more`}
                      </div>
                    )}
                  </div>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${
                    allOpeningCompleted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {openingCompleted}/{openingTotal}
                  </span>
                </div>

                {!allOpeningCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCompleteOpening(openingItems)
                    }}
                    disabled={disabled}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    Complete All
                  </button>
                )}
              </div>

              {/* Items */}
              {isExpanded && (
                <div className="divide-y">
                  {openingItems.map(item => {
                    const itemLoading = isLoading.has(item.id)

                    return (
                      <div
                        key={item.id}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          item.isCompleted ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleItemToggle(item)}
                            disabled={disabled || itemLoading}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                              item.isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-blue-500'
                            } ${itemLoading ? 'opacity-50' : ''}`}
                          >
                            {item.isCompleted && <Check className="w-4 h-4" />}
                          </button>

                          <div>
                            <div className={`font-medium ${item.isCompleted ? 'text-gray-500 line-through' : ''}`}>
                              {item.partName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span className="font-mono">{item.partNumber}</span>
                              {item.productName && (
                                <>
                                  <span>•</span>
                                  <span>{item.productName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Quantity */}
                          <div className="text-right">
                            <div className={`font-semibold ${item.isCompleted ? 'text-gray-500' : ''}`}>
                              × {item.quantity}
                            </div>
                          </div>

                          {/* Bin location */}
                          {item.binLocation && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              <MapPin className="w-3 h-3" />
                              {item.binLocation}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {hardwareItems.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No hardware items in the pick list.</p>
        </div>
      )}

      {/* Summary */}
      {hardwareItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{progress.total}</div>
              <div className="text-sm text-gray-500">Total Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{Object.keys(itemsByOpening).length}</div>
              <div className="text-sm text-gray-500">Openings</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

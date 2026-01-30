'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Ruler,
  Play,
  Square,
  Timer
} from 'lucide-react'

interface CutListItem {
  id: string
  partNumber: string
  partName: string
  partType: string | null
  quantity: number
  cutLength: number | null
  stockLength: number | null
  binLocation: string | null
  openingName: string | null
  productName: string | null
  isCompleted: boolean
  completedAt: string | null
  completedBy?: { id: number; name: string } | null
  color?: string | null
  metadata?: {
    formula?: string
    isMilled?: boolean
  } | null
  // Timing fields
  startedAt?: string | null
  elapsedSeconds?: number
  startedBy?: { id: number; name: string } | null
}

// Item state derived from timing fields
type ItemState = 'idle' | 'active' | 'paused' | 'completed'

function getItemState(item: CutListItem): ItemState {
  if (item.isCompleted) return 'completed'
  if (item.startedAt) return 'active'
  if ((item.elapsedSeconds ?? 0) > 0) return 'paused'
  return 'idle'
}

// Aggregated item for display (combines items with same part + cut length + color)
interface AggregatedCutItem {
  key: string
  partNumber: string
  partName: string
  stockLength: number | null
  cutLength: number | null
  color: string | null
  totalQuantity: number
  items: CutListItem[] // Original items for completion tracking
  completedCount: number
  isFullyCompleted: boolean
  isPartiallyCompleted: boolean
  // Timing - derived from first item (they should be worked on together)
  state: ItemState
  startedAt: string | null
  elapsedSeconds: number
}

interface CutListChecklistProps {
  items: CutListItem[]
  onItemToggle: (itemId: string, isCompleted: boolean) => Promise<void>
  onBulkComplete: (itemIds: string[], isCompleted: boolean) => Promise<void>
  onItemAction?: (itemId: string, action: 'start' | 'stop' | 'complete' | 'uncomplete') => Promise<void>
  groupBy?: 'partNumber' | 'opening' | 'stockLength'
  disabled?: boolean
  showCompleted?: boolean
}

type GroupByOption = 'partNumber' | 'opening' | 'stockLength'

// Format seconds to MM:SS or HH:MM:SS
function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

// Live timer component for active items
function LiveTimer({ startedAt, baseSeconds }: { startedAt: string; baseSeconds: number }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(startedAt).getTime()

    const updateElapsed = () => {
      const now = Date.now()
      const seconds = Math.floor((now - start) / 1000)
      setElapsed(baseSeconds + seconds)
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [startedAt, baseSeconds])

  return (
    <span className="font-mono text-sm text-orange-600 tabular-nums">
      {formatTime(elapsed)}
    </span>
  )
}

export default function CutListChecklist({
  items,
  onItemToggle,
  onBulkComplete,
  onItemAction,
  groupBy: initialGroupBy = 'partNumber',
  disabled = false,
  showCompleted = true
}: CutListChecklistProps) {
  const [groupBy, setGroupBy] = useState<GroupByOption>(initialGroupBy)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']))
  const [isLoading, setIsLoading] = useState<Set<string>>(new Set())

  // Filter to only extrusion items (cut list items)
  const cutListItems = useMemo(() => {
    return items.filter(item =>
      item.partType === 'Extrusion' || item.partType === 'CutStock'
    )
  }, [items])

  // Aggregate items by part number + cut length + color (consolidate identical cuts)
  const aggregatedItems = useMemo(() => {
    const aggregated: Record<string, AggregatedCutItem> = {}

    for (const item of cutListItems) {
      // Key includes color so different colors aren't combined
      const key = `${item.partNumber}|${item.cutLength ?? 'null'}|${item.stockLength ?? 'null'}|${item.color ?? 'null'}`

      if (!aggregated[key]) {
        aggregated[key] = {
          key,
          partNumber: item.partNumber,
          partName: item.partName,
          stockLength: item.stockLength,
          cutLength: item.cutLength,
          color: item.color || null,
          totalQuantity: 0,
          items: [],
          completedCount: 0,
          isFullyCompleted: false,
          isPartiallyCompleted: false,
          state: 'idle',
          startedAt: null,
          elapsedSeconds: 0
        }
      }

      aggregated[key].totalQuantity += item.quantity
      aggregated[key].items.push(item)
      if (item.isCompleted) {
        aggregated[key].completedCount += item.quantity
      }
    }

    // Calculate completion status and timing for each aggregated item
    for (const agg of Object.values(aggregated)) {
      agg.isFullyCompleted = agg.completedCount === agg.totalQuantity
      agg.isPartiallyCompleted = agg.completedCount > 0 && agg.completedCount < agg.totalQuantity

      // Get timing from first item (they're worked on as a group)
      const firstItem = agg.items[0]
      if (firstItem) {
        agg.state = getItemState(firstItem)
        agg.startedAt = firstItem.startedAt || null
        agg.elapsedSeconds = firstItem.elapsedSeconds ?? 0
      }
    }

    return Object.values(aggregated)
  }, [cutListItems])

  // Group aggregated items based on selected grouping
  const groupedItems = useMemo(() => {
    const groups: Record<string, AggregatedCutItem[]> = {}

    for (const aggItem of aggregatedItems) {
      let key: string

      switch (groupBy) {
        case 'opening':
          // For opening grouping, use the first item's opening (they should all be similar)
          key = aggItem.items[0]?.openingName || 'Unassigned'
          break
        case 'stockLength':
          key = aggItem.stockLength ? `${aggItem.stockLength}" Stock` : 'Unknown Stock'
          break
        case 'partNumber':
        default:
          key = aggItem.partNumber
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(aggItem)
    }

    // Sort items within each group by cut length
    for (const group of Object.values(groups)) {
      group.sort((a, b) => (a.cutLength ?? 0) - (b.cutLength ?? 0))
    }

    return groups
  }, [aggregatedItems, groupBy])

  // Calculate progress
  const progress = useMemo(() => {
    const totalAggregated = aggregatedItems.length
    const completedAggregated = aggregatedItems.filter(i => i.isFullyCompleted).length
    const totalQty = aggregatedItems.reduce((sum, i) => sum + i.totalQuantity, 0)
    const completedQty = aggregatedItems.reduce((sum, i) => sum + i.completedCount, 0)

    return {
      total: totalAggregated,
      completed: completedAggregated,
      totalQty,
      completedQty,
      percent: totalAggregated > 0 ? Math.round((completedAggregated / totalAggregated) * 100) : 0
    }
  }, [aggregatedItems])

  // Handle timing action for aggregated item (affects all underlying items)
  const handleTimingAction = useCallback(async (aggItem: AggregatedCutItem, action: 'start' | 'stop' | 'complete' | 'uncomplete') => {
    if (disabled || !onItemAction) return

    const itemIds = aggItem.items.map(i => i.id)
    const anyLoading = itemIds.some(id => isLoading.has(id))
    if (anyLoading) return

    setIsLoading(prev => new Set([...prev, ...itemIds]))
    try {
      // Apply action to all items in the aggregated group
      await Promise.all(itemIds.map(id => onItemAction(id, action)))
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        itemIds.forEach(id => next.delete(id))
        return next
      })
    }
  }, [disabled, onItemAction, isLoading])

  // Legacy toggle for aggregated items (used by bulk operations)
  const handleAggregatedItemToggle = async (aggItem: AggregatedCutItem) => {
    if (disabled) return

    const itemIds = aggItem.items.map(i => i.id)
    const anyLoading = itemIds.some(id => isLoading.has(id))
    if (anyLoading) return

    // If fully completed, uncomplete all. Otherwise, complete all.
    const shouldComplete = !aggItem.isFullyCompleted

    setIsLoading(prev => new Set([...prev, ...itemIds]))
    try {
      await onBulkComplete(itemIds, shouldComplete)
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        itemIds.forEach(id => next.delete(id))
        return next
      })
    }
  }

  const handleGroupToggle = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  const handleMarkAllComplete = async () => {
    if (disabled) return
    const incompleteIds = cutListItems.filter(i => !i.isCompleted).map(i => i.id)
    if (incompleteIds.length === 0) return

    setIsLoading(new Set(incompleteIds))
    try {
      await onBulkComplete(incompleteIds, true)
    } finally {
      setIsLoading(new Set())
    }
  }

  const handleMarkGroupComplete = async (groupItems: AggregatedCutItem[]) => {
    if (disabled) return
    // Get all underlying item IDs from aggregated items
    const incompleteIds = groupItems
      .flatMap(agg => agg.items)
      .filter(i => !i.isCompleted)
      .map(i => i.id)
    if (incompleteIds.length === 0) return

    setIsLoading(new Set(incompleteIds))
    try {
      await onBulkComplete(incompleteIds, true)
    } finally {
      setIsLoading(new Set())
    }
  }

  const formatLength = (inches: number | null): string => {
    if (!inches) return '-'
    // Always show in inches
    return `${inches.toFixed(3)}"`
  }

  // Render the timing control button based on item state
  const renderTimingControl = (aggItem: AggregatedCutItem) => {
    const anyLoading = aggItem.items.some(i => isLoading.has(i.id))
    const hasTimingSupport = !!onItemAction

    // If no timing support, fall back to simple checkbox
    if (!hasTimingSupport) {
      return (
        <button
          onClick={() => handleAggregatedItemToggle(aggItem)}
          disabled={disabled || anyLoading}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
            aggItem.isFullyCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : aggItem.isPartiallyCompleted
              ? 'bg-yellow-500 border-yellow-500 text-white'
              : 'border-gray-300 hover:border-green-500'
          } ${anyLoading ? 'opacity-50' : ''}`}
        >
          {aggItem.isFullyCompleted && <Check className="w-4 h-4" />}
          {aggItem.isPartiallyCompleted && <span className="text-xs font-bold">~</span>}
        </button>
      )
    }

    // 3-state timing control
    switch (aggItem.state) {
      case 'idle':
        return (
          <button
            onClick={() => handleTimingAction(aggItem, 'start')}
            disabled={disabled || anyLoading}
            title="Start timing"
            className={`w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors ${anyLoading ? 'opacity-50' : ''}`}
          >
            <Play className="w-4 h-4" />
          </button>
        )

      case 'active':
        return (
          <button
            onClick={() => handleTimingAction(aggItem, 'stop')}
            disabled={disabled || anyLoading}
            title="Stop timing"
            className={`w-8 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-colors animate-pulse ${anyLoading ? 'opacity-50' : ''}`}
          >
            <Square className="w-4 h-4" />
          </button>
        )

      case 'paused':
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleTimingAction(aggItem, 'start')}
              disabled={disabled || anyLoading}
              title="Resume timing"
              className={`w-7 h-7 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors ${anyLoading ? 'opacity-50' : ''}`}
            >
              <Play className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleTimingAction(aggItem, 'complete')}
              disabled={disabled || anyLoading}
              title="Mark complete"
              className={`w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors ${anyLoading ? 'opacity-50' : ''}`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        )

      case 'completed':
        return (
          <button
            onClick={() => handleTimingAction(aggItem, 'uncomplete')}
            disabled={disabled || anyLoading}
            title="Undo completion"
            className={`w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center transition-colors ${anyLoading ? 'opacity-50' : ''}`}
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
        )
    }
  }

  // Render the time display based on item state
  const renderTimeDisplay = (aggItem: AggregatedCutItem) => {
    switch (aggItem.state) {
      case 'idle':
        return (
          <span className="text-xs text-gray-400 font-mono">00:00</span>
        )

      case 'active':
        return aggItem.startedAt ? (
          <LiveTimer startedAt={aggItem.startedAt} baseSeconds={aggItem.elapsedSeconds} />
        ) : null

      case 'paused':
        return (
          <span className="text-xs text-gray-600 font-mono">
            {formatTime(aggItem.elapsedSeconds)}
          </span>
        )

      case 'completed':
        return (
          <span className="text-xs text-green-600 font-mono">
            {formatTime(aggItem.elapsedSeconds)}
          </span>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with progress and controls */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold">
              Cut List Progress
            </div>
            <div className="flex items-center gap-2">
              <div className="w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {progress.completed}/{progress.total} items ({progress.percent}%)
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Group by selector */}
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            >
              <option value="partNumber">Group by Part Number</option>
              <option value="opening">Group by Opening</option>
              <option value="stockLength">Group by Stock Length</option>
            </select>

            {/* Mark all complete */}
            {progress.completed < progress.total && (
              <button
                onClick={handleMarkAllComplete}
                disabled={disabled}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark All Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cut list groups */}
      <div className="space-y-3">
        {Object.entries(groupedItems).map(([groupKey, groupItems]) => {
          const isExpanded = expandedGroups.has(groupKey) || expandedGroups.has('all')
          const groupCompleted = groupItems.filter(i => i.isFullyCompleted).length
          const groupTotal = groupItems.length
          const allGroupCompleted = groupCompleted === groupTotal

          return (
            <div key={groupKey} className="bg-white rounded-lg border overflow-hidden">
              {/* Group header */}
              <div
                onClick={() => handleGroupToggle(groupKey)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="font-medium">{groupKey}</span>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${
                    allGroupCompleted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {groupCompleted}/{groupTotal}
                  </span>
                </div>

                {!allGroupCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkGroupComplete(groupItems)
                    }}
                    disabled={disabled}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                  >
                    Complete Group
                  </button>
                )}
              </div>

              {/* Group items */}
              {isExpanded && (
                <div className="divide-y">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-gray-500 uppercase bg-gray-50">
                    <div className="col-span-1"></div>
                    <div className="col-span-1">Time</div>
                    <div className="col-span-2">Part Number</div>
                    <div className="col-span-1">Stock</div>
                    <div className="col-span-4">Part Name</div>
                    <div className="col-span-1 text-center">Qty</div>
                    <div className="col-span-2 text-right">Cut (in)</div>
                  </div>

                  {/* Aggregated Items */}
                  {groupItems.map((aggItem) => {
                    if (!showCompleted && aggItem.isFullyCompleted) return null

                    const stateColors = {
                      idle: '',
                      active: 'bg-orange-50 border-l-4 border-l-orange-500',
                      paused: 'bg-yellow-50',
                      completed: 'bg-green-50'
                    }

                    return (
                      <div
                        key={aggItem.key}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50/50 transition-colors ${stateColors[aggItem.state]}`}
                      >
                        {/* Control button */}
                        <div className="col-span-1">
                          {renderTimingControl(aggItem)}
                        </div>

                        {/* Time display */}
                        <div className="col-span-1 flex items-center gap-1">
                          {aggItem.state === 'active' && (
                            <Timer className="w-3 h-3 text-orange-500 animate-pulse" />
                          )}
                          {renderTimeDisplay(aggItem)}
                        </div>

                        {/* Part Number */}
                        <div className="col-span-2">
                          <span className={`font-mono text-sm ${aggItem.isFullyCompleted ? 'text-gray-500 line-through' : ''}`}>
                            {aggItem.partNumber}
                          </span>
                        </div>

                        {/* Stock Length */}
                        <div className="col-span-1">
                          <span className={`text-sm ${aggItem.isFullyCompleted ? 'text-gray-500' : ''}`}>
                            {aggItem.stockLength ? `${aggItem.stockLength}"` : '-'}
                          </span>
                        </div>

                        {/* Part Name with Color */}
                        <div className="col-span-4">
                          <span className={`text-sm ${aggItem.isFullyCompleted ? 'text-gray-500' : ''}`}>
                            {aggItem.partName}
                            {aggItem.color && (
                              <span className="text-gray-500 ml-1">({aggItem.color})</span>
                            )}
                          </span>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-1 text-center">
                          <span className={`font-medium ${aggItem.isFullyCompleted ? 'text-gray-500' : ''}`}>
                            {aggItem.totalQuantity}
                          </span>
                        </div>

                        {/* Cut Length */}
                        <div className="col-span-2 text-right">
                          <span className={`font-mono text-sm ${aggItem.isFullyCompleted ? 'text-gray-500' : 'text-blue-600'}`}>
                            {formatLength(aggItem.cutLength)}
                          </span>
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
      {aggregatedItems.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <Ruler className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No cut list items found for this work order.</p>
        </div>
      )}

      {/* Summary */}
      {aggregatedItems.length > 0 && (
        <div className="bg-gray-50 rounded-lg border p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{progress.total}</div>
              <div className="text-sm text-gray-500">Cut Types</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{progress.totalQty}</div>
              <div className="text-sm text-gray-500">Total Pieces</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{progress.completedQty}</div>
              <div className="text-sm text-gray-500">Pieces Done</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

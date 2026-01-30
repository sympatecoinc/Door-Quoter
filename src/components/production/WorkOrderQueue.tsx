'use client'

import { useState } from 'react'
import { RefreshCw, Filter, SortAsc, SortDesc } from 'lucide-react'
import WorkOrderCard, { WorkOrderData } from './WorkOrderCard'
import { WorkOrderStage } from '@prisma/client'

interface WorkOrderQueueProps {
  workOrders: WorkOrderData[]
  title?: string
  emptyMessage?: string
  onAdvance?: (workOrderId: string) => Promise<void>
  onMove?: (workOrderId: string, targetStage: WorkOrderStage, reason?: string) => Promise<void>
  onRefresh?: () => void
  isLoading?: boolean
  showFilters?: boolean
  compact?: boolean
}

type SortField = 'priority' | 'timeInStage' | 'dueDate' | 'batchNumber'
type SortDirection = 'asc' | 'desc'

export default function WorkOrderQueue({
  workOrders,
  title = 'Work Orders',
  emptyMessage = 'No work orders in queue',
  onAdvance,
  onMove,
  onRefresh,
  isLoading = false,
  showFilters = true,
  compact = false
}: WorkOrderQueueProps) {
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('priority')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterPriority, setFilterPriority] = useState(false)

  const handleAdvance = async (workOrderId: string) => {
    if (!onAdvance) return
    setAdvancingId(workOrderId)
    try {
      await onAdvance(workOrderId)
    } finally {
      setAdvancingId(null)
    }
  }

  const handleMove = async (workOrderId: string, targetStage: WorkOrderStage, reason?: string) => {
    if (!onMove) return
    await onMove(workOrderId, targetStage, reason)
  }

  // Filter and sort work orders
  let filteredOrders = [...workOrders]

  if (filterPriority) {
    filteredOrders = filteredOrders.filter(wo => wo.priority > 0)
  }

  filteredOrders.sort((a, b) => {
    let comparison = 0
    switch (sortField) {
      case 'priority':
        comparison = a.priority - b.priority
        break
      case 'timeInStage':
        comparison = (a.timeInStageMins || 0) - (b.timeInStageMins || 0)
        break
      case 'dueDate':
        const dateA = a.project.dueDate ? new Date(a.project.dueDate).getTime() : Infinity
        const dateB = b.project.dueDate ? new Date(b.project.dueDate).getTime() : Infinity
        comparison = dateA - dateB
        break
      case 'batchNumber':
        comparison = a.batchNumber - b.batchNumber
        break
    }
    return sortDirection === 'desc' ? -comparison : comparison
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = sortDirection === 'desc' ? SortDesc : SortAsc

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <span className="px-2 py-0.5 text-sm font-medium bg-gray-100 text-gray-600 rounded-full">
            {filteredOrders.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Filters and Sort */}
      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterPriority(!filterPriority)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filterPriority
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Priority Only
          </button>

          <div className="h-6 border-l border-gray-200 mx-1" />

          <span className="text-xs text-gray-500 uppercase">Sort:</span>
          {(['priority', 'timeInStage', 'dueDate', 'batchNumber'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                sortField === field
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              {field === 'priority' && 'Priority'}
              {field === 'timeInStage' && 'Time'}
              {field === 'dueDate' && 'Due Date'}
              {field === 'batchNumber' && 'Batch'}
              {sortField === field && <SortIcon className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}

      {/* Work Order List */}
      {isLoading && workOrders.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-lg border p-4 animate-pulse">
              <div className="h-5 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(workOrder => (
            <WorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              onAdvance={onAdvance ? () => handleAdvance(workOrder.id) : undefined}
              onMove={onMove ? (stage, reason) => handleMove(workOrder.id, stage, reason) : undefined}
              isAdvancing={advancingId === workOrder.id}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}

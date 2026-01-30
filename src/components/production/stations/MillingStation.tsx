'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Cpu,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Package,
  AlertCircle
} from 'lucide-react'
import MillingChecklist from '../MillingChecklist'
import CallManagerButton from '../CallManagerButton'
import { WorkOrderStage } from '@prisma/client'

interface WorkOrderData {
  id: string
  batchNumber: number
  currentStage: WorkOrderStage
  priority: number
  notes: string | null
  createdAt: string
  project: {
    id: number
    name: string
    productionColor: string | null
    customer?: {
      id: number
      companyName: string
    } | null
  }
}

interface WorkOrderItem {
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
  programName?: string
  metadata?: any
  // Timing fields
  startedAt?: string | null
  elapsedSeconds?: number
  startedBy?: { id: number; name: string } | null
}

interface StageHistory {
  id: string
  stage: WorkOrderStage
  enteredAt: string
  exitedAt: string | null
  startedAt: string | null
  startedBy?: { id: number; name: string } | null
}

interface StageCounts {
  [key: string]: number
}

export default function MillingStation() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderData | null>(null)
  const [workOrderItems, setWorkOrderItems] = useState<WorkOrderItem[]>([])
  const [currentStageHistory, setCurrentStageHistory] = useState<StageHistory | null>(null)
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch work orders at this station
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/work-orders/station/milling')
      if (!response.ok) throw new Error('Failed to fetch work orders')
      const data = await response.json()
      setWorkOrders(data.workOrders || [])
      setStageCounts(data.allStageCounts || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch station data for selected work order
  const fetchWorkOrderData = useCallback(async (workOrderId: string) => {
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/station-data?station=MILLING`)
      if (!response.ok) throw new Error('Failed to fetch work order data')
      const data = await response.json()
      // Use station data milling items which include program names
      setWorkOrderItems(data.stationData?.millingItems || data.items || [])
      setCurrentStageHistory(data.currentStageHistory || null)
    } catch (err) {
      console.error('Error fetching work order data:', err)
    }
  }, [])

  useEffect(() => {
    fetchWorkOrders()
    const interval = setInterval(fetchWorkOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchWorkOrders])

  useEffect(() => {
    if (selectedWorkOrder) {
      fetchWorkOrderData(selectedWorkOrder.id)
    }
  }, [selectedWorkOrder, fetchWorkOrderData])

  const handleSelectWorkOrder = (wo: WorkOrderData) => {
    setSelectedWorkOrder(wo)
  }

  const handleBackToQueue = () => {
    setSelectedWorkOrder(null)
    setWorkOrderItems([])
    setCurrentStageHistory(null)
  }

  const handleItemToggle = async (itemId: string, isCompleted: boolean) => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted })
      })
      if (!response.ok) throw new Error('Failed to update item')
      const updatedItem = await response.json()

      // Update local state
      setWorkOrderItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  // Handle timing actions for individual items
  const handleItemAction = async (itemId: string, action: 'start' | 'stop' | 'complete' | 'uncomplete') => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      if (!response.ok) throw new Error('Failed to update item')
      const updatedItem = await response.json()

      // Update local state
      setWorkOrderItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  const handleBulkComplete = async (itemIds: string[], isCompleted: boolean) => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/bulk-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds,
          action: isCompleted ? 'complete' : 'uncomplete'
        })
      })
      if (!response.ok) throw new Error('Failed to bulk update items')
      // Refresh data to get updated items with program names
      await fetchWorkOrderData(selectedWorkOrder.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update items')
    }
  }

  const handleAdvanceToAssembly = async () => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/advance`, {
        method: 'POST'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to advance')
      }
      // Refresh and go back to queue
      await fetchWorkOrders()
      handleBackToQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance')
    }
  }

  // Calculate progress - only count milled items
  const milledItems = workOrderItems.filter(i => {
    const meta = i.metadata as Record<string, any> | null
    return meta?.isMilled === true
  })
  const completedItems = milledItems.filter(i => i.isCompleted)
  const progressPercent = milledItems.length > 0
    ? Math.round((completedItems.length / milledItems.length) * 100)
    : 0

  // Navigation tabs
  const allStages: { stage: WorkOrderStage; label: string; path: string }[] = [
    { stage: 'STAGED', label: 'Staged', path: '/production/staged' },
    { stage: 'CUTTING', label: 'Cutting', path: '/production/cutting' },
    { stage: 'MILLING', label: 'Milling', path: '/production/milling' },
    { stage: 'ASSEMBLY', label: 'Assembly', path: '/production/assembly' },
    { stage: 'QC', label: 'QC', path: '/production/qc' },
    { stage: 'SHIP', label: 'Shipping', path: '/production/shipping' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-violet-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => selectedWorkOrder ? handleBackToQueue() : router.push('/production')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Cpu className="w-6 h-6" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {selectedWorkOrder
                      ? `Milling - ${selectedWorkOrder.project.name}`
                      : 'Milling Station'
                    }
                  </h1>
                  <p className="text-sm opacity-90">
                    {selectedWorkOrder
                      ? `Batch ${selectedWorkOrder.batchNumber}`
                      : `${workOrders.length} work order${workOrders.length !== 1 ? 's' : ''} in queue`
                    }
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={fetchWorkOrders}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stage tabs */}
        {!selectedWorkOrder && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {allStages.map(({ stage, label, path }) => (
                <button
                  key={stage}
                  onClick={() => router.push(path)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    stage === 'MILLING'
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {label}
                  {stageCounts[stage] > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      stage === 'MILLING' ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
                    }`}>
                      {stageCounts[stage]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              Dismiss
            </button>
          </div>
        )}

        {selectedWorkOrder ? (
          /* Selected work order view */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content - Milling list */}
            <div className="lg:col-span-2">
              <MillingChecklist
                items={workOrderItems}
                onItemToggle={handleItemToggle}
                onBulkComplete={handleBulkComplete}
                onItemAction={handleItemAction}
              />
            </div>

            {/* Sidebar - Progress and actions */}
            <div className="space-y-4">
              {/* Project color indicator */}
              {selectedWorkOrder.project.productionColor && (
                <div
                  className="h-4 rounded-t-lg"
                  style={{ backgroundColor: selectedWorkOrder.project.productionColor }}
                />
              )}

              {/* Progress */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Progress</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Parts Milled</span>
                    <span className="font-medium">{completedItems.length} / {milledItems.length}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-center text-2xl font-bold text-gray-900">
                    {progressPercent}%
                  </div>
                </div>
              </div>

              {/* Send to Assembly */}
              <button
                onClick={handleAdvanceToAssembly}
                disabled={progressPercent < 100}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
                  progressPercent >= 100
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <Package className="w-5 h-5" />
                Send to Assembly
                <ChevronRight className="w-5 h-5" />
              </button>

              {progressPercent < 100 && (
                <p className="text-xs text-center text-gray-500">
                  Complete all milled parts to advance
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Work order queue */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
              <p className="text-sm text-gray-600">Select a work order to start milling</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <Cpu className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No work orders</h3>
                <p className="text-gray-600">No work orders are ready for milling</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => handleSelectWorkOrder(wo)}
                    className="bg-white rounded-lg border p-4 text-left hover:border-violet-500 hover:shadow-md transition-all"
                  >
                    {/* Color stripe */}
                    {wo.project.productionColor && (
                      <div
                        className="h-2 -mx-4 -mt-4 mb-3 rounded-t-lg"
                        style={{ backgroundColor: wo.project.productionColor }}
                      />
                    )}

                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{wo.project.name}</h3>
                        {wo.project.customer && (
                          <p className="text-sm text-gray-600">{wo.project.customer.companyName}</p>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded">
                        Batch {wo.batchNumber}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Cpu className="w-4 h-4" />
                      Ready for milling
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Manager Button */}
      <CallManagerButton
        stationName="Milling"
        workOrderInfo={selectedWorkOrder ? {
          id: selectedWorkOrder.id,
          projectName: selectedWorkOrder.project.name,
          batchNumber: selectedWorkOrder.batchNumber
        } : null}
      />
    </div>
  )
}

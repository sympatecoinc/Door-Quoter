'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Package,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  ClipboardCheck,
  AlertCircle,
  Undo2,
  ScanLine,
  Wrench
} from 'lucide-react'
import WorkOrderTimer from '../WorkOrderTimer'
import ReceivingVerification from '../ReceivingVerification'
import AssemblyChecklist from '../AssemblyChecklist'
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
  isReceived: boolean
  receivedAt: string | null
  receivedBy?: { id: number; name: string } | null
  receivingNotes: string | null
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

type TabType = 'receiving' | 'assembly'

export default function AssemblyStation() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderData | null>(null)
  const [workOrderItems, setWorkOrderItems] = useState<WorkOrderItem[]>([])
  const [currentStageHistory, setCurrentStageHistory] = useState<StageHistory | null>(null)
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('receiving')
  const [showReworkModal, setShowReworkModal] = useState(false)
  const [reworkReason, setReworkReason] = useState('')

  // Fetch work orders at this station
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/work-orders/station/assembly')
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
      const response = await fetch(`/api/work-orders/${workOrderId}/station-data?station=ASSEMBLY`)
      if (!response.ok) throw new Error('Failed to fetch work order data')
      const data = await response.json()
      setWorkOrderItems(data.items || [])
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
    setActiveTab('receiving')
  }

  const handleBackToQueue = () => {
    setSelectedWorkOrder(null)
    setWorkOrderItems([])
    setCurrentStageHistory(null)
    setActiveTab('receiving')
  }

  const handleItemReceive = async (itemId: string, isReceived: boolean, notes?: string) => {
    if (!selectedWorkOrder) return
    try {
      const body: any = { isReceived }
      if (notes) body.receivingNotes = notes

      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error('Failed to update item')
      const updatedItem = await response.json()

      setWorkOrderItems(prev =>
        prev.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    }
  }

  const handleBulkReceive = async (itemIds: string[], isReceived: boolean) => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/bulk-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds,
          action: isReceived ? 'receive' : 'unreceive'
        })
      })
      if (!response.ok) throw new Error('Failed to bulk update items')
      const data = await response.json()
      setWorkOrderItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update items')
    }
  }

  const handleItemComplete = async (itemId: string, isCompleted: boolean) => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted })
      })
      if (!response.ok) throw new Error('Failed to update item')
      const updatedItem = await response.json()

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
      const data = await response.json()
      setWorkOrderItems(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update items')
    }
  }

  const handleAdvanceToQC = async () => {
    if (!selectedWorkOrder) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/advance`, {
        method: 'POST'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to advance')
      }
      await fetchWorkOrders()
      handleBackToQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance')
    }
  }

  const handleRequestRework = async () => {
    if (!selectedWorkOrder || !reworkReason.trim()) return
    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage: 'CUTTING',
          reason: `[REWORK] ${reworkReason}`
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to request rework')
      }
      setShowReworkModal(false)
      setReworkReason('')
      await fetchWorkOrders()
      handleBackToQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request rework')
    }
  }

  // Calculate progress
  const extrusionItems = workOrderItems.filter(i => i.partType === 'Extrusion')
  const hardwareItems = workOrderItems.filter(i => i.partType === 'Hardware')
  const receivedItems = extrusionItems.filter(i => i.isReceived)
  const completedHardware = hardwareItems.filter(i => i.isCompleted)

  const allReceived = extrusionItems.length === 0 || receivedItems.length === extrusionItems.length
  const allHardwareComplete = hardwareItems.length === 0 || completedHardware.length === hardwareItems.length
  const canAdvance = allReceived && allHardwareComplete

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
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
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
                <Package className="w-6 h-6" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {selectedWorkOrder
                      ? `Assembly - ${selectedWorkOrder.project.name}`
                      : 'Assembly Station'
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
                    stage === 'ASSEMBLY'
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {label}
                  {stageCounts[stage] > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      stage === 'ASSEMBLY' ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
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
            {/* Main content */}
            <div className="lg:col-span-2 space-y-4">
              {/* Tab navigation */}
              <div className="bg-white rounded-lg border">
                <div className="flex border-b">
                  <button
                    onClick={() => setActiveTab('receiving')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'receiving'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ScanLine className="w-4 h-4 inline mr-2" />
                    Receiving Verification
                    {!allReceived && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        {extrusionItems.length - receivedItems.length} pending
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('assembly')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'assembly'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Wrench className="w-4 h-4 inline mr-2" />
                    Hardware Pick List
                    {!allHardwareComplete && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        {hardwareItems.length - completedHardware.length} pending
                      </span>
                    )}
                  </button>
                </div>

                <div className="p-4">
                  {activeTab === 'receiving' ? (
                    <ReceivingVerification
                      items={workOrderItems}
                      onItemReceive={handleItemReceive}
                      onBulkReceive={handleBulkReceive}
                    />
                  ) : (
                    <AssemblyChecklist
                      items={workOrderItems}
                      onItemToggle={handleItemComplete}
                      onBulkComplete={handleBulkComplete}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Project color indicator */}
              {selectedWorkOrder.project.productionColor && (
                <div
                  className="h-4 rounded-t-lg"
                  style={{ backgroundColor: selectedWorkOrder.project.productionColor }}
                />
              )}

              {/* Timer */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Work Timer</h3>
                <WorkOrderTimer
                  workOrderId={selectedWorkOrder.id}
                  initialStartedAt={currentStageHistory?.startedAt}
                  size="md"
                />
              </div>

              {/* Progress Summary */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Progress</h3>
                <div className="space-y-4">
                  {/* Receiving */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Receiving</span>
                      <span className={allReceived ? 'text-green-600' : 'text-gray-600'}>
                        {receivedItems.length}/{extrusionItems.length}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${allReceived ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{
                          width: `${extrusionItems.length > 0 ? (receivedItems.length / extrusionItems.length) * 100 : 100}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Assembly */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Hardware</span>
                      <span className={allHardwareComplete ? 'text-green-600' : 'text-gray-600'}>
                        {completedHardware.length}/{hardwareItems.length}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${allHardwareComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{
                          width: `${hardwareItems.length > 0 ? (completedHardware.length / hardwareItems.length) * 100 : 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowReworkModal(true)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-sm"
                  >
                    <Undo2 className="w-4 h-4" />
                    Request Rework (Back to Cutting)
                  </button>
                </div>
              </div>

              {/* Advance button */}
              <button
                onClick={handleAdvanceToQC}
                disabled={!canAdvance}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
                  canAdvance
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <ClipboardCheck className="w-5 h-5" />
                Send to QC
                <ChevronRight className="w-5 h-5" />
              </button>

              {!canAdvance && (
                <p className="text-xs text-center text-gray-500">
                  {!allReceived && 'Receive all items from cutting first. '}
                  {!allHardwareComplete && 'Complete hardware pick list.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Work order queue */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
              <p className="text-sm text-gray-600">Select a work order to assemble</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No work orders</h3>
                <p className="text-gray-600">No work orders are ready for assembly</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => handleSelectWorkOrder(wo)}
                    className="bg-white rounded-lg border p-4 text-left hover:border-blue-500 hover:shadow-md transition-all"
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
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        Batch {wo.batchNumber}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Package className="w-4 h-4" />
                      Ready for assembly
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

      {/* Rework Modal */}
      {showReworkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Request Rework</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will send the work order back to the Cutting station. Enter a reason for the rework.
            </p>
            <textarea
              value={reworkReason}
              onChange={(e) => setReworkReason(e.target.value)}
              placeholder="e.g., Part E-12306 cut 1/4&quot; too short"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowReworkModal(false)
                  setReworkReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestRework}
                disabled={!reworkReason.trim()}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Send to Cutting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

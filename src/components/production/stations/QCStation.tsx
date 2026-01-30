'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClipboardCheck,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Truck,
  AlertCircle,
  Undo2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Check
} from 'lucide-react'
import WorkOrderTimer from '../WorkOrderTimer'
import CallManagerButton from '../CallManagerButton'
import QCChecklist, { QCChecklistItem, QCResult } from '../QCChecklist'
import { WorkOrderStage } from '@prisma/client'

// Packing list item for QC verification (matches shipping handoff)
interface PackingListItem {
  type: 'component' | 'hardware' | 'jambkit'
  name: string
  partNumber?: string | null
  dimensions?: string
  quantity?: number
}

interface PackingListOpening {
  openingId: number
  openingName: string
  width: number | null
  height: number | null
  components: PackingListItem[]
}

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

// Standard QC checklist
const QC_CHECKLIST: QCChecklistItem[] = [
  { id: 'hw-hinges', label: 'Hinges properly installed and aligned', category: 'Hardware', required: true },
  { id: 'hw-handles', label: 'Handle/lock hardware functional', category: 'Hardware', required: true },
  { id: 'hw-rollers', label: 'Rollers/tracks smooth (if applicable)', category: 'Hardware' },
  { id: 'hw-fasteners', label: 'All fasteners tight', category: 'Hardware' },
  { id: 'fin-scratches', label: 'No scratches or damage', category: 'Finish', required: true },
  { id: 'fin-color', label: 'Color/finish consistent', category: 'Finish' },
  { id: 'fin-clean', label: 'Clean, no debris or residue', category: 'Finish' },
  { id: 'op-swing', label: 'Door/panel operates smoothly', category: 'Operation', required: true },
  { id: 'op-latch', label: 'Latch engages properly', category: 'Operation' },
  { id: 'op-close', label: 'Closes fully without gaps', category: 'Operation' },
  { id: 'glass-clean', label: 'Glass clean and streak-free', category: 'Glass', required: true }
]

export default function QCStation() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderData | null>(null)
  const [currentStageHistory, setCurrentStageHistory] = useState<StageHistory | null>(null)
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qcResults, setQcResults] = useState<Map<string, QCResult>>(new Map())
  const [packingListItems, setPackingListItems] = useState<PackingListOpening[]>([])
  const [verifiedOpenings, setVerifiedOpenings] = useState<Set<string>>(new Set())
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectStation, setRejectStation] = useState<'CUTTING' | 'ASSEMBLY'>('ASSEMBLY')
  const [rejectReason, setRejectReason] = useState('')

  // Fetch work orders at this station
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/work-orders/station/qc')
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
      const response = await fetch(`/api/work-orders/${workOrderId}/station-data?station=QC`)
      if (!response.ok) throw new Error('Failed to fetch work order data')
      const data = await response.json()
      setCurrentStageHistory(data.currentStageHistory || null)
      // Get packing list items for verification
      setPackingListItems(data.stationData?.packingListItems || [])
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
      // Reset QC results for new work order
      setQcResults(new Map())
    }
  }, [selectedWorkOrder, fetchWorkOrderData])

  const handleSelectWorkOrder = (wo: WorkOrderData) => {
    setSelectedWorkOrder(wo)
  }

  const handleBackToQueue = () => {
    setSelectedWorkOrder(null)
    setCurrentStageHistory(null)
    setQcResults(new Map())
    setPackingListItems([])
    setVerifiedOpenings(new Set())
  }

  const handleResultChange = (itemId: string, result: Partial<QCResult>) => {
    setQcResults(prev => {
      const next = new Map(prev)
      const current = next.get(itemId) || { itemId, status: 'pending' as const }
      next.set(itemId, { ...current, ...result })
      return next
    })
  }

  const handleApprove = async () => {
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

  const handleReject = async () => {
    if (!selectedWorkOrder || !rejectReason.trim()) return

    // Collect failed items info
    const failedItems = Array.from(qcResults.entries())
      .filter(([_, result]) => result.status === 'fail')
      .map(([itemId, result]) => {
        const item = QC_CHECKLIST.find(c => c.id === itemId)
        return `${item?.label || itemId}: ${result.defectType || 'Unknown'} - ${result.notes || 'No notes'}`
      })

    const fullReason = `[QC REJECT] ${rejectReason}\n\nFailed Items:\n${failedItems.join('\n')}`

    try {
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage: rejectStation,
          reason: fullReason
        })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject')
      }
      setShowRejectModal(false)
      setRejectReason('')
      await fetchWorkOrders()
      handleBackToQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    }
  }

  // Use packing list openings for verification
  const openingsToVerify = packingListItems.map(opening => ({
    ...opening,
    verified: verifiedOpenings.has(opening.openingName)
  }))

  const handleToggleOpeningVerified = (openingName: string) => {
    setVerifiedOpenings(prev => {
      const next = new Set(prev)
      if (next.has(openingName)) {
        next.delete(openingName)
      } else {
        next.add(openingName)
      }
      return next
    })
  }

  // Calculate inspection progress
  const requiredItems = QC_CHECKLIST.filter(i => i.required)
  const allRequiredPassed = requiredItems.every(item => qcResults.get(item.id)?.status === 'pass')
  const hasFailures = Array.from(qcResults.values()).some(r => r.status === 'fail')
  const totalInspected = Array.from(qcResults.values()).filter(r => r.status !== 'pending').length

  // All openings must be verified for shipping handoff
  const allOpeningsVerified = openingsToVerify.length > 0 && openingsToVerify.every(o => o.verified)
  const canApprove = allRequiredPassed && !hasFailures && totalInspected >= requiredItems.length && allOpeningsVerified

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
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
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
                <ClipboardCheck className="w-6 h-6" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {selectedWorkOrder
                      ? `QC - ${selectedWorkOrder.project.name}`
                      : 'Quality Control'
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
                    stage === 'QC'
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {label}
                  {stageCounts[stage] > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      stage === 'QC' ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
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
            {/* Main content - Component Count & QC Checklist */}
            <div className="lg:col-span-2 space-y-6">
              {/* Component Count / Boxing Verification */}
              <div className="bg-white rounded-lg border">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold">Shipping Verification</h3>
                  </div>
                  <div className="text-sm text-gray-600">
                    {verifiedOpenings.size}/{openingsToVerify.length} verified
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Verify each opening is complete and ready to hand off to shipping.
                  </p>

                  {openingsToVerify.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No openings in this batch</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openingsToVerify.map((opening) => {
                        // Format dimensions
                        const formatDim = (inches: number | null) => {
                          if (!inches) return ''
                          const feet = Math.floor(inches / 12)
                          const remainingInches = Math.round(inches % 12)
                          if (feet === 0) return `${remainingInches}"`
                          if (remainingInches === 0) return `${feet}'`
                          return `${feet}'-${remainingInches}"`
                        }
                        const dimStr = opening.width && opening.height
                          ? `${formatDim(opening.width)} × ${formatDim(opening.height)}`
                          : ''

                        return (
                          <div
                            key={opening.openingName}
                            className={`border rounded-lg overflow-hidden transition-colors ${
                              opening.verified ? 'border-green-300 bg-green-50' : 'border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => handleToggleOpeningVerified(opening.openingName)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                  opening.verified
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300'
                                }`}>
                                  {opening.verified && <Check className="w-4 h-4" />}
                                </div>
                                <div className="text-left">
                                  <div className="font-medium">{opening.openingName}</div>
                                  {dimStr && (
                                    <div className="text-sm text-gray-500">{dimStr}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {opening.verified ? (
                                  <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">Tap to verify</span>
                                )}
                              </div>
                            </button>

                            {/* Items list */}
                            <div className={`border-t bg-white px-4 py-2 ${opening.verified ? 'border-green-200' : ''}`}>
                              <div className="space-y-1">
                                {opening.components.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                      {item.type === 'component' && (
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      )}
                                      {item.type === 'hardware' && (
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                      )}
                                      {item.type === 'jambkit' && (
                                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                                      )}
                                      <span className="text-gray-700">{item.name}</span>
                                      {item.quantity && item.quantity > 1 && (
                                        <span className="text-gray-400 text-xs">×{item.quantity}</span>
                                      )}
                                    </div>
                                    <span className="text-gray-500 text-xs">
                                      {item.dimensions || item.partNumber || ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Summary */}
                  {openingsToVerify.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {openingsToVerify.reduce((sum, o) => sum + o.components.length, 0)} item{openingsToVerify.reduce((sum, o) => sum + o.components.length, 0) !== 1 ? 's' : ''} across {openingsToVerify.length} opening{openingsToVerify.length !== 1 ? 's' : ''}
                      </div>
                      {allOpeningsVerified ? (
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Ready for shipping
                        </span>
                      ) : (
                        <span className="text-sm text-yellow-600">
                          {openingsToVerify.length - verifiedOpenings.size} remaining
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quality Checklist */}
              <QCChecklist
                checklist={QC_CHECKLIST}
                results={qcResults}
                onResultChange={handleResultChange}
              />
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
                <h3 className="font-medium mb-3">Inspection Timer</h3>
                <WorkOrderTimer
                  workOrderId={selectedWorkOrder.id}
                  initialStartedAt={currentStageHistory?.startedAt}
                  size="md"
                />
              </div>

              {/* Status */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Inspection Status</h3>
                <div className="space-y-3">
                  {canApprove ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Ready to approve</span>
                    </div>
                  ) : hasFailures ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">Failed items detected</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">Complete all steps</span>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center justify-between">
                      <span>Openings verified:</span>
                      <span className={allOpeningsVerified ? 'text-green-600 font-medium' : ''}>
                        {verifiedOpenings.size}/{openingsToVerify.length}
                      </span>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Quality checks:</span>
                      <span className={allRequiredPassed ? 'text-green-600 font-medium' : ''}>
                        {requiredItems.filter(i => qcResults.get(i.id)?.status === 'pass').length}/{requiredItems.length}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {/* Approve button */}
                <button
                  onClick={handleApprove}
                  disabled={!canApprove}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
                    canApprove
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Approve - Send to Shipping
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Reject button */}
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={!hasFailures}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    hasFailures
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Undo2 className="w-5 h-5" />
                  Reject - Send to Rework
                </button>

                {/* Hold button */}
                <button
                  onClick={() => {
                    setRejectStation('ASSEMBLY')
                    setShowRejectModal(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-sm"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Hold for Parts
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Work order queue */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
              <p className="text-sm text-gray-600">Select a work order to inspect</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <ClipboardCheck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No work orders</h3>
                <p className="text-gray-600">No work orders are ready for QC</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => handleSelectWorkOrder(wo)}
                    className="bg-white rounded-lg border p-4 text-left hover:border-purple-500 hover:shadow-md transition-all"
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
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        Batch {wo.batchNumber}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <ClipboardCheck className="w-4 h-4" />
                      Ready for inspection
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

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Send to Rework</h3>
            <p className="text-sm text-gray-600 mb-4">
              Select where to send this work order for rework.
            </p>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="rejectStation"
                  value="CUTTING"
                  checked={rejectStation === 'CUTTING'}
                  onChange={() => setRejectStation('CUTTING')}
                  className="w-4 h-4 text-purple-600"
                />
                <div>
                  <div className="font-medium">Back to Cutting</div>
                  <div className="text-sm text-gray-500">For dimension or cut errors</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="rejectStation"
                  value="ASSEMBLY"
                  checked={rejectStation === 'ASSEMBLY'}
                  onChange={() => setRejectStation('ASSEMBLY')}
                  className="w-4 h-4 text-purple-600"
                />
                <div>
                  <div className="font-medium">Back to Assembly</div>
                  <div className="text-sm text-gray-500">For hardware or assembly issues</div>
                </div>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rework Instructions
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe what needs to be fixed..."
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Send to Rework
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Manager Button */}
      <CallManagerButton
        stationName="QC"
        workOrderInfo={selectedWorkOrder ? {
          id: selectedWorkOrder.id,
          projectName: selectedWorkOrder.project.name,
          batchNumber: selectedWorkOrder.batchNumber
        } : null}
      />
    </div>
  )
}

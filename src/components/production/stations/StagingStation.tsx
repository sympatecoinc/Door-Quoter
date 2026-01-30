'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Boxes,
  RefreshCw,
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Tag,
  ChevronRight,
  Scissors,
  Package,
  AlertCircle,
  MapPin,
  Warehouse
} from 'lucide-react'
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
    openings?: {
      finishColor: string | null
    }[]
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
}

interface AggregatedExtrusionItem {
  partNumber: string
  partName: string
  stockLength: number | null
  colorCode: string | null
  totalQuantity: number
  binLocation: string | null
}

interface InventoryData {
  [partNumber: string]: {
    qtyOnHand: number | null
    binLocationRef?: { code: string; name: string } | null
    binLocationLegacy?: string | null
  }
}

interface ExtrusionGroup {
  type: 'Extrusion'
  items: AggregatedExtrusionItem[]
  verified: boolean
}

interface StageCounts {
  [key: string]: number
}

export default function StagingStation() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderData | null>(null)
  const [aggregatedExtrusions, setAggregatedExtrusions] = useState<AggregatedExtrusionItem[]>([])
  const [inventory, setInventory] = useState<InventoryData>({})
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verifiedGroups, setVerifiedGroups] = useState<Set<string>>(new Set())
  const [holdReason, setHoldReason] = useState('')
  const [showHoldModal, setShowHoldModal] = useState(false)

  // Fetch work orders at this station
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/work-orders/station/staged')
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
      const response = await fetch(`/api/work-orders/${workOrderId}/station-data?station=STAGED`)
      if (!response.ok) throw new Error('Failed to fetch work order data')
      const data = await response.json()
      setAggregatedExtrusions(data.stationData?.aggregatedExtrusions || [])
      setInventory(data.stationData?.inventory || {})
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
      setVerifiedGroups(new Set())
    }
  }, [selectedWorkOrder, fetchWorkOrderData])

  const handleSelectWorkOrder = (wo: WorkOrderData) => {
    setSelectedWorkOrder(wo)
  }

  const handleBackToQueue = () => {
    setSelectedWorkOrder(null)
    setAggregatedExtrusions([])
    setInventory({})
    setVerifiedGroups(new Set())
  }

  const handleVerifyGroup = (groupType: string) => {
    setVerifiedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupType)) {
        next.delete(groupType)
      } else {
        next.add(groupType)
      }
      return next
    })
  }

  const handleReleaseToCutting = async () => {
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

  const handleHold = async () => {
    if (!selectedWorkOrder || !holdReason) return
    try {
      // Update work order notes with hold reason
      const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: `[HOLD] ${holdReason}`,
          priority: -1 // Move to bottom of queue
        })
      })
      if (!response.ok) throw new Error('Failed to hold work order')
      setShowHoldModal(false)
      setHoldReason('')
      await fetchWorkOrders()
      handleBackToQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hold')
    }
  }

  const handlePrintTags = () => {
    if (!selectedWorkOrder) return
    window.open(`/api/work-orders/${selectedWorkOrder.id}/tags/pdf`, '_blank')
  }

  // Single extrusion group using aggregated data
  const extrusionGroup: ExtrusionGroup | null = aggregatedExtrusions.length > 0
    ? {
        type: 'Extrusion',
        items: aggregatedExtrusions,
        verified: verifiedGroups.has('Extrusion')
      }
    : null

  const allGroupsVerified = extrusionGroup ? extrusionGroup.verified : true

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
      <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white">
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
                <Boxes className="w-6 h-6" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {selectedWorkOrder
                      ? `Staging - ${selectedWorkOrder.project.name}`
                      : 'Staging Area'
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
                    stage === 'STAGED'
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {label}
                  {stageCounts[stage] > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      stage === 'STAGED' ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
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
            {/* Main content - Material verification */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h2 className="text-lg font-semibold mb-4">Material Verification</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Verify that all required materials are available before releasing to cutting.
                </p>

                {/* Extrusion group - only material type shown */}
                <div className="space-y-4">
                  {extrusionGroup && (
                    <div
                      className={`border rounded-lg overflow-hidden ${
                        extrusionGroup.verified ? 'border-green-300 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      {/* Group header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-orange-500" />
                          <span className="font-medium">Extrusions</span>
                          <span className="text-sm text-gray-500">
                            ({extrusionGroup.items.length} items)
                          </span>
                        </div>
                        <button
                          onClick={() => handleVerifyGroup('Extrusion')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            extrusionGroup.verified
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {extrusionGroup.verified ? (
                            <>
                              <Check className="w-4 h-4" />
                              Verified
                            </>
                          ) : (
                            'Mark Verified'
                          )}
                        </button>
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Part Number</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                              <th className="px-3 py-2 text-center font-medium text-gray-600">Stock</th>
                              <th className="px-3 py-2 text-center font-medium text-gray-600">Color</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">Qty Needed</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-600">On Hand</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-600">Bin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {extrusionGroup.items.map((item, idx) => {
                              const inv = inventory[item.partNumber]
                              const qtyOnHand = inv?.qtyOnHand ?? null
                              const hasEnough = qtyOnHand === null || qtyOnHand >= item.totalQuantity
                              const binCode = item.binLocation ||
                                inv?.binLocationRef?.code ||
                                inv?.binLocationLegacy ||
                                '-'

                              return (
                                <tr key={`${item.partNumber}-${item.stockLength ?? 'null'}-${idx}`} className={extrusionGroup.verified ? 'bg-green-50/50' : ''}>
                                  <td className="px-4 py-2 font-mono text-xs">{item.partNumber}</td>
                                  <td className="px-4 py-2">{item.partName}</td>
                                  <td className="px-3 py-2 text-center">
                                    {item.stockLength ? (
                                      <span className="inline-flex items-center text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                        {item.stockLength}"
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {item.colorCode ? (
                                      <span className="inline-flex items-center text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                        {item.colorCode}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-right font-medium">{item.totalQuantity}</td>
                                  <td className={`px-4 py-2 text-right font-medium ${
                                    !hasEnough ? 'text-red-600' : ''
                                  }`}>
                                    {qtyOnHand !== null ? qtyOnHand : '-'}
                                    {!hasEnough && (
                                      <AlertTriangle className="w-4 h-4 inline ml-1 text-red-500" />
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {binCode !== '-' ? (
                                      <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-0.5 rounded">
                                        <MapPin className="w-3 h-3" />
                                        {binCode}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!extrusionGroup && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p>No extrusions in this work order</p>
                    </div>
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

              {/* Verification status */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Verification Status</h3>
                <div className="space-y-2">
                  {extrusionGroup && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Extrusions</span>
                      {extrusionGroup.verified ? (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <Check className="w-4 h-4" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                          <X className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={handlePrintTags}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <Tag className="w-4 h-4" />
                    Generate Extrusion Tags
                  </button>
                  <button
                    onClick={() => setShowHoldModal(true)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-lg text-sm"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Hold Work Order
                  </button>
                </div>
              </div>

              {/* Release to Cutting */}
              <button
                onClick={handleReleaseToCutting}
                disabled={!allGroupsVerified}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
                  allGroupsVerified
                    ? 'bg-orange-500 hover:bg-orange-600'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <Scissors className="w-5 h-5" />
                Release to Cutting
                <ChevronRight className="w-5 h-5" />
              </button>

              {!allGroupsVerified && (
                <p className="text-xs text-center text-gray-500">
                  Verify extrusions to release
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Work order queue */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
              <p className="text-sm text-gray-600">Verify materials before releasing to cutting</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <Boxes className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No work orders</h3>
                <p className="text-gray-600">No work orders are currently staged</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map(wo => {
                  // Get finish color from first opening
                  const finishColor = wo.project.openings?.[0]?.finishColor
                  // Determine badge color based on finish
                  const getFinishBadgeStyle = (finish: string | null | undefined) => {
                    if (!finish) return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'No Finish' }
                    const lower = finish.toLowerCase()
                    if (lower.includes('black')) return { bg: 'bg-gray-900', text: 'text-white', label: 'Black' }
                    if (lower.includes('clear') || lower.includes('mill')) return { bg: 'bg-gray-200', text: 'text-gray-700', label: 'Clear' }
                    if (lower.includes('bronze')) return { bg: 'bg-amber-700', text: 'text-white', label: 'Bronze' }
                    if (lower.includes('white')) return { bg: 'bg-white border border-gray-300', text: 'text-gray-700', label: 'White' }
                    if (lower.includes('champagne')) return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Champagne' }
                    return { bg: 'bg-gray-100', text: 'text-gray-600', label: finish.split(' ')[0] }
                  }
                  const finishBadge = getFinishBadgeStyle(finishColor)

                  return (
                    <button
                      key={wo.id}
                      onClick={() => handleSelectWorkOrder(wo)}
                      className="bg-white rounded-lg border p-4 text-left hover:border-gray-400 hover:shadow-md transition-all"
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
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                          Batch {wo.batchNumber}
                        </span>
                      </div>

                      {/* Finish color badge */}
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${finishBadge.bg} ${finishBadge.text}`}>
                          {finishBadge.label}
                        </span>
                      </div>

                      {wo.notes && wo.notes.startsWith('[HOLD]') && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {wo.notes.replace('[HOLD] ', '')}
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                        <Boxes className="w-4 h-4" />
                        Awaiting material verification
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Hold Work Order</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a reason for holding this work order. It will be moved to the bottom of the queue.
            </p>
            <textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="e.g., Waiting for glass delivery"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowHoldModal(false)
                  setHoldReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleHold}
                disabled={!holdReason.trim()}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Hold Work Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

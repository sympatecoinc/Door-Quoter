'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Package,
  MapPin,
  Phone,
  User,
  Calendar,
  FileText,
  Printer,
  QrCode,
  ScanLine
} from 'lucide-react'
import WorkOrderTimer from '../WorkOrderTimer'
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
      contactName?: string | null
      phone?: string | null
    } | null
    shippingAddress?: string | null
    shippingCity?: string | null
    shippingState?: string | null
    shippingZipCode?: string | null
    shipDate?: string | null
    dueDate?: string | null
  }
}

interface PackingListItem {
  type: string
  name: string
  dimensions?: string
}

interface PackingListOpening {
  openingId: number
  openingName: string
  components: PackingListItem[]
}

interface HardwarePickItem {
  partNumber: string | null
  partName: string
  quantity: number
  openings: string[]
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

export default function ShippingStation() {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderData | null>(null)
  const [packingList, setPackingList] = useState<PackingListOpening[]>([])
  const [hardwarePickList, setHardwarePickList] = useState<HardwarePickItem[]>([])
  const [currentStageHistory, setCurrentStageHistory] = useState<StageHistory | null>(null)
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [packingVerified, setPackingVerified] = useState(false)

  // Fetch work orders at this station
  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/work-orders/station/ship')
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
      const response = await fetch(`/api/work-orders/${workOrderId}/station-data?station=SHIP`)
      if (!response.ok) throw new Error('Failed to fetch work order data')
      const data = await response.json()
      setPackingList(data.stationData?.packingList || [])
      setHardwarePickList(data.stationData?.hardwarePickList || [])
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
      setPackingVerified(false)
    }
  }, [selectedWorkOrder, fetchWorkOrderData])

  const handleSelectWorkOrder = (wo: WorkOrderData) => {
    setSelectedWorkOrder(wo)
  }

  const handleBackToQueue = () => {
    setSelectedWorkOrder(null)
    setPackingList([])
    setHardwarePickList([])
    setCurrentStageHistory(null)
    setPackingVerified(false)
  }

  const handleMarkShipped = async () => {
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
      setError(err instanceof Error ? err.message : 'Failed to mark as shipped')
    }
  }

  const handlePrintPackingList = () => {
    if (!selectedWorkOrder) return
    window.open(`/api/projects/${selectedWorkOrder.project.id}/packing-list/pdf`, '_blank')
  }

  const handleOpenPackingScanner = () => {
    if (!selectedWorkOrder) return
    // Open the packing scanner interface in a new tab
    window.open(`/packing/${selectedWorkOrder.project.id}`, '_blank')
  }

  const handleDownloadBOL = () => {
    // TODO: Implement BOL PDF generation
    alert('Bill of Lading download coming soon')
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

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
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white">
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
                <Truck className="w-6 h-6" />
                <div>
                  <h1 className="text-2xl font-bold">
                    {selectedWorkOrder
                      ? `Shipping - ${selectedWorkOrder.project.name}`
                      : 'Shipping Station'
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
                    stage === 'SHIP'
                      ? 'bg-white text-gray-900'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {label}
                  {stageCounts[stage] > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      stage === 'SHIP' ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
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
              {/* Shipping Details */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-500" />
                  Shipping Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Customer</h4>
                    <div className="space-y-1">
                      <p className="font-semibold text-lg">
                        {selectedWorkOrder.project.customer?.companyName || 'No customer'}
                      </p>
                      {selectedWorkOrder.project.customer?.contactName && (
                        <p className="flex items-center gap-2 text-gray-600">
                          <User className="w-4 h-4" />
                          {selectedWorkOrder.project.customer.contactName}
                        </p>
                      )}
                      {selectedWorkOrder.project.customer?.phone && (
                        <p className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4" />
                          {selectedWorkOrder.project.customer.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shipping address */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Ship To</h4>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      {selectedWorkOrder.project.shippingAddress ? (
                        <div className="text-lg">
                          <p>{selectedWorkOrder.project.shippingAddress}</p>
                          <p>
                            {[
                              selectedWorkOrder.project.shippingCity,
                              selectedWorkOrder.project.shippingState,
                              selectedWorkOrder.project.shippingZipCode
                            ].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No shipping address set</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="mt-6 flex flex-wrap gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Ship Date</h4>
                    <p className="flex items-center gap-2 font-medium">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(selectedWorkOrder.project.shipDate)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Due Date</h4>
                    <p className="flex items-center gap-2 font-medium">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(selectedWorkOrder.project.dueDate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Packing List */}
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-500" />
                    Packing List
                  </h3>
                  <span className="text-sm text-gray-500">
                    {packingList.length} opening{packingList.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {packingList.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in packing list</p>
                ) : (
                  <div className="space-y-3">
                    {packingList.map((opening) => (
                      <div key={opening.openingId} className="border rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 font-medium">
                          {opening.openingName}
                        </div>
                        <div className="px-4 py-2 space-y-1">
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
                                <span>{item.name}</span>
                              </div>
                              {item.dimensions && (
                                <span className="text-gray-500 text-xs">{item.dimensions}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hardware Pick List */}
              {hardwarePickList.length > 0 && (
                <div className="bg-white rounded-lg border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-500" />
                      Hardware Pick List
                    </h3>
                    <span className="text-sm text-gray-500">
                      {hardwarePickList.length} item{hardwarePickList.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-gray-500 text-xs uppercase border-b">
                        <tr>
                          <th className="text-left py-2 pr-4">Item</th>
                          <th className="text-left py-2 pr-4">Part #</th>
                          <th className="text-right py-2">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {hardwarePickList.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-4">{item.partName}</td>
                            <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                              {item.partNumber || '—'}
                            </td>
                            <td className="py-2 text-right font-medium">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                <h3 className="font-medium mb-3">Packing Timer</h3>
                <WorkOrderTimer
                  workOrderId={selectedWorkOrder.id}
                  initialStartedAt={currentStageHistory?.startedAt}
                  size="md"
                />
              </div>

              {/* Documents */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Documents</h3>
                <div className="space-y-2">
                  <button
                    onClick={handlePrintPackingList}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Packing List
                  </button>
                  <button
                    onClick={handleDownloadBOL}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    Download BOL
                  </button>
                  <button
                    onClick={handleOpenPackingScanner}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <QrCode className="w-4 h-4" />
                    Open QR Scanner
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Shipping Labels
                  </button>
                </div>
              </div>

              {/* Verification */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-medium mb-3">Packing Verification</h3>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={packingVerified}
                    onChange={(e) => setPackingVerified(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded"
                  />
                  <span className="text-sm">
                    I have verified all items are packed and the shipping address is correct
                  </span>
                </label>
              </div>

              {/* Ship button */}
              <button
                onClick={handleMarkShipped}
                disabled={!packingVerified}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${
                  packingVerified
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark as Shipped
                <ChevronRight className="w-5 h-5" />
              </button>

              {!packingVerified && (
                <p className="text-xs text-center text-gray-500">
                  Verify packing before marking as shipped
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Work order queue */
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders</h2>
              <p className="text-sm text-gray-600">Select a work order to prepare for shipping</p>
            </div>

            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
                <p className="mt-2 text-gray-600">Loading...</p>
              </div>
            ) : workOrders.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <Truck className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No work orders</h3>
                <p className="text-gray-600">No work orders are ready for shipping</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workOrders.map(wo => (
                  <button
                    key={wo.id}
                    onClick={() => handleSelectWorkOrder(wo)}
                    className="bg-white rounded-lg border p-4 text-left hover:border-green-500 hover:shadow-md transition-all"
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
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Batch {wo.batchNumber}
                      </span>
                    </div>

                    {/* Shipping info preview */}
                    {wo.project.shippingCity && (
                      <div className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {wo.project.shippingCity}, {wo.project.shippingState}
                      </div>
                    )}

                    {wo.project.shipDate && (
                      <div className="mt-1 text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Ship: {formatDate(wo.project.shipDate)}
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Truck className="w-4 h-4" />
                      Ready to ship
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
        stationName="Shipping"
        workOrderInfo={selectedWorkOrder ? {
          id: selectedWorkOrder.id,
          projectName: selectedWorkOrder.project.name,
          batchNumber: selectedWorkOrder.batchNumber
        } : null}
      />
    </div>
  )
}

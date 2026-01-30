'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  Scissors,
  Package,
  ClipboardCheck,
  Truck,
  Boxes,
  AlertCircle,
  ArrowLeft,
  Cpu
} from 'lucide-react'
import WorkOrderQueue from './WorkOrderQueue'
import { WorkOrderData } from './WorkOrderCard'
import { WorkOrderStage } from '@prisma/client'

interface StageCounts {
  [key: string]: number
}

interface StationViewProps {
  stage: WorkOrderStage
  title: string
  icon?: React.ReactNode
  children?: React.ReactNode // For station-specific content
}

const STAGE_ICONS: Record<WorkOrderStage, React.ReactNode> = {
  STAGED: <Boxes className="w-6 h-6" />,
  CUTTING: <Scissors className="w-6 h-6" />,
  MILLING: <Cpu className="w-6 h-6" />,
  ASSEMBLY: <Package className="w-6 h-6" />,
  QC: <ClipboardCheck className="w-6 h-6" />,
  SHIP: <Truck className="w-6 h-6" />,
  COMPLETE: <Package className="w-6 h-6" />
}

const STAGE_COLORS: Record<WorkOrderStage, string> = {
  STAGED: 'from-gray-500 to-gray-600',
  CUTTING: 'from-orange-500 to-orange-600',
  MILLING: 'from-violet-500 to-violet-600',
  ASSEMBLY: 'from-blue-500 to-blue-600',
  QC: 'from-purple-500 to-purple-600',
  SHIP: 'from-green-500 to-green-600',
  COMPLETE: 'from-emerald-500 to-emerald-600'
}

export default function StationView({
  stage,
  title,
  icon,
  children
}: StationViewProps) {
  const router = useRouter()
  const [workOrders, setWorkOrders] = useState<WorkOrderData[]>([])
  const [stageCounts, setStageCounts] = useState<StageCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/work-orders/station/${stage.toLowerCase()}`)
      if (!response.ok) throw new Error('Failed to fetch work orders')
      const data = await response.json()
      setWorkOrders(data.workOrders || [])
      setStageCounts(data.allStageCounts || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [stage])

  useEffect(() => {
    fetchWorkOrders()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchWorkOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchWorkOrders])

  const handleAdvance = async (workOrderId: string) => {
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/advance`, {
        method: 'POST'
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to advance work order')
      }
      // Refresh the list
      fetchWorkOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance')
    }
  }

  const handleMove = async (workOrderId: string, targetStage: WorkOrderStage, reason?: string) => {
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage, reason })
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to move work order')
      }
      fetchWorkOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move')
    }
  }

  // Navigation tabs for other stages
  const allStages: { stage: WorkOrderStage; label: string }[] = [
    { stage: 'STAGED', label: 'Staged' },
    { stage: 'CUTTING', label: 'Cutting' },
    { stage: 'ASSEMBLY', label: 'Assembly' },
    { stage: 'QC', label: 'QC' },
    { stage: 'SHIP', label: 'Shipping' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${STAGE_COLORS[stage]} text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/production')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                {icon || STAGE_ICONS[stage]}
                <div>
                  <h1 className="text-2xl font-bold">{title}</h1>
                  <p className="text-sm opacity-90">
                    {workOrders.length} work order{workOrders.length !== 1 ? 's' : ''} in queue
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {allStages.map(({ stage: s, label }) => (
              <button
                key={s}
                onClick={() => router.push(`/production/${s.toLowerCase()}`)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  s === stage
                    ? 'bg-white text-gray-900'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {label}
                {stageCounts[s] > 0 && (
                  <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                    s === stage ? 'bg-gray-100 text-gray-600' : 'bg-white/20'
                  }`}>
                    {stageCounts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Station-specific content */}
        {children}

        {/* Work Order Queue */}
        <div className="mt-6">
          <WorkOrderQueue
            workOrders={workOrders}
            title="Work Orders"
            emptyMessage={`No work orders at ${title} station`}
            onAdvance={handleAdvance}
            onMove={handleMove}
            onRefresh={fetchWorkOrders}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}

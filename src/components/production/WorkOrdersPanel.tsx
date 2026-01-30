'use client'

import { Loader2, PlayCircle, Package } from 'lucide-react'
import { WorkOrderStage } from '@prisma/client'

interface WorkOrder {
  id: string
  batchNumber: number
  currentStage: WorkOrderStage
  priority: number
  itemCount: number
  completedCount: number
  progressPercent: number
}

interface WorkOrdersPanelProps {
  workOrders: WorkOrder[]
  projectId: number
  onGenerateWorkOrders?: () => void
  isGenerating?: boolean
}

const STAGE_COLORS: Record<WorkOrderStage, { bg: string; text: string; border: string }> = {
  STAGED: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  CUTTING: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  MILLING: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  ASSEMBLY: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  QC: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  SHIP: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  COMPLETE: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' }
}

const STAGE_LABELS: Record<WorkOrderStage, string> = {
  STAGED: 'Staged',
  CUTTING: 'Cutting',
  MILLING: 'Milling',
  ASSEMBLY: 'Assembly',
  QC: 'QC',
  SHIP: 'Shipping',
  COMPLETE: 'Complete'
}

const PROGRESS_COLORS: Record<WorkOrderStage, string> = {
  STAGED: 'bg-gray-400',
  CUTTING: 'bg-orange-500',
  MILLING: 'bg-violet-500',
  ASSEMBLY: 'bg-blue-500',
  QC: 'bg-purple-500',
  SHIP: 'bg-green-500',
  COMPLETE: 'bg-emerald-600'
}

export default function WorkOrdersPanel({
  workOrders,
  projectId,
  onGenerateWorkOrders,
  isGenerating = false
}: WorkOrdersPanelProps) {
  if (workOrders.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-gray-500 mb-3">No work orders yet</p>
        {onGenerateWorkOrders && (
          <button
            onClick={onGenerateWorkOrders}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4" />
                Generate Work Orders
              </>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {workOrders.map(wo => {
        const stageColor = STAGE_COLORS[wo.currentStage]
        const progressColor = PROGRESS_COLORS[wo.currentStage]

        return (
          <div
            key={wo.id}
            className="bg-gray-50 rounded-lg p-3 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Batch {wo.batchNumber}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColor.bg} ${stageColor.text}`}
                >
                  {STAGE_LABELS[wo.currentStage]}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {wo.completedCount}/{wo.itemCount} items
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColor} transition-all duration-300`}
                style={{ width: `${wo.progressPercent}%` }}
              />
            </div>

            {/* Progress percentage */}
            <div className="mt-1 text-right text-[10px] text-gray-500">
              {wo.progressPercent}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

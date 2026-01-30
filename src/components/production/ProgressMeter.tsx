'use client'

import { WorkOrderStage } from '@prisma/client'

interface StageData {
  count: number
  itemCount?: number
}

interface ProgressMeterProps {
  stageDistribution: Record<WorkOrderStage, StageData | number>
  totalWorkOrders: number
  compact?: boolean
  showLabels?: boolean
  onClick?: (stage: WorkOrderStage) => void
}

const STAGE_ORDER: WorkOrderStage[] = [
  'STAGED',
  'CUTTING',
  'MILLING',
  'ASSEMBLY',
  'QC',
  'SHIP',
  'COMPLETE'
]

const STAGE_COLORS: Record<WorkOrderStage, string> = {
  STAGED: 'bg-gray-400',
  CUTTING: 'bg-orange-500',
  MILLING: 'bg-violet-500',
  ASSEMBLY: 'bg-blue-500',
  QC: 'bg-purple-500',
  SHIP: 'bg-green-500',
  COMPLETE: 'bg-emerald-600'
}

const STAGE_LABELS: Record<WorkOrderStage, string> = {
  STAGED: 'Staged',
  CUTTING: 'Cut',
  MILLING: 'Mill',
  ASSEMBLY: 'Assy',
  QC: 'QC',
  SHIP: 'Ship',
  COMPLETE: 'Done'
}

function getCount(data: StageData | number): number {
  return typeof data === 'number' ? data : data.count
}

export default function ProgressMeter({
  stageDistribution,
  totalWorkOrders,
  compact = false,
  showLabels = true,
  onClick
}: ProgressMeterProps) {
  if (totalWorkOrders === 0) {
    return (
      <div className={`${compact ? 'h-2' : 'h-4'} bg-gray-100 rounded-full overflow-hidden`}>
        <div className="h-full w-0" />
      </div>
    )
  }

  // Calculate percentages
  const segments = STAGE_ORDER.map(stage => {
    const data = stageDistribution[stage]
    const count = data ? getCount(data) : 0
    const percent = (count / totalWorkOrders) * 100
    return { stage, count, percent }
  }).filter(s => s.count > 0)

  // Calculate completion percentage
  const completedData = stageDistribution.COMPLETE
  const completedCount = completedData ? getCount(completedData) : 0
  const completionPercent = Math.round((completedCount / totalWorkOrders) * 100)

  return (
    <div className="space-y-1">
      {/* Progress bar */}
      <div className={`${compact ? 'h-2' : 'h-4'} bg-gray-100 rounded-full overflow-hidden flex`}>
        {segments.map(({ stage, percent }) => (
          <div
            key={stage}
            className={`${STAGE_COLORS[stage]} transition-all duration-300 ${
              onClick ? 'cursor-pointer hover:opacity-80' : ''
            }`}
            style={{ width: `${percent}%` }}
            onClick={() => onClick?.(stage)}
            title={`${STAGE_LABELS[stage]}: ${Math.round(percent)}%`}
          />
        ))}
      </div>

      {/* Labels */}
      {showLabels && !compact && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{completionPercent}% complete</span>
          <span>{totalWorkOrders} work orders</span>
        </div>
      )}
    </div>
  )
}

// Detailed progress breakdown component
export function ProgressBreakdown({
  stageDistribution,
  totalWorkOrders,
  onClick
}: {
  stageDistribution: Record<WorkOrderStage, StageData | number>
  totalWorkOrders: number
  onClick?: (stage: WorkOrderStage) => void
}) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {STAGE_ORDER.map(stage => {
        const data = stageDistribution[stage]
        const count = data ? getCount(data) : 0
        const percent = totalWorkOrders > 0 ? Math.round((count / totalWorkOrders) * 100) : 0

        return (
          <button
            key={stage}
            onClick={() => onClick?.(stage)}
            className={`p-2 rounded-lg text-center transition-colors ${
              count > 0
                ? 'bg-white border-2 hover:shadow-md cursor-pointer'
                : 'bg-gray-50 border border-gray-100'
            }`}
            style={{
              borderColor: count > 0 ? STAGE_COLORS[stage].replace('bg-', '') : undefined
            }}
            disabled={!onClick || count === 0}
          >
            <div className={`text-lg font-bold ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
              {count}
            </div>
            <div className={`text-xs ${count > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
              {STAGE_LABELS[stage]}
            </div>
            {count > 0 && (
              <div className={`text-[10px] mt-1 font-medium ${
                stage === 'COMPLETE' ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {percent}%
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Mini inline progress for table rows
export function MiniProgress({
  stageDistribution,
  totalWorkOrders
}: {
  stageDistribution: Record<WorkOrderStage, StageData | number>
  totalWorkOrders: number
}) {
  if (totalWorkOrders === 0) {
    return <span className="text-gray-400 text-xs">No work orders</span>
  }

  const completedData = stageDistribution.COMPLETE
  const completedCount = completedData ? getCount(completedData) : 0
  const percent = Math.round((completedCount / totalWorkOrders) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
        {STAGE_ORDER.map(stage => {
          const data = stageDistribution[stage]
          const count = data ? getCount(data) : 0
          if (count === 0) return null
          const stagePercent = (count / totalWorkOrders) * 100
          return (
            <div
              key={stage}
              className={STAGE_COLORS[stage]}
              style={{ width: `${stagePercent}%` }}
            />
          )
        })}
      </div>
      <span className="text-xs text-gray-500 w-8">{percent}%</span>
    </div>
  )
}

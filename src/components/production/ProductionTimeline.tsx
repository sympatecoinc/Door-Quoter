'use client'

interface ProductionTimelineProps {
  currentStage?: number // 0-4 (Verify Inventory, Cutting, Assembly, QC, Ship)
}

const stages = [
  { label: 'Verify Inventory' },
  { label: 'Cutting' },
  { label: 'Assembly' },
  { label: 'QC' },
  { label: 'Ship' }
]

export default function ProductionTimeline({ currentStage = 0 }: ProductionTimelineProps) {
  return (
    <div className="flex items-center min-w-[200px]">
      {stages.map((stage, index) => {
        const isComplete = index < currentStage
        const isActive = index === currentStage
        const isFirst = index === 0
        const isLast = index === stages.length - 1

        return (
          <div key={stage.label} className="flex flex-col items-center flex-1">
            {/* Dot row with connecting lines */}
            <div className="flex items-center w-full">
              {/* Left line (not for first item) */}
              {!isFirst && (
                <div
                  className={`flex-1 h-0.5 ${
                    index <= currentStage ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}

              {/* Dot */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-colors ${
                    isComplete
                      ? 'bg-green-500'
                      : isActive
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                />
                {/* Pulse animation for active stage */}
                {isActive && (
                  <div className="absolute inset-0 w-3.5 h-3.5 rounded-full bg-blue-500 animate-ping opacity-75" />
                )}
              </div>

              {/* Right line (not for last item) */}
              {!isLast && (
                <div
                  className={`flex-1 h-0.5 ${
                    index < currentStage ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>

            {/* Label */}
            <span
              className={`mt-1 text-[10px] leading-tight whitespace-nowrap ${
                isComplete
                  ? 'text-green-600'
                  : isActive
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-400'
              }`}
            >
              {stage.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

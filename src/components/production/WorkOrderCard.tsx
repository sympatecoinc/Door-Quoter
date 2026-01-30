'use client'

import { useState } from 'react'
import {
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  RotateCcw
} from 'lucide-react'
import { WorkOrderStage } from '@prisma/client'

interface WorkOrderItem {
  id: string
  partNumber: string
  partName: string
  partType: string | null
  quantity: number
  openingName: string | null
  productName: string | null
}

interface Project {
  id: number
  name: string
  status: string
  dueDate: string | null
  shipDate: string | null
  customer: {
    id: number
    companyName: string
    contactName?: string | null
    phone?: string | null
  } | null
}

interface StageHistory {
  id: string
  stage: WorkOrderStage
  enteredAt: string
  exitedAt: string | null
  durationMins: number | null
  enteredBy: { id: number; name: string } | null
  exitedBy: { id: number; name: string } | null
}

export interface WorkOrderData {
  id: string
  batchNumber: number
  currentStage: WorkOrderStage
  priority: number
  notes: string | null
  createdAt: string
  updatedAt: string
  project: Project
  items: WorkOrderItem[]
  stageHistory: StageHistory[]
  timeInStageMins?: number
}

interface WorkOrderCardProps {
  workOrder: WorkOrderData
  onAdvance?: () => void
  onMove?: (targetStage: WorkOrderStage, reason?: string) => void
  showActions?: boolean
  isAdvancing?: boolean
  compact?: boolean
}

const STAGE_LABELS: Record<WorkOrderStage, string> = {
  STAGED: 'Staged',
  CUTTING: 'Cutting',
  MILLING: 'Milling',
  ASSEMBLY: 'Assembly',
  QC: 'QC',
  SHIP: 'Ship',
  COMPLETE: 'Complete'
}

const STAGE_COLORS: Record<WorkOrderStage, string> = {
  STAGED: 'bg-gray-100 text-gray-800 border-gray-300',
  CUTTING: 'bg-orange-100 text-orange-800 border-orange-300',
  MILLING: 'bg-violet-100 text-violet-800 border-violet-300',
  ASSEMBLY: 'bg-blue-100 text-blue-800 border-blue-300',
  QC: 'bg-purple-100 text-purple-800 border-purple-300',
  SHIP: 'bg-green-100 text-green-800 border-green-300',
  COMPLETE: 'bg-emerald-100 text-emerald-800 border-emerald-300'
}

function formatDuration(mins: number | undefined): string {
  if (mins === undefined || mins === null) return '--'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function WorkOrderCard({
  workOrder,
  onAdvance,
  onMove,
  showActions = true,
  isAdvancing = false,
  compact = false
}: WorkOrderCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)

  const itemsByType = workOrder.items.reduce((acc, item) => {
    const type = item.partType || 'Other'
    if (!acc[type]) acc[type] = []
    acc[type].push(item)
    return acc
  }, {} as Record<string, WorkOrderItem[]>)

  const isPriority = workOrder.priority > 0
  const isOverdue = workOrder.project.dueDate && new Date(workOrder.project.dueDate) < new Date()

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm transition-shadow hover:shadow-md ${
        isPriority ? 'border-l-4 border-l-red-500' : ''
      } ${isOverdue ? 'ring-2 ring-red-200' : ''}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {workOrder.project.name}
              </h3>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${STAGE_COLORS[workOrder.currentStage]}`}>
                {STAGE_LABELS[workOrder.currentStage]}
              </span>
              {isPriority && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                  Priority
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              <span className="font-medium">Batch #{workOrder.batchNumber}</span>
              {workOrder.project.customer && (
                <span className="ml-2">• {workOrder.project.customer.companyName}</span>
              )}
            </div>
          </div>

          {/* Time in stage */}
          <div className="flex items-center gap-1 text-sm text-gray-500 ml-2">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(workOrder.timeInStageMins)}</span>
          </div>
        </div>

        {/* Quick info row */}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Package className="w-4 h-4" />
            <span>{workOrder.items.length} items</span>
          </div>
          {workOrder.project.dueDate && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
              {isOverdue && <AlertCircle className="w-4 h-4" />}
              <span>Due: {formatDate(workOrder.project.dueDate)}</span>
            </div>
          )}
          {workOrder.project.shipDate && (
            <div className="text-gray-600">
              Ship: {formatDate(workOrder.project.shipDate)}
            </div>
          )}
        </div>

        {/* Notes preview */}
        {workOrder.notes && !compact && (
          <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800 truncate">
            {workOrder.notes.split('\n')[0]}
          </div>
        )}
      </div>

      {/* Expandable items section */}
      {!compact && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-500 bg-gray-50 border-t hover:bg-gray-100"
          >
            <span>
              {Object.entries(itemsByType).map(([type, items]) => (
                <span key={type} className="mr-3">
                  {type}: {items.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              ))}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="border-t max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Part</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Opening</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {workOrder.items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{item.partNumber}</div>
                        <div className="text-xs text-gray-500">{item.partName}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{item.partType || '--'}</td>
                      <td className="px-4 py-2 text-center">{item.quantity}</td>
                      <td className="px-4 py-2 text-gray-600">{item.openingName || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {showActions && workOrder.currentStage !== 'COMPLETE' && (
        <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between gap-2">
          {onMove && (
            <button
              onClick={() => setShowMoveModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            >
              <RotateCcw className="w-4 h-4" />
              Move
            </button>
          )}
          {onAdvance && (
            <button
              onClick={onAdvance}
              disabled={isAdvancing}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
            >
              {isAdvancing ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Advancing...
                </>
              ) : (
                <>
                  Advance
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Move Modal - simplified inline */}
      {showMoveModal && onMove && (
        <MoveWorkOrderModal
          currentStage={workOrder.currentStage}
          onMove={(targetStage, reason) => {
            onMove(targetStage, reason)
            setShowMoveModal(false)
          }}
          onClose={() => setShowMoveModal(false)}
        />
      )}
    </div>
  )
}

// Move Modal Component
function MoveWorkOrderModal({
  currentStage,
  onMove,
  onClose
}: {
  currentStage: WorkOrderStage
  onMove: (targetStage: WorkOrderStage, reason?: string) => void
  onClose: () => void
}) {
  const [targetStage, setTargetStage] = useState<WorkOrderStage | null>(null)
  const [reason, setReason] = useState('')

  const stages: WorkOrderStage[] = ['STAGED', 'CUTTING', 'ASSEMBLY', 'QC', 'SHIP', 'COMPLETE']
  const availableStages = stages.filter(s => s !== currentStage)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Move Work Order</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Stage
            </label>
            <div className="grid grid-cols-3 gap-2">
              {availableStages.map(stage => (
                <button
                  key={stage}
                  onClick={() => setTargetStage(stage)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    targetStage === stage
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {STAGE_LABELS[stage]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being moved?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={2}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => targetStage && onMove(targetStage, reason || undefined)}
            disabled={!targetStage}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  )
}

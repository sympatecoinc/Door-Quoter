'use client'

import { useState } from 'react'
import {
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export interface QCChecklistItem {
  id: string
  label: string
  category: string
  required?: boolean
}

export interface QCResult {
  itemId: string
  status: 'pass' | 'fail' | 'pending'
  notes?: string
  defectType?: string
  photoUrl?: string
}

interface QCChecklistProps {
  checklist: QCChecklistItem[]
  results: Map<string, QCResult>
  onResultChange: (itemId: string, result: Partial<QCResult>) => void
  disabled?: boolean
}

const DEFECT_TYPES = [
  'Dimension Error',
  'Hardware Issue',
  'Finish Defect',
  'Glass Damage',
  'Operation Problem',
  'Seal Issue',
  'Other'
]

export default function QCChecklist({
  checklist,
  results,
  onResultChange,
  disabled = false
}: QCChecklistProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  // Group items by category
  const itemsByCategory = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, QCChecklistItem[]>)

  // Calculate progress
  const totalItems = checklist.length
  const completedItems = checklist.filter(item => {
    const result = results.get(item.id)
    return result?.status === 'pass' || result?.status === 'fail'
  }).length
  const passedItems = checklist.filter(item => results.get(item.id)?.status === 'pass').length
  const failedItems = checklist.filter(item => results.get(item.id)?.status === 'fail').length

  const handleToggle = (itemId: string, status: 'pass' | 'fail') => {
    const currentResult = results.get(itemId)
    if (currentResult?.status === status) {
      // Toggle off
      onResultChange(itemId, { status: 'pending' })
    } else {
      // Set status
      onResultChange(itemId, { status })
      if (status === 'fail') {
        setExpandedItem(itemId)
      }
    }
  }

  const handleNotesChange = (itemId: string, notes: string) => {
    onResultChange(itemId, { notes })
  }

  const handleDefectTypeChange = (itemId: string, defectType: string) => {
    onResultChange(itemId, { defectType })
  }

  const allPassed = passedItems === totalItems && failedItems === 0
  const hasFailures = failedItems > 0

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Quality Inspection</h3>
            <p className="text-sm text-gray-600">
              Inspect each area and mark as pass or fail
            </p>
          </div>

          <div className="flex items-center gap-4">
            {allPassed && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                All Passed
              </span>
            )}
            {hasFailures && (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <XCircle className="w-5 h-5" />
                {failedItems} Failed
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex">
            {passedItems > 0 && (
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(passedItems / totalItems) * 100}%` }}
              />
            )}
            {failedItems > 0 && (
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${(failedItems / totalItems) * 100}%` }}
              />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {completedItems}/{totalItems} inspected
          </span>
        </div>
      </div>

      {/* Checklist by category */}
      <div className="space-y-4">
        {Object.entries(itemsByCategory).map(([category, items]) => {
          const categoryPassed = items.filter(i => results.get(i.id)?.status === 'pass').length
          const categoryFailed = items.filter(i => results.get(i.id)?.status === 'fail').length
          const categoryTotal = items.length
          const allCategoryPassed = categoryPassed === categoryTotal && categoryFailed === 0

          return (
            <div key={category} className="bg-white rounded-lg border overflow-hidden">
              {/* Category header */}
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{category}</span>
                  {allCategoryPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : categoryFailed > 0 ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : null}
                </div>
                <span className="text-sm text-gray-500">
                  {categoryPassed + categoryFailed}/{categoryTotal}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y">
                {items.map(item => {
                  const result = results.get(item.id)
                  const status = result?.status || 'pending'
                  const isExpanded = expandedItem === item.id

                  return (
                    <div key={item.id}>
                      <div className={`px-4 py-3 ${
                        status === 'pass' ? 'bg-green-50' :
                        status === 'fail' ? 'bg-red-50' : ''
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={status === 'pass' ? 'text-gray-500' : ''}>
                              {item.label}
                            </span>
                            {item.required && (
                              <span className="text-xs text-red-500">Required</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Pass button */}
                            <button
                              onClick={() => handleToggle(item.id, 'pass')}
                              disabled={disabled}
                              className={`p-2 rounded-lg transition-colors ${
                                status === 'pass'
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600'
                              }`}
                            >
                              <Check className="w-5 h-5" />
                            </button>

                            {/* Fail button */}
                            <button
                              onClick={() => handleToggle(item.id, 'fail')}
                              disabled={disabled}
                              className={`p-2 rounded-lg transition-colors ${
                                status === 'fail'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600'
                              }`}
                            >
                              <X className="w-5 h-5" />
                            </button>

                            {/* Expand notes */}
                            {(status === 'fail' || result?.notes) && (
                              <button
                                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                                className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5" />
                                ) : (
                                  <ChevronDown className="w-5 h-5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded details for failures */}
                      {isExpanded && status === 'fail' && (
                        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
                          <div className="space-y-3">
                            {/* Defect type */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Defect Type
                              </label>
                              <select
                                value={result?.defectType || ''}
                                onChange={(e) => handleDefectTypeChange(item.id, e.target.value)}
                                disabled={disabled}
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                              >
                                <option value="">Select defect type...</option>
                                {DEFECT_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>

                            {/* Notes */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes
                              </label>
                              <textarea
                                value={result?.notes || ''}
                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                disabled={disabled}
                                placeholder="Describe the defect..."
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                rows={2}
                              />
                            </div>

                            {/* Photo upload placeholder */}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Camera className="w-4 h-4" />
                              <span>Photo upload coming soon</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg border p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{passedItems}</div>
            <div className="text-sm text-gray-500">Passed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{failedItems}</div>
            <div className="text-sm text-gray-500">Failed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-400">{totalItems - completedItems}</div>
            <div className="text-sm text-gray-500">Pending</div>
          </div>
        </div>
      </div>
    </div>
  )
}

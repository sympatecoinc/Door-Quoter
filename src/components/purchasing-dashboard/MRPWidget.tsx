'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, AlertTriangle, CheckCircle, Package, ChevronDown, ChevronRight } from 'lucide-react'
import type { MRPResponse, MRPRequirement } from './types'

interface MRPWidgetProps {
  refreshKey?: number
  compact?: boolean
}

export default function MRPWidget({ refreshKey = 0, compact = false }: MRPWidgetProps) {
  const [data, setData] = useState<MRPResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShortagesOnly, setShowShortagesOnly] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      const response = await fetch('/api/purchasing/mrp')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching MRP data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (partNumber: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(partNumber)) {
      newExpanded.delete(partNumber)
    } else {
      newExpanded.add(partNumber)
    }
    setExpandedItems(newExpanded)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Failed to load MRP data</p>
      </div>
    )
  }

  const filteredRequirements = showShortagesOnly
    ? data.requirements.filter(r => r.gap < 0)
    : data.requirements

  const displayRequirements = compact ? filteredRequirements.slice(0, 5) : filteredRequirements

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Material Requirements</h3>
          </div>
          {!compact && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <span className="text-gray-600">Show shortages only</span>
              <button
                type="button"
                role="switch"
                aria-checked={showShortagesOnly}
                onClick={() => setShowShortagesOnly(!showShortagesOnly)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showShortagesOnly ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    showShortagesOnly ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{data.summary.totalItems}</div>
            <div className="text-xs text-gray-500">Total Items</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{data.summary.shortages}</div>
            <div className="text-xs text-red-600">Shortages</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{data.summary.adequate}</div>
            <div className="text-xs text-green-600">Adequate</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Part</th>
              <th className="text-right p-3 font-medium text-gray-600">Required</th>
              <th className="text-right p-3 font-medium text-gray-600">On Hand</th>
              <th className="text-right p-3 font-medium text-gray-600">On Order</th>
              <th className="text-right p-3 font-medium text-gray-600">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayRequirements.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p>No material shortages detected</p>
                </td>
              </tr>
            ) : (
              displayRequirements.map(req => (
                <RequirementRow
                  key={req.partNumber}
                  requirement={req}
                  expanded={expandedItems.has(req.partNumber)}
                  onToggle={() => toggleExpanded(req.partNumber)}
                  compact={compact}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {compact && filteredRequirements.length > 5 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <span className="text-sm text-gray-500">
            +{filteredRequirements.length - 5} more items
          </span>
        </div>
      )}
    </div>
  )
}

interface RequirementRowProps {
  requirement: MRPRequirement
  expanded: boolean
  onToggle: () => void
  compact: boolean
}

function RequirementRow({ requirement: req, expanded, onToggle, compact }: RequirementRowProps) {
  const isShortage = req.gap < 0

  return (
    <>
      <tr className={`hover:bg-gray-50 ${isShortage ? 'bg-red-50' : ''}`}>
        <td className="p-3">
          <div className="flex items-center gap-2">
            {!compact && req.projects.length > 0 && (
              <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            <div>
              <div className="font-medium text-gray-900">{req.partNumber}</div>
              <div className="text-xs text-gray-500">{req.description}</div>
            </div>
          </div>
        </td>
        <td className="p-3 text-right font-medium">{req.requiredQty}</td>
        <td className="p-3 text-right">{req.onHandQty}</td>
        <td className="p-3 text-right">{req.onOrderQty}</td>
        <td className={`p-3 text-right font-bold ${isShortage ? 'text-red-600' : 'text-green-600'}`}>
          {req.gap >= 0 ? '+' : ''}{req.gap}
        </td>
      </tr>
      {!compact && expanded && req.projects.length > 0 && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="p-3 pl-10">
            <div className="text-xs text-gray-500 mb-2">Required for:</div>
            <div className="space-y-1">
              {req.projects.map(project => (
                <div key={`${project.type}-${project.id}`} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      project.type === 'salesOrder'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {project.type === 'salesOrder' ? 'SO' : 'Project'}
                    </span>
                    <span className="text-gray-700">{project.name}</span>
                  </span>
                  <span className="text-gray-500">{project.qty} units</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

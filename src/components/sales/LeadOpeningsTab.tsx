'use client'

import { Plus, ExternalLink, LayoutGrid } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ProjectStatus } from '@/types'

interface PricingMode {
  id: number
  name: string
  markup: number
  extrusionMarkup: number
  hardwareMarkup: number
  glassMarkup: number
  packagingMarkup: number
  discount: number
}

interface OpeningData {
  id: number
  name: string
  finishedWidth: number | null
  finishedHeight: number | null
  roughWidth: number | null
  roughHeight: number | null
  price: number
  extrusionCost: number
  hardwareCost: number
  glassCost: number
  packagingCost: number
  otherCost: number
  standardOptionCost: number
  hybridRemainingCost: number
  finishColor: string | null
  panels: Array<{
    id: number
    type: string
    width: number
    height: number
    componentInstance?: {
      product?: {
        name: string
      }
    }
  }>
}

interface LeadData {
  id: number
  name: string
  status: ProjectStatus
  pricingMode: PricingMode | null
  openings: OpeningData[]
}


interface LeadOpeningsTabProps {
  lead: LeadData
  onOpeningsUpdated: () => void
  isCurrentVersion?: boolean
}

export default function LeadOpeningsTab({ lead, onOpeningsUpdated, isCurrentVersion = true }: LeadOpeningsTabProps) {
  const { openProjectFromSalesDashboard } = useAppStore()

  const handleOpenInEditor = () => {
    openProjectFromSalesDashboard(lead.id)
  }

  const formatDimensions = (opening: OpeningData) => {
    const width = opening.finishedWidth || opening.roughWidth
    const height = opening.finishedHeight || opening.roughHeight
    if (!width && !height) return 'No dimensions'
    return `${width || '?'}" x ${height || '?'}"`
  }

  const getPanelSummary = (panels: OpeningData['panels']) => {
    if (panels.length === 0) return 'No components'

    const nameCount = panels.reduce((acc, panel) => {
      // Use product name if available, fall back to type
      const name = panel.componentInstance?.product?.name || panel.type || 'Unknown'
      acc[name] = (acc[name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(nameCount)
      .map(([name, count]) => `${count} ${name}${count > 1 ? 's' : ''}`)
      .join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Openings ({lead.openings.length})
          </h3>
        </div>
        <button
          onClick={handleOpenInEditor}
          disabled={!isCurrentVersion}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isCurrentVersion
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          title={!isCurrentVersion ? 'Cannot edit historical versions' : undefined}
        >
          <ExternalLink className="w-4 h-4" />
          Open in Project Editor
        </button>
      </div>

      {/* Openings List */}
      {lead.openings.length > 0 ? (
        <div className="space-y-3">
          {lead.openings.map((opening) => (
            <div
              key={opening.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <LayoutGrid className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{opening.name}</h4>
                      <p className="text-sm text-gray-500">
                        {formatDimensions(opening)}
                        {opening.finishColor && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded">
                            {opening.finishColor}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 ml-11">
                    <p className="text-sm text-gray-600">
                      {getPanelSummary(opening.panels)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <LayoutGrid className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No openings yet</h3>
          <p className="text-gray-500 mb-4">
            {isCurrentVersion
              ? 'Add openings to this lead using the Project Editor.'
              : 'This historical version has no openings.'}
          </p>
          {isCurrentVersion && (
            <button
              onClick={handleOpenInEditor}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Opening
            </button>
          )}
        </div>
      )}

    </div>
  )
}

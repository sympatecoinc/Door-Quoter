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

// Helper to apply markup to a cost
function applyMarkup(baseCost: number, categoryMarkup: number, globalMarkup: number, discount: number): number {
  const markupPercent = categoryMarkup > 0 ? categoryMarkup : globalMarkup
  let price = baseCost * (1 + markupPercent / 100)
  if (discount > 0) {
    price *= (1 - discount / 100)
  }
  return price
}

// Calculate sale price for an opening using pricing mode
function calculateOpeningSalePrice(opening: OpeningData, pricingMode: PricingMode | null): number {
  if (!pricingMode) {
    return opening.price || 0
  }

  const globalMarkup = pricingMode.markup || 0
  const discount = pricingMode.discount || 0

  const markedUpExtrusion = applyMarkup(opening.extrusionCost || 0, pricingMode.extrusionMarkup || 0, globalMarkup, discount)
  const markedUpHardware = applyMarkup(opening.hardwareCost || 0, pricingMode.hardwareMarkup || 0, globalMarkup, discount)
  const markedUpGlass = applyMarkup(opening.glassCost || 0, pricingMode.glassMarkup || 0, globalMarkup, discount)
  const markedUpPackaging = applyMarkup(opening.packagingCost || 0, pricingMode.packagingMarkup || 0, globalMarkup, discount)
  const markedUpOther = applyMarkup(opening.otherCost || 0, globalMarkup, globalMarkup, discount)

  const standardOptions = opening.standardOptionCost || 0
  const hybridRemaining = opening.hybridRemainingCost || 0

  return markedUpExtrusion + markedUpHardware + markedUpGlass + markedUpPackaging + markedUpOther + standardOptions + hybridRemaining
}

interface LeadOpeningsTabProps {
  lead: LeadData
  onOpeningsUpdated: () => void
}

export default function LeadOpeningsTab({ lead, onOpeningsUpdated }: LeadOpeningsTabProps) {
  const { setSelectedProjectId, setCurrentMenu, closeSalesLeadView } = useAppStore()

  const handleOpenInEditor = () => {
    setSelectedProjectId(lead.id)
    setCurrentMenu('projects')
    closeSalesLeadView()
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

  const totalValue = lead.openings.reduce((sum, o) => sum + calculateOpeningSalePrice(o, lead.pricingMode), 0)

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Openings ({lead.openings.length})
          </h3>
          <p className="text-sm text-gray-500">
            Total: ${totalValue.toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleOpenInEditor}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              <div className="flex items-start justify-between">
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
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    ${calculateOpeningSalePrice(opening, lead.pricingMode).toLocaleString()}
                  </span>
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
            Add openings to this lead using the Project Editor.
          </p>
          <button
            onClick={handleOpenInEditor}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Opening
          </button>
        </div>
      )}

    </div>
  )
}

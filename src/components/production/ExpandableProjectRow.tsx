'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { WorkOrderStage } from '@prisma/client'
import OpeningSummaryPanel from './OpeningSummaryPanel'
import WorkOrdersPanel from './WorkOrdersPanel'
import FieldVerificationIndicator from './FieldVerificationIndicator'
import FieldVerificationPreview from './FieldVerificationPreview'

interface ProductionProject {
  id: number
  name: string
  version?: number
  openingsCount: number
  fieldVerificationCount?: number
}

interface OpeningProduct {
  id: number
  name: string
  productType: string
  width: number
  height: number
}

interface Opening {
  id: number
  name: string
  openingType: string | null
  roughWidth: number | null
  roughHeight: number | null
  finishedWidth: number | null
  finishedHeight: number | null
  finishColor: string | null
  finishCode: string | null
  products: OpeningProduct[]
}

interface WorkOrder {
  id: string
  batchNumber: number
  currentStage: WorkOrderStage
  priority: number
  itemCount: number
  completedCount: number
  progressPercent: number
}

interface ProjectVersion {
  id: number
  name: string
  version: number
  status: string
  isCurrentVersion: boolean
}

interface ProductionDetails {
  id: number
  name: string
  version: number
  openings: Opening[]
  workOrders: WorkOrder[]
  fieldVerificationUploads: {
    count: number
    uploads: Array<{
      id: number
      originalName: string
      uploadedAt: string
    }>
  }
  versions: ProjectVersion[]
}

interface ExpandableProjectRowProps {
  project: ProductionProject
  isExpanded: boolean
  onToggleExpand: () => void
  onGenerateWorkOrders: (projectId: number) => void
  isGeneratingWorkOrders: boolean
  children: React.ReactNode
}

export default function ExpandableProjectRow({
  project,
  isExpanded,
  onToggleExpand,
  onGenerateWorkOrders,
  isGeneratingWorkOrders,
  children
}: ExpandableProjectRowProps) {
  const [details, setDetails] = useState<ProductionDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFieldVerificationPreview, setShowFieldVerificationPreview] = useState(false)

  // Fetch details when expanded
  useEffect(() => {
    if (isExpanded && !details && !loading) {
      fetchDetails()
    }
  }, [isExpanded])

  async function fetchDetails() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${project.id}/production-details`)
      if (!response.ok) {
        throw new Error('Failed to fetch details')
      }
      const data = await response.json()
      setDetails(data)
    } catch (err) {
      setError('Failed to load project details')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Main row with expand button */}
      <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50/50' : ''}`}>
        {/* Expand button cell - replaces checkbox */}
        <td className="px-4 py-3">
          <button
            onClick={onToggleExpand}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </td>
        {/* Rest of the row content passed as children */}
        {children}
      </tr>

      {/* Expanded content row */}
      {isExpanded && (
        <tr className="bg-blue-50/30">
          <td colSpan={6} className="px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500">
                {error}
                <button
                  onClick={fetchDetails}
                  className="ml-2 text-blue-600 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : details ? (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Two-column layout */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                  {/* Openings - 60% width */}
                  <div className="md:col-span-3 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      Openings
                      <span className="text-xs font-normal text-gray-500">
                        ({details.openings.length})
                      </span>
                    </h3>
                    <div className="max-h-64 overflow-y-auto pr-2">
                      <OpeningSummaryPanel openings={details.openings} />
                    </div>
                  </div>

                  {/* Work Orders - 40% width */}
                  <div className="md:col-span-2 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      Work Orders
                      <span className="text-xs font-normal text-gray-500">
                        ({details.workOrders.length})
                      </span>
                    </h3>
                    <div className="max-h-64 overflow-y-auto pr-2">
                      <WorkOrdersPanel
                        workOrders={details.workOrders}
                        projectId={project.id}
                        onGenerateWorkOrders={() => onGenerateWorkOrders(project.id)}
                        isGenerating={isGeneratingWorkOrders}
                      />
                    </div>
                  </div>
                </div>

                {/* Field Verification Footer */}
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">Field Verification:</span>
                    {details.fieldVerificationUploads.count > 0 ? (
                      <FieldVerificationIndicator
                        uploadCount={details.fieldVerificationUploads.count}
                        onClick={() => setShowFieldVerificationPreview(true)}
                      />
                    ) : (
                      <span className="text-sm text-gray-500">No uploads</span>
                    )}
                  </div>

                  {/* Version badges if multiple versions exist */}
                  {details.versions.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Versions:</span>
                      <div className="flex gap-1">
                        {details.versions.map(v => (
                          <span
                            key={v.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              v.id === project.id
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            V{v.version}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </td>
        </tr>
      )}

      {/* Field Verification Preview Modal */}
      {showFieldVerificationPreview && (
        <FieldVerificationPreview
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShowFieldVerificationPreview(false)}
        />
      )}
    </>
  )
}

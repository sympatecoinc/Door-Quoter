'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, LayoutGrid, Receipt, ChevronDown } from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG, LEAD_STATUSES, PROJECT_STATUSES } from '@/types'
import StatusBadge from '@/components/projects/StatusBadge'
import LeadOverviewTab from './LeadOverviewTab'
import LeadOpeningsTab from './LeadOpeningsTab'
import LeadQuotesTab from './LeadQuotesTab'

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

interface LeadDetailData {
  id: number
  name: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  dueDate: string | null
  taxRate: number
  installationMethod: string
  installationComplexity: string
  manualInstallationCost: number
  pricingModeId: number | null
  pricingMode: PricingMode | null
  customer: {
    id: number
    companyName: string
    contactName: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    status: string
  } | null
  openings: OpeningData[]
  projectNotes: Array<{
    id: number
    content: string
    createdAt: string
    updatedAt: string
    createdBy: string | null
  }>
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
    // No pricing mode = return raw cost
    return opening.price || 0
  }

  const globalMarkup = pricingMode.markup || 0
  const discount = pricingMode.discount || 0

  const markedUpExtrusion = applyMarkup(opening.extrusionCost || 0, pricingMode.extrusionMarkup || 0, globalMarkup, discount)
  const markedUpHardware = applyMarkup(opening.hardwareCost || 0, pricingMode.hardwareMarkup || 0, globalMarkup, discount)
  const markedUpGlass = applyMarkup(opening.glassCost || 0, pricingMode.glassMarkup || 0, globalMarkup, discount)
  const markedUpPackaging = applyMarkup(opening.packagingCost || 0, pricingMode.packagingMarkup || 0, globalMarkup, discount)
  const markedUpOther = applyMarkup(opening.otherCost || 0, globalMarkup, globalMarkup, discount)

  // Standard options and hybrid remaining are not marked up
  const standardOptions = opening.standardOptionCost || 0
  const hybridRemaining = opening.hybridRemainingCost || 0

  return markedUpExtrusion + markedUpHardware + markedUpGlass + markedUpPackaging + markedUpOther + standardOptions + hybridRemaining
}

interface LeadDetailPanelProps {
  leadId: number
  onClose: () => void
  onLeadUpdated: () => void
}

type TabType = 'overview' | 'openings' | 'quotes'

export default function LeadDetailPanel({
  leadId,
  onClose,
  onLeadUpdated,
}: LeadDetailPanelProps) {
  const [lead, setLead] = useState<LeadDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('openings')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)

  const fetchLead = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${leadId}`)
      if (response.ok) {
        const data = await response.json()
        setLead(data)
      }
    } catch (error) {
      console.error('Error fetching lead:', error)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
  }, [fetchLead])

  const initiateStatusChange = (newStatus: ProjectStatus) => {
    if (!lead || updatingStatus) return
    setPendingStatus(newStatus)
    setShowStatusDropdown(false)
    setShowStatusConfirm(true)
  }

  const handleStatusChange = async () => {
    if (!lead || updatingStatus || !pendingStatus) return

    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/projects/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus }),
      })

      if (response.ok) {
        await fetchLead()
        onLeadUpdated()
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setUpdatingStatus(false)
      setShowStatusConfirm(false)
      setPendingStatus(null)
    }
  }

  const cancelStatusChange = () => {
    setShowStatusConfirm(false)
    setPendingStatus(null)
  }

  // Check if status change is moving from lead to project
  const isMovingToProject = pendingStatus && PROJECT_STATUSES.includes(pendingStatus) && lead && LEAD_STATUSES.includes(lead.status)

  // Calculate total value using sale price (with markup)
  const totalValue = lead?.openings.reduce((sum, opening) => sum + calculateOpeningSalePrice(opening, lead.pricingMode), 0) || 0

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-600">
        Failed to load lead details
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {lead.name}
              </h2>
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  disabled={updatingStatus}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  <StatusBadge status={lead.status} />
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                    <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase">Leads</div>
                    {LEAD_STATUSES.map((status) => (
                      <button
                        key={status}
                        onClick={() => initiateStatusChange(status)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          lead.status === status ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${STATUS_CONFIG[status].bgColor}`}
                        />
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase">Projects</div>
                    {PROJECT_STATUSES.map((status) => (
                      <button
                        key={status}
                        onClick={() => initiateStatusChange(status)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                          lead.status === status ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${STATUS_CONFIG[status].bgColor}`}
                        />
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {lead.customer && (
              <p className="text-sm text-gray-500 mt-1">
                {lead.customer.companyName}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="font-semibold text-gray-900">
                ${totalValue.toLocaleString()}
              </span>
              <span className="text-gray-500">
                {lead.openings.length} Opening{lead.openings.length !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500">
                Updated: {new Date(lead.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        <button
          onClick={() => setActiveTab('openings')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'openings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Openings ({lead.openings.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('quotes')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'quotes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Quotes
          </div>
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Overview
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {activeTab === 'overview' && (
          <LeadOverviewTab
            lead={lead}
            onLeadUpdated={() => {
              fetchLead()
              onLeadUpdated()
            }}
          />
        )}
        {activeTab === 'openings' && (
          <LeadOpeningsTab
            lead={lead}
            onOpeningsUpdated={() => {
              fetchLead()
              onLeadUpdated()
            }}
          />
        )}
        {activeTab === 'quotes' && (
          <LeadQuotesTab
            leadId={lead.id}
            leadName={lead.name}
          />
        )}
      </div>

      {/* Status Change Confirmation Modal */}
      {showStatusConfirm && pendingStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Status Change
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to change the status from{' '}
              <span className="font-medium">{STATUS_CONFIG[lead.status].label}</span> to{' '}
              <span className="font-medium">{STATUS_CONFIG[pendingStatus].label}</span>?
            </p>
            {isMovingToProject && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> Changing to "{STATUS_CONFIG[pendingStatus].label}" will convert this lead into a project. This may trigger additional actions like creating a Sales Order.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelStatusChange}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusChange}
                disabled={updatingStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updatingStatus ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

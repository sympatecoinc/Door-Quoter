'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, LayoutGrid, Receipt, ChevronDown, GitBranch, History, AlertTriangle } from 'lucide-react'
import { ProjectStatus, STATUS_CONFIG, LEAD_STATUSES, PROJECT_STATUSES, isLeadStatus, isProjectStatus } from '@/types'
import { SalesViewMode } from '@/stores/appStore'
import StatusBadge from '@/components/projects/StatusBadge'
import LeadOverviewTab from './LeadOverviewTab'
import LeadOpeningsTab from './LeadOpeningsTab'
import LeadQuotesTab from './LeadQuotesTab'

// Locked statuses that allow creating revisions
const LOCKED_STATUSES = [
  ProjectStatus.QUOTE_SENT,
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE
]

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
  version: number
  parentProjectId: number | null
  isCurrentVersion: boolean
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
  // Prospect fields for leads without customer
  prospectCompanyName: string | null
  prospectPhone: string | null
  prospectAddress: string | null
  prospectCity: string | null
  prospectState: string | null
  prospectZipCode: string | null
  openings: OpeningData[]
  projectNotes: Array<{
    id: number
    content: string
    createdAt: string
    updatedAt: string
    createdBy: string | null
  }>
}

interface ProjectVersion {
  id: number
  name: string
  version: number
  status: ProjectStatus
  isCurrentVersion: boolean
  createdAt: string
  _count: { openings: number }
}

interface LeadDetailPanelProps {
  leadId: number
  onClose: () => void
  onLeadUpdated: () => void
  onVersionSwitch?: (versionId: number) => void
  onStatusCategoryChange?: (newMode: SalesViewMode) => void
}

type TabType = 'overview' | 'openings' | 'quotes'

export default function LeadDetailPanel({
  leadId,
  onClose,
  onLeadUpdated,
  onVersionSwitch,
  onStatusCategoryChange,
}: LeadDetailPanelProps) {
  const [lead, setLead] = useState<LeadDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('openings')
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)

  // Version management state
  const [versions, setVersions] = useState<ProjectVersion[]>([])
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [showRevisionConfirm, setShowRevisionConfirm] = useState(false)
  const [creatingRevision, setCreatingRevision] = useState(false)

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

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${leadId}/revisions`)
      if (response.ok) {
        const data = await response.json()
        setVersions(data.versions || [])
      }
    } catch (error) {
      console.error('Error fetching versions:', error)
    }
  }, [leadId])

  useEffect(() => {
    fetchLead()
    fetchVersions()
  }, [fetchLead, fetchVersions])

  const handleCreateRevision = async () => {
    if (creatingRevision) return

    try {
      setCreatingRevision(true)
      const response = await fetch(`/api/projects/${leadId}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        // Refresh the list and notify parent
        await fetchVersions()
        onLeadUpdated()
        // Close the confirmation modal
        setShowRevisionConfirm(false)
        // Optionally switch to viewing the new revision
        // For now, we'll just refresh the current view
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create revision')
      }
    } catch (error) {
      console.error('Error creating revision:', error)
      alert('Failed to create revision')
    } finally {
      setCreatingRevision(false)
    }
  }

  const initiateStatusChange = (newStatus: ProjectStatus) => {
    if (!lead || updatingStatus) return
    setPendingStatus(newStatus)
    setShowStatusDropdown(false)
    setShowStatusConfirm(true)
  }

  const handleStatusChange = async () => {
    if (!lead || updatingStatus || !pendingStatus) return

    // Check if status is changing categories (lead → project or project → lead)
    const wasLeadStatus = isLeadStatus(lead.status)
    const willBeProjectStatus = isProjectStatus(pendingStatus)
    const wasProjectStatus = isProjectStatus(lead.status)
    const willBeLeadStatus = isLeadStatus(pendingStatus)

    try {
      setUpdatingStatus(true)
      const response = await fetch(`/api/projects/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pendingStatus }),
      })

      if (response.ok) {
        await fetchLead()

        // If changing between lead and project categories, switch the view mode
        // The mode change triggers a refetch via useEffect, so don't call onLeadUpdated
        if (wasLeadStatus && willBeProjectStatus && onStatusCategoryChange) {
          onStatusCategoryChange('projects')
        } else if (wasProjectStatus && willBeLeadStatus && onStatusCategoryChange) {
          onStatusCategoryChange('leads')
        } else {
          // Only manually refetch if staying in the same category
          onLeadUpdated()
        }
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

  // Check if project can create revision (locked status + current version)
  const canCreateRevision = lead && LOCKED_STATUSES.includes(lead.status) && lead.isCurrentVersion

  // Check if this is a historical (non-current) version
  const isHistoricalVersion = lead && !lead.isCurrentVersion

  // Check if there are multiple versions
  const hasMultipleVersions = versions.length > 1

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
      {/* Historical Version Banner */}
      {isHistoricalVersion && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <History className="w-4 h-4" />
            <span className="text-sm font-medium">
              Viewing v{lead.version} (historical) - This version is read-only
            </span>
          </div>
          {versions.find(v => v.isCurrentVersion) && (
            <button
              onClick={() => {
                const currentVersion = versions.find(v => v.isCurrentVersion)
                if (currentVersion && onVersionSwitch) {
                  onVersionSwitch(currentVersion.id)
                }
              }}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
            >
              View current version
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {lead.name}
              </h2>
              {/* Version Badge */}
              {lead.version > 1 && (
                <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded font-medium">
                  v{lead.version}
                </span>
              )}
              {/* Version Selector */}
              {hasMultipleVersions && (
                <div className="relative">
                  <button
                    onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{versions.length} versions</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showVersionDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[280px]">
                      <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase">Version History</div>
                      {versions.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setShowVersionDropdown(false)
                            if (v.id !== leadId && onVersionSwitch) {
                              onVersionSwitch(v.id)
                            }
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                            v.id === leadId ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{v.version}</span>
                            <StatusBadge status={v.status} />
                            {v.isCurrentVersion && (
                              <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">Current</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {v._count.openings} opening{v._count.openings !== 1 ? 's' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
            {lead.customer ? (
              <p className="text-sm text-gray-500 mt-1">
                {lead.customer.companyName}
                <span className="ml-1.5 px-1 py-px text-[10px] bg-blue-100 text-blue-700 rounded font-medium">Customer</span>
              </p>
            ) : lead.prospectCompanyName ? (
              <p className="text-sm text-gray-500 mt-1">
                {lead.prospectCompanyName}
                <span className="ml-1.5 px-1 py-px text-[10px] bg-orange-100 text-orange-700 rounded font-medium">Lead</span>
              </p>
            ) : null}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-gray-500">
                {lead.openings.length} Opening{lead.openings.length !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-500">
                Updated: {new Date(lead.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {/* Create Revision Button */}
          {canCreateRevision && (
            <button
              onClick={() => setShowRevisionConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              Create Revision
            </button>
          )}
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
            isCurrentVersion={lead.isCurrentVersion}
          />
        )}
        {activeTab === 'quotes' && (
          <LeadQuotesTab
            leadId={lead.id}
            leadName={lead.name}
            isCurrentVersion={lead.isCurrentVersion}
            status={lead.status}
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

      {/* Create Revision Confirmation Modal */}
      {showRevisionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <GitBranch className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Create New Revision
              </h3>
            </div>
            <p className="text-gray-600 mb-4">
              This will create a new revision (v{lead.version + 1}) of this project:
            </p>
            <ul className="text-sm text-gray-600 mb-4 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>All openings and configurations will be copied</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>The new revision will start with <strong>no quotes</strong> (clean slate)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>The new revision will be set to <strong>Staging</strong> status</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>This version (v{lead.version}) will become historical and read-only</span>
              </li>
            </ul>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRevisionConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRevision}
                disabled={creatingRevision}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {creatingRevision ? 'Creating...' : 'Create Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

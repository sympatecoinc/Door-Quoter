'use client'

import { Search } from 'lucide-react'
import StatusBadge from '@/components/projects/StatusBadge'
import { LeadSummary } from './SalesLeadView'
import { SalesViewMode } from '@/stores/appStore'

interface LeadListPanelProps {
  leads: LeadSummary[]
  loading: boolean
  selectedLeadId: number | null
  onSelectLead: (id: number | null) => void
  searchTerm: string
  onSearchChange: (term: string) => void
  viewMode: SalesViewMode
}

export default function LeadListPanel({
  leads,
  loading,
  selectedLeadId,
  onSelectLead,
  searchTerm,
  onSearchChange,
  viewMode,
}: LeadListPanelProps) {
  const listLabel = viewMode === 'leads' ? 'Leads' : 'Projects'
  const searchPlaceholder = viewMode === 'leads' ? 'Search leads...' : 'Search projects...'

  return (
    <>
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* List Header */}
      <div className="px-4 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          {listLabel} ({leads.length})
        </span>
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="p-3 bg-white rounded-lg border border-gray-200 animate-pulse"
              >
                <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-24 bg-gray-200 rounded mb-2"></div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 bg-gray-200 rounded-full"></div>
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : leads.length > 0 ? (
          <div className="p-2 space-y-2">
            {leads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => onSelectLead(lead.id)}
                className={`w-full p-3 text-left rounded-lg border transition-colors ${
                  selectedLeadId === lead.id
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900 truncate">
                  {lead.name}
                </div>
                {lead.customer && (
                  <div className="text-sm text-gray-500 truncate mt-0.5">
                    {lead.customer.companyName}
                    {lead.customer.isProspect ? (
                      <span className="ml-1.5 px-1 py-px text-[10px] bg-amber-100 text-amber-700 rounded font-medium">P</span>
                    ) : (
                      <span className="ml-1.5 px-1 py-px text-[10px] bg-blue-100 text-blue-700 rounded font-medium">C</span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={lead.status} />
                    <span className="text-xs text-gray-500">
                      {lead.openingsCount} opening{lead.openingsCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    ${lead.value.toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500 text-sm">
            No {listLabel.toLowerCase()} found
          </div>
        )}
      </div>
    </>
  )
}

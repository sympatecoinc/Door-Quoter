'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import LeadListPanel from './LeadListPanel'
import LeadDetailPanel from './LeadDetailPanel'
import { ProjectStatus, LEAD_STATUSES, PROJECT_STATUSES } from '@/types'

export interface LatestQuote {
  version: number
  totalPrice: number
}

export interface LeadSummary {
  id: number
  name: string
  status: ProjectStatus
  version: number
  value: number
  openingsCount: number
  updatedAt: string
  hasThinWall?: boolean
  hasTrimmed?: boolean
  latestQuote?: LatestQuote | null
  customer: {
    id: number
    companyName: string
    isLead: boolean
  } | null
  prospectCompanyName?: string | null
}

interface SalesLeadViewProps {
  onDataChange?: () => void
}

export default function SalesLeadView({ onDataChange }: SalesLeadViewProps) {
  const { salesLeadId, showSalesLeadView, closeSalesLeadView, setSalesLeadId, salesViewMode, setSalesViewMode } = useAppStore()
  const [leads, setLeads] = useState<LeadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen: showSalesLeadView, isBlocked: false, onClose: closeSalesLeadView },
  ])

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        // Filter based on mode - show only leads or only projects
        let filteredList: LeadSummary[]
        if (salesViewMode === 'leads') {
          filteredList = data.recentLeads || []
        } else {
          filteredList = (data.recentProjects || []).map((p: any) => ({
            ...p,
            customer: null, // Won projects don't have customer in the response
            hasThinWall: p.hasThinWall,
            hasTrimmed: p.hasTrimmed,
          }))
        }
        setLeads(filteredList)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }, [salesViewMode])

  useEffect(() => {
    if (showSalesLeadView) {
      fetchLeads()
    }
  }, [showSalesLeadView, fetchLeads])

  // Filter leads based on search (exclude archived)
  const filteredLeads = leads.filter(lead => {
    // Exclude archived leads
    if (lead.status === ProjectStatus.ARCHIVE) return false

    const searchLower = searchTerm.toLowerCase()
    return lead.name.toLowerCase().includes(searchLower) ||
      lead.customer?.companyName.toLowerCase().includes(searchLower) ||
      lead.prospectCompanyName?.toLowerCase().includes(searchLower)
  })

  if (!showSalesLeadView) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            {salesViewMode === 'leads' ? 'Current Leads' : 'Projects'}
          </h2>
          <button
            onClick={closeSalesLeadView}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Split View Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Lead List */}
          <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
            <LeadListPanel
              leads={filteredLeads}
              loading={loading}
              selectedLeadId={salesLeadId}
              onSelectLead={setSalesLeadId}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              viewMode={salesViewMode}
            />
          </div>

          {/* Right Panel - Lead Detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {salesLeadId ? (
              <LeadDetailPanel
                leadId={salesLeadId}
                onClose={() => setSalesLeadId(null)}
                onLeadUpdated={fetchLeads}
                onVersionSwitch={setSalesLeadId}
                onStatusCategoryChange={setSalesViewMode}
                onArchive={(archivedId) => {
                  setLeads(prev => prev.filter(l => l.id !== archivedId))
                  setSalesLeadId(null)
                }}
                onStatusChange={(leadId, newStatus) => {
                  // Optimistic update for modal list (instant)
                  const isMovingToProjects = salesViewMode === 'leads' && PROJECT_STATUSES.includes(newStatus)
                  const isMovingToLeads = salesViewMode === 'projects' && LEAD_STATUSES.includes(newStatus)

                  if (isMovingToProjects || isMovingToLeads) {
                    setLeads(prev => prev.filter(l => l.id !== leadId))
                  } else {
                    setLeads(prev => prev.map(l =>
                      l.id === leadId ? { ...l, status: newStatus } : l
                    ))
                  }
                }}
                onStatusChangeComplete={() => {
                  // Called AFTER API succeeds - refresh main dashboard
                  onDataChange?.()
                }}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg">Select a lead to view details</p>
                  <p className="text-sm mt-2">Click on a lead from the list on the left</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

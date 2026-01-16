'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import LeadListPanel from './LeadListPanel'
import LeadDetailPanel from './LeadDetailPanel'
import { ProjectStatus } from '@/types'

export interface LeadSummary {
  id: number
  name: string
  status: ProjectStatus
  value: number
  openingsCount: number
  updatedAt: string
  customer: {
    id: number
    companyName: string
    isProspect: boolean
  } | null
}

export default function SalesLeadView() {
  const { salesLeadId, showSalesLeadView, closeSalesLeadView, setSalesLeadId, salesViewMode } = useAppStore()
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
      const response = await fetch('/api/dashboard')
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

  // Filter leads based on search
  const filteredLeads = leads.filter(lead => {
    return lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.customer?.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Find the selected lead
  const selectedLead = leads.find(l => l.id === salesLeadId)

  if (!showSalesLeadView) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">
            {salesViewMode === 'leads' ? 'Leads' : 'Projects'}
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
            {selectedLead ? (
              <LeadDetailPanel
                leadId={selectedLead.id}
                onClose={() => setSalesLeadId(null)}
                onLeadUpdated={fetchLeads}
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

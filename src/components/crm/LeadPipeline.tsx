'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Calendar, User, Plus, Edit } from 'lucide-react'

interface Lead {
  id: number
  title: string
  description?: string
  value?: number
  probability: number
  stage: string
  source?: string
  expectedCloseDate?: string
  createdAt: string
  customer?: {
    id: number
    companyName: string
    contactName?: string
  }
  activities: any[]
}

interface LeadData {
  leads: Lead[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const stages = [
  { key: 'New', label: 'New', color: 'bg-gray-100 text-gray-800' },
  { key: 'Qualified', label: 'Qualified', color: 'bg-blue-100 text-blue-800' },
  { key: 'Proposal', label: 'Proposal', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'Negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-800' },
  { key: 'Won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { key: 'Lost', label: 'Lost', color: 'bg-red-100 text-red-800' }
]

interface LeadPipelineProps {
  onAddLead?: (stage?: string) => void
}

export default function LeadPipeline({ onAddLead }: LeadPipelineProps) {
  const [leadsByStage, setLeadsByStage] = useState<Record<string, Lead[]>>({})
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline')

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/leads?limit=100')
      if (response.ok) {
        const data: LeadData = await response.json()

        // Group leads by stage
        const grouped = stages.reduce((acc, stage) => {
          acc[stage.key] = data.leads.filter(lead => lead.stage === stage.key)
          return acc
        }, {} as Record<string, Lead[]>)

        setLeadsByStage(grouped)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const formatCurrency = (amount?: number) => {
    if (!amount) return '$0'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString()
  }

  const getStageTotal = (stage: string) => {
    return leadsByStage[stage]?.reduce((sum, lead) => sum + (lead.value || 0), 0) || 0
  }

  const renderPipelineView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
      {stages.map((stage) => (
        <div key={stage.key} className="bg-gray-50 rounded-lg p-4">
          {/* Stage Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">{stage.label}</h3>
              <p className="text-sm text-gray-600">
                {leadsByStage[stage.key]?.length || 0} leads
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {formatCurrency(getStageTotal(stage.key))}
              </p>
            </div>
          </div>

          {/* Lead Cards */}
          <div className="space-y-3">
            {leadsByStage[stage.key]?.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 text-sm truncate">
                    {lead.title}
                  </h4>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Edit className="w-3 h-3" />
                  </button>
                </div>

                {lead.customer && (
                  <div className="flex items-center text-xs text-gray-600 mb-2">
                    <User className="w-3 h-3 mr-1" />
                    {lead.customer.companyName}
                  </div>
                )}

                {lead.value && (
                  <div className="flex items-center text-xs text-gray-600 mb-2">
                    <DollarSign className="w-3 h-3 mr-1" />
                    {formatCurrency(lead.value)}
                  </div>
                )}

                {lead.expectedCloseDate && (
                  <div className="flex items-center text-xs text-gray-600 mb-2">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(lead.expectedCloseDate)}
                  </div>
                )}

                <div className="flex justify-between items-center mt-3">
                  <div className="text-xs text-gray-500">
                    {lead.probability}% probability
                  </div>
                  <div className="w-12 h-1 bg-gray-200 rounded-full">
                    <div
                      className="h-1 bg-blue-500 rounded-full"
                      style={{ width: `${lead.probability}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Add Lead Button */}
            <button
              onClick={() => onAddLead?.(stage.key)}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lead
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Probability
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expected Close
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.values(leadsByStage).flat().map((lead) => {
              const stage = stages.find(s => s.key === lead.stage)
              return (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lead.title}
                      </div>
                      {lead.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {lead.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.customer?.companyName || 'No customer'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stage?.color}`}>
                      {stage?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(lead.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lead.probability}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(lead.expectedCloseDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Pipeline</h2>
          <p className="text-sm text-gray-600">
            Total Pipeline Value: {formatCurrency(
              Object.values(leadsByStage).flat().reduce((sum, lead) => sum + (lead.value || 0), 0)
            )}
          </p>
        </div>

        <div className="flex space-x-4">
          {/* View Toggle */}
          <div className="flex border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-2 text-sm rounded-l-lg ${
                viewMode === 'pipeline'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm rounded-r-lg ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>

          <button
            onClick={() => onAddLead?.()}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : viewMode === 'pipeline' ? (
        renderPipelineView()
      ) : (
        renderListView()
      )}
    </div>
  )
}
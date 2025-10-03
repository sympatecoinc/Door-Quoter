'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, DollarSign, Calendar, TrendingUp, Target, Tag, Eye } from 'lucide-react'
import LeadForm from './LeadForm'

interface Lead {
  id: number
  customerId?: number
  title: string
  description?: string
  value?: number
  probability: number
  stage: string
  source?: string
  expectedCloseDate?: string
  actualCloseDate?: string
  lostReason?: string
  createdAt: string
  updatedAt: string
  activities: any[]
}

interface Customer {
  id: number
  companyName: string
  contactName?: string
}

interface CustomerLeadsProps {
  customerId: number
  customer: Customer
}

export default function CustomerLeads({ customerId, customer }: CustomerLeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [showDetails, setShowDetails] = useState<number | null>(null)

  useEffect(() => {
    fetchLeads()
  }, [customerId])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/leads`)
      if (response.ok) {
        const leadsData = await response.json()
        setLeads(leadsData)
      } else {
        console.error('Failed to fetch leads')
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLead = async (leadData: any) => {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...leadData,
        customerId: customerId
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create lead')
    }

    fetchLeads()
  }

  const handleUpdateLead = async (leadId: number, updates: Partial<Lead>) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (response.ok) {
        fetchLeads()
      } else {
        console.error('Failed to update lead')
      }
    } catch (error) {
      console.error('Error updating lead:', error)
    }
  }

  const handleDeleteLead = async (leadId: number) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setLeads(prev => prev.filter(lead => lead.id !== leadId))
      } else {
        console.error('Failed to delete lead')
      }
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const getStageColor = (stage: string) => {
    const colors: { [key: string]: string } = {
      'New': 'bg-gray-100 text-gray-800',
      'Qualified': 'bg-blue-100 text-blue-800',
      'Proposal': 'bg-yellow-100 text-yellow-800',
      'Negotiation': 'bg-orange-100 text-orange-800',
      'Won': 'bg-green-100 text-green-800',
      'Lost': 'bg-red-100 text-red-800'
    }
    return colors[stage] || 'bg-gray-100 text-gray-800'
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600'
    if (probability >= 50) return 'text-yellow-600'
    if (probability >= 25) return 'text-orange-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Leads for {customer.companyName}
          </h2>
          <button
            onClick={() => setShowLeadForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </button>
        </div>

        {/* Quick Stats */}
        {leads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-lg font-semibold text-gray-900">{leads.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${leads.reduce((sum, lead) => sum + (lead.value || 0), 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <Target className="w-5 h-5 text-purple-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Won Leads</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {leads.filter(lead => lead.stage === 'Won').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-orange-600 mr-2" />
                <div>
                  <p className="text-sm text-gray-600">Active Leads</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {leads.filter(lead => !['Won', 'Lost'].includes(lead.stage)).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leads List */}
      <div className="space-y-4">
        {leads.length > 0 ? (
          leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{lead.title}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStageColor(lead.stage)}`}>
                      {lead.stage}
                    </span>
                  </div>
                  {lead.description && (
                    <p className="text-gray-600 mb-3">{lead.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {lead.value && (
                      <div className="flex items-center text-gray-600">
                        <DollarSign className="w-4 h-4 mr-1" />
                        <span>${lead.value.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-600">
                      <Target className={`w-4 h-4 mr-1 ${getProbabilityColor(lead.probability)}`} />
                      <span>{lead.probability}% probability</span>
                    </div>
                    {lead.source && (
                      <div className="flex items-center text-gray-600">
                        <Tag className="w-4 h-4 mr-1" />
                        <span>{lead.source}</span>
                      </div>
                    )}
                    {lead.expectedCloseDate && (
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span>{new Date(lead.expectedCloseDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowDetails(showDetails === lead.id ? null : lead.id)}
                    className="text-blue-600 hover:text-blue-800"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingLead(lead)}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit lead"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteLead(lead.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete lead"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Stage Update Buttons */}
              {!['Won', 'Lost'].includes(lead.stage) && (
                <div className="flex space-x-2 mb-4">
                  {lead.stage !== 'Qualified' && (
                    <button
                      onClick={() => handleUpdateLead(lead.id, { stage: 'Qualified' })}
                      className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                    >
                      Mark Qualified
                    </button>
                  )}
                  {lead.stage !== 'Proposal' && (
                    <button
                      onClick={() => handleUpdateLead(lead.id, { stage: 'Proposal' })}
                      className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full hover:bg-yellow-200"
                    >
                      Move to Proposal
                    </button>
                  )}
                  {lead.stage !== 'Negotiation' && (
                    <button
                      onClick={() => handleUpdateLead(lead.id, { stage: 'Negotiation' })}
                      className="text-xs px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200"
                    >
                      Move to Negotiation
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateLead(lead.id, { stage: 'Won' })}
                    className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                  >
                    Mark Won
                  </button>
                  <button
                    onClick={() => handleUpdateLead(lead.id, { stage: 'Lost' })}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                  >
                    Mark Lost
                  </button>
                </div>
              )}

              {/* Expanded Details */}
              {showDetails === lead.id && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Created</p>
                      <p className="text-gray-600">{new Date(lead.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Last Updated</p>
                      <p className="text-gray-600">{new Date(lead.updatedAt).toLocaleString()}</p>
                    </div>
                    {lead.actualCloseDate && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Actual Close Date</p>
                        <p className="text-gray-600">{new Date(lead.actualCloseDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {lead.lostReason && (
                      <div>
                        <p className="font-medium text-gray-700 mb-1">Lost Reason</p>
                        <p className="text-gray-600">{lead.lostReason}</p>
                      </div>
                    )}
                  </div>

                  {lead.activities && lead.activities.length > 0 && (
                    <div className="mt-4">
                      <p className="font-medium text-gray-700 mb-2">Recent Activities</p>
                      <div className="space-y-2">
                        {lead.activities.slice(0, 3).map((activity: any) => (
                          <div key={activity.id} className="text-sm">
                            <p className="font-medium text-gray-900">{activity.subject}</p>
                            <p className="text-gray-600">{activity.description}</p>
                            <p className="text-xs text-gray-500">{new Date(activity.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No leads yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first lead for {customer.companyName} to track potential opportunities.
              </p>
              <button
                onClick={() => setShowLeadForm(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Lead
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lead Form Modal */}
      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        onSubmit={handleCreateLead}
        defaultStage="New"
      />
    </div>
  )
}
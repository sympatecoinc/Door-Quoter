'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, DollarSign, Activity, Plus } from 'lucide-react'
import CustomerList from '../crm/CustomerList'
import CustomerDetailView from './CustomerDetailView'
import LeadPipeline from '../crm/LeadPipeline'
import CustomerForm from '../crm/CustomerForm'
import LeadForm from '../crm/LeadForm'
import { useAppStore } from '@/stores/appStore'

interface CRMStats {
  totalCustomers: number
  activeLeads: number
  pipelineValue: number
  conversionRate: number
}

interface CRMData {
  stats: CRMStats
}

export default function CRMView() {
  const { selectedCustomerId, customerDetailView, setSelectedCustomerId, setCustomerDetailView } = useAppStore()
  const [data, setData] = useState<CRMData>({
    stats: {
      totalCustomers: 0,
      activeLeads: 0,
      pipelineValue: 0,
      conversionRate: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'leads'>('overview')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [leadFormStage, setLeadFormStage] = useState('New')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [customerFormMode, setCustomerFormMode] = useState('create')

  useEffect(() => {
    async function fetchCRMData() {
      try {
        // Fetch stats from multiple endpoints
        const [customersRes, leadsRes, allLeadsRes] = await Promise.all([
          fetch('/api/customers?limit=1'),
          fetch('/api/leads?limit=1'),
          fetch('/api/leads') // Fetch all leads to calculate conversion rate
        ])

        if (customersRes.ok && leadsRes.ok && allLeadsRes.ok) {
          const [customersData, leadsData, allLeadsData] = await Promise.all([
            customersRes.json(),
            leadsRes.json(),
            allLeadsRes.json()
          ])

          // Calculate pipeline value from leads
          const pipelineValue = leadsData.leads?.reduce((sum: number, lead: any) => {
            return sum + (lead.value || 0)
          }, 0) || 0

          // Calculate conversion rate from all leads
          const allLeads = allLeadsData.leads || []
          const wonLeads = allLeads.filter((lead: any) => lead.stage === 'Won')
          const conversionRate = allLeads.length > 0 ? Math.round((wonLeads.length / allLeads.length) * 100) : 0

          setData({
            stats: {
              totalCustomers: customersData.pagination?.total || 0,
              activeLeads: leadsData.pagination?.total || 0,
              pipelineValue,
              conversionRate
            }
          })
        }
      } catch (error) {
        console.error('Error fetching CRM data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCRMData()
  }, [refreshKey])

  const handleCustomerSubmit = async (customerData: any) => {
    if (customerFormMode === 'edit' && customerData.id) {
      const response = await fetch(`/api/customers/${customerData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      })

      if (!response.ok) {
        throw new Error('Failed to update customer')
      }
    } else {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      })

      if (!response.ok) {
        throw new Error('Failed to create customer')
      }
    }

    setRefreshKey(prev => prev + 1)
    setEditingCustomer(null)
    setCustomerFormMode('create')
  }

  const handleEditCustomer = (customer: any) => {
    setEditingCustomer(customer)
    setCustomerFormMode('edit')
    setShowCustomerForm(true)
  }

  const handleDeleteCustomer = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete customer')
      }

      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Failed to delete customer. Please try again.')
    }
  }

  const handleViewCustomer = (customer: any) => {
    setSelectedCustomerId(customer.id)
    setCustomerDetailView(true)
  }

  const handleBackToCustomers = () => {
    setSelectedCustomerId(null)
    setCustomerDetailView(false)
    setActiveTab('customers')
    setRefreshKey(prev => prev + 1)
  }

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormMode('create')
    setShowCustomerForm(true)
  }

  const handleLeadSubmit = async (leadData: any) => {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData),
    })

    if (!response.ok) {
      throw new Error('Failed to create lead')
    }

    setRefreshKey(prev => prev + 1)
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'customers', label: 'Customers' },
    { key: 'leads', label: 'Leads' }
  ]

  const renderContent = () => {
    // Show customer detail view if selected
    if (customerDetailView && selectedCustomerId) {
      return (
        <CustomerDetailView
          customerId={selectedCustomerId}
          onBack={handleBackToCustomers}
        />
      )
    }

    switch (activeTab) {
      case 'customers':
        return (
          <CustomerList
            key={refreshKey}
            onAddCustomer={handleAddCustomer}
            onEditCustomer={handleEditCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onViewCustomer={handleViewCustomer}
          />
        )
      case 'leads':
        return <LeadPipeline key={refreshKey} onAddLead={(stage) => {
          setLeadFormStage(stage || 'New')
          setShowLeadForm(true)
        }} />
      default:
        return (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Customers</p>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.totalCustomers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.activeLeads}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${data.stats.pipelineValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Activity className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{data.stats.conversionRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleAddCustomer}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Add New Customer</span>
                </button>
                <button
                  onClick={() => {
                    setLeadFormStage('New')
                    setShowLeadForm(true)
                  }}
                  className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
                >
                  <Plus className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Create New Lead</span>
                </button>
                <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors">
                  <Plus className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Schedule Activity</span>
                </button>
              </div>
            </div>

            {/* Recent Activity Placeholder */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  No recent activity to display
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="p-8">
      {/* Show header and navigation only when not in customer detail view */}
      {!customerDetailView && (
        <>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Customer Relationship Management</h1>
            <p className="text-gray-600 mt-2">Manage your customers, leads, and sales pipeline</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </>
      )}

      {/* Content */}
      {loading && !customerDetailView ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderContent()
      )}

      {/* Modals */}
      <CustomerForm
        isOpen={showCustomerForm}
        onClose={() => {
          setShowCustomerForm(false)
          setEditingCustomer(null)
          setCustomerFormMode('create')
        }}
        onSubmit={handleCustomerSubmit}
        customer={editingCustomer}
        mode={customerFormMode as 'create' | 'edit'}
      />
      <LeadForm
        isOpen={showLeadForm}
        onClose={() => setShowLeadForm(false)}
        onSubmit={handleLeadSubmit}
        defaultStage={leadFormStage}
      />
    </div>
  )
}
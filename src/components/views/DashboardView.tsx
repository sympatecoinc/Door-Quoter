'use client'

import { useState, useEffect } from 'react'
import { Folder, DollarSign, LayoutGrid, Users, TrendingUp, Activity, Plus } from 'lucide-react'
import { ProjectStatus } from '@/types'
import StatusBadge from '@/components/projects/StatusBadge'
import CustomerList from '@/components/crm/CustomerList'
import CustomerDetailView from './CustomerDetailView'
import LeadPipeline from '@/components/crm/LeadPipeline'
import CustomerForm from '@/components/crm/CustomerForm'
import LeadForm from '@/components/crm/LeadForm'
import { useAppStore } from '@/stores/appStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface DashboardStats {
  totalProjects: number
  totalLeads: number
  totalValue: number
  leadPipelineValue: number
  totalOpenings: number
}

interface RecentProject {
  id: number
  name: string
  status: ProjectStatus
  openingsCount: number
  value: number
  updatedAt: string
}

interface DashboardData {
  stats: DashboardStats
  recentProjects: RecentProject[]
  recentLeads: RecentProject[]
}

interface CRMStats {
  totalCustomers: number
  activeLeads: number
  pipelineValue: number
  conversionRate: number
}

interface ExtendedDashboardData extends DashboardData {
  crmStats: CRMStats
}

export default function DashboardView() {
  const { selectedCustomerId, customerDetailView, setSelectedCustomerId, setCustomerDetailView, setCustomerDetailTab } = useAppStore()
  const [data, setData] = useState<ExtendedDashboardData>({
    stats: {
      totalProjects: 0,
      totalLeads: 0,
      totalValue: 0,
      leadPipelineValue: 0,
      totalOpenings: 0
    },
    recentProjects: [],
    recentLeads: [],
    crmStats: {
      totalCustomers: 0,
      activeLeads: 0,
      pipelineValue: 0,
      conversionRate: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'leads'>('overview')
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [leadFormStage, setLeadFormStage] = useState('New')
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [customerFormMode, setCustomerFormMode] = useState('create')
  const [showCRMStats, setShowCRMStats] = useState(true)

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: showLeadForm, onClose: () => setShowLeadForm(false) },
    { isOpen: showCustomerForm, onClose: () => setShowCustomerForm(false) },
    { isOpen: customerDetailView && selectedCustomerId !== null, onClose: () => { setCustomerDetailView(false); setSelectedCustomerId(null) } },
  ])

  useEffect(() => {
    // Load CRM stats visibility setting
    try {
      const savedSettings = localStorage.getItem('appSettings')
      if (savedSettings) {
        const settings = JSON.parse(savedSettings)
        setShowCRMStats(settings.showDashboardCRMStats !== undefined ? settings.showDashboardCRMStats : true)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }

    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const dashboardData = await response.json()

          // Fetch CRM stats from multiple endpoints
          // Note: Use high limit to get all leads for accurate conversion rate calculation
          const [customersRes, allLeadsRes] = await Promise.all([
            fetch('/api/customers?limit=1'),
            fetch('/api/leads?limit=10000')
          ])

          if (customersRes.ok && allLeadsRes.ok) {
            const [customersData, allLeadsData] = await Promise.all([
              customersRes.json(),
              allLeadsRes.json()
            ])

            const allLeads = allLeadsData.leads || []

            // Only count leads that are not Won or Lost as "active"
            const activeLeads = allLeads.filter((lead: any) => !['Won', 'Lost'].includes(lead.stage))

            const pipelineValue = activeLeads.reduce((sum: number, lead: any) => {
              return sum + (lead.value || 0)
            }, 0) || 0

            const wonLeads = allLeads.filter((lead: any) => lead.stage === 'Won')
            const conversionRate = allLeads.length > 0 ? Math.round((wonLeads.length / allLeads.length) * 100) : 0

            dashboardData.crmStats = {
              totalCustomers: customersData.pagination?.total || 0,
              activeLeads: activeLeads.length,
              pipelineValue,
              conversionRate
            }
          }

          setData(dashboardData)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [refreshKey])

  const handleCustomerSubmit = async (customerData: any) => {
    if (customerFormMode === 'edit' && customerData.id) {
      const response = await fetch(`/api/customers/${customerData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update customer')
      }
    } else {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create customer')
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

  const handleViewCustomer = async (customer: any) => {
    // Always reset to overview tab when opening a customer
    setCustomerDetailTab('overview')
    setSelectedCustomerId(customer.id)
    setCustomerDetailView(true)

    // Update customer's updatedAt timestamp to track when it was last opened
    try {
      await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: customer.companyName,
          // Send minimal data to just trigger an update
          lastViewedAt: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Error updating customer view timestamp:', error)
    }
  }

  const handleBackToCustomers = () => {
    setSelectedCustomerId(null)
    setCustomerDetailView(false)
    setActiveTab('overview')
    setRefreshKey(prev => prev + 1)
  }

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormMode('create')
    setShowCustomerForm(true)
  }

  const handleLeadSubmit = async (leadData: any) => {
    // If the stage is a pipeline stage (Staging, Approved, Revise, Quote Sent), create a Project
    // so it appears in the Sales Pipeline. Otherwise, create a Lead in the CRM.
    const pipelineStages = ['STAGING', 'APPROVED', 'REVISE', 'QUOTE_SENT']
    const isPipelineStage = pipelineStages.includes(leadData.stage)

    if (isPipelineStage) {
      // Create a Project for pipeline stages
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadData.title,
          status: leadData.stage,
          customerId: leadData.customerId
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }
    } else {
      // Create a Lead for non-pipeline stages (e.g., 'New')
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create lead')
      }
    }
    setRefreshKey(prev => prev + 1)
  }

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'leads', label: 'Leads' }
  ]

  const renderCRMContent = () => {
    switch (activeTab) {
      case 'leads':
        return <LeadPipeline key={refreshKey} onAddLead={(stage) => {
          setLeadFormStage(stage || 'New')
          setShowLeadForm(true)
        }} />
      default:
        return (
          <div className="space-y-6">
            {/* CRM Stats Grid */}
            {showCRMStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Customers</p>
                      <p className="text-2xl font-bold text-gray-900">{data.crmStats.totalCustomers}</p>
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
                      <p className="text-2xl font-bold text-gray-900">{data.crmStats.activeLeads}</p>
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
                        ${data.crmStats.pipelineValue.toLocaleString()}
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
                      <p className="text-2xl font-bold text-gray-900">{data.crmStats.conversionRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Customers Section */}
            <CustomerList
              key={refreshKey}
              onAddCustomer={handleAddCustomer}
              onViewCustomer={handleViewCustomer}
            />

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Customers, Projects and Leads</p>
      </div>

      {/* CRM Section */}
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

      {/* CRM Content */}
      {renderCRMContent()}

      {/* Section Divider */}
      <div className="my-12 border-t-2 border-gray-200"></div>

      {/* Projects Overview Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <p className="text-gray-600 mt-2">Won projects (Quote Accepted and beyond)</p>
      </div>

      {/* Projects Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Folder className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Won Projects</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Portfolio Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.stats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <LayoutGrid className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Openings</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalOpenings}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Projects */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-12">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : data.recentProjects.length > 0 ? (
            <div className="space-y-4">
              {data.recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <StatusBadge status={project.status} />
                      <span className="text-sm text-gray-600">
                        • {project.openingsCount} opening{project.openingsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${project.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No won projects yet. Projects appear here when marked as Quote Accepted or beyond.
            </div>
          )}
        </div>
      </div>

      {/* Leads Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
        <p className="text-gray-600 mt-2">Projects in quoting phase (Staging through Quote Sent)</p>
      </div>

      {/* Leads Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Folder className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Leads</p>
              <p className="text-2xl font-bold text-gray-900">{data.stats.totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.stats.leadPipelineValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Leads</h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : data.recentLeads.length > 0 ? (
            <div className="space-y-4">
              {data.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-gray-900">{lead.name}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <StatusBadge status={lead.status} />
                      <span className="text-sm text-gray-600">
                        • {lead.openingsCount} opening{lead.openingsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${lead.value.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">
                      Updated {new Date(lead.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No active leads. Create a new project to start a lead.
            </div>
          )}
        </div>
      </div>

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

      {/* Customer Detail Modal */}
      {customerDetailView && selectedCustomerId && (
        <CustomerDetailView
          customerId={selectedCustomerId}
          onBack={handleBackToCustomers}
        />
      )}
    </div>
  )
}
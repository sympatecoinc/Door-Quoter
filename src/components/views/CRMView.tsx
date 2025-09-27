'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, DollarSign, Activity, Plus } from 'lucide-react'
import CustomerList from '../crm/CustomerList'
import LeadPipeline from '../crm/LeadPipeline'

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

  useEffect(() => {
    async function fetchCRMData() {
      try {
        // Fetch stats from multiple endpoints
        const [customersRes, leadsRes] = await Promise.all([
          fetch('/api/customers?limit=1'),
          fetch('/api/leads?limit=1')
        ])

        if (customersRes.ok && leadsRes.ok) {
          const [customersData, leadsData] = await Promise.all([
            customersRes.json(),
            leadsRes.json()
          ])

          // Calculate pipeline value from leads
          const pipelineValue = leadsData.leads?.reduce((sum: number, lead: any) => {
            return sum + (lead.value || 0)
          }, 0) || 0

          setData({
            stats: {
              totalCustomers: customersData.pagination?.total || 0,
              activeLeads: leadsData.pagination?.total || 0,
              pipelineValue,
              conversionRate: 25 // Placeholder - would calculate from actual data
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
  }, [])

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'customers', label: 'Customers' },
    { key: 'leads', label: 'Leads' }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'customers':
        return <CustomerList />
      case 'leads':
        return <LeadPipeline />
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
                <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Plus className="w-5 h-5 text-gray-400 mr-2" />
                  <span className="text-gray-600">Add New Customer</span>
                </button>
                <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors">
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

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderContent()
      )}
    </div>
  )
}
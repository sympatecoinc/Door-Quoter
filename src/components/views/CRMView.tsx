'use client'

import { useState, useEffect } from 'react'
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react'
import CustomerList from '../crm/CustomerList'
import CustomerDetailView from './CustomerDetailView'
import CustomerForm from '../crm/CustomerForm'
import { useAppStore } from '@/stores/appStore'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

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
  const { selectedCustomerId, customerDetailView, setSelectedCustomerId, setCustomerDetailView, setCustomerDetailTab } = useAppStore()
  const [data, setData] = useState<CRMData>({
    stats: {
      totalCustomers: 0,
      activeLeads: 0,
      pipelineValue: 0,
      conversionRate: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [customerFormMode, setCustomerFormMode] = useState('create')

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: showCustomerForm, onClose: () => setShowCustomerForm(false) },
    { isOpen: customerDetailView && selectedCustomerId !== null, onClose: () => { setCustomerDetailView(false); setSelectedCustomerId(null) } },
  ])

  // Cmd+N to create new customer
  useNewShortcut(
    () => setShowCustomerForm(true),
    { disabled: showCustomerForm || (customerDetailView && selectedCustomerId !== null) }
  )

  useEffect(() => {
    async function fetchCRMData() {
      try {
        const [customersRes, dashboardRes] = await Promise.all([
          fetch('/api/customers?limit=1'),
          fetch('/api/dashboard')
        ])

        if (customersRes.ok && dashboardRes.ok) {
          const [customersData, dashboardData] = await Promise.all([
            customersRes.json(),
            dashboardRes.json()
          ])

          const totalLeadsAndWon = dashboardData.stats.totalLeads + dashboardData.stats.totalProjects
          const conversionRate = totalLeadsAndWon > 0
            ? Math.round((dashboardData.stats.totalProjects / totalLeadsAndWon) * 100)
            : 0

          setData({
            stats: {
              totalCustomers: customersData.pagination?.total || 0,
              activeLeads: dashboardData.stats.totalLeads,
              pipelineValue: dashboardData.stats.leadPipelineValue,
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

  const handleArchiveCustomer = async (customerId: number) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to archive customer')
      }
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error archiving customer:', error)
      alert('Failed to archive customer. Please try again.')
    }
  }

  const handleViewCustomer = (customer: any) => {
    setCustomerDetailTab('overview')
    setSelectedCustomerId(customer.id)
    setCustomerDetailView(true)
  }

  const handleBackToCustomers = () => {
    setSelectedCustomerId(null)
    setCustomerDetailView(false)
    setRefreshKey(prev => prev + 1)
  }

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setCustomerFormMode('create')
    setShowCustomerForm(true)
  }

  const renderContent = () => {
    if (customerDetailView && selectedCustomerId) {
      return (
        <CustomerDetailView
          customerId={selectedCustomerId}
          onBack={handleBackToCustomers}
        />
      )
    }

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

        {/* Customers List */}
        <CustomerList
          key={refreshKey}
          onAddCustomer={handleAddCustomer}
          onEditCustomer={handleEditCustomer}
          onArchiveCustomer={handleArchiveCustomer}
          onViewCustomer={handleViewCustomer}
        />
      </div>
    )
  }

  return (
    <div className="p-8">
      {!customerDetailView && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customer Relationship Management</h1>
          <p className="text-gray-600 mt-2">Manage your customers and sales pipeline</p>
        </div>
      )}

      {loading && !customerDetailView ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        renderContent()
      )}

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
    </div>
  )
}

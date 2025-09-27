'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building, Calendar, Tag, FileText, Users, Briefcase, TrendingUp } from 'lucide-react'
import CustomerNotes from '../crm/CustomerNotes'
import CustomerFiles from '../crm/CustomerFiles'
import CustomerLeads from '../crm/CustomerLeads'
import CustomerProjects from '../crm/CustomerProjects'
import CustomerForm from '../crm/CustomerForm'

interface Customer {
  id: number
  companyName: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  status: string
  source?: string
  notes?: string
  createdAt: string
  updatedAt: string
  contacts: any[]
  leads: any[]
  projects: any[]
  activities: any[]
}

interface CustomerDetailViewProps {
  customerId: number
  onBack: () => void
}

export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'files' | 'leads' | 'projects'>('overview')
  const [showEditForm, setShowEditForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchCustomer()
  }, [customerId, refreshKey])

  const fetchCustomer = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}`)
      if (response.ok) {
        const customerData = await response.json()
        setCustomer(customerData)
      } else {
        console.error('Failed to fetch customer')
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerUpdate = async (customerData: any) => {
    const response = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData),
    })

    if (!response.ok) {
      throw new Error('Failed to update customer')
    }

    setRefreshKey(prev => prev + 1)
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Prospect': 'bg-blue-100 text-blue-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building },
    { key: 'notes', label: 'Notes', icon: FileText },
    { key: 'files', label: 'Files', icon: Users },
    { key: 'leads', label: 'Leads', icon: TrendingUp },
    { key: 'projects', label: 'Projects', icon: Briefcase }
  ]

  const renderTabContent = () => {
    if (!customer) return null

    switch (activeTab) {
      case 'notes':
        return <CustomerNotes customerId={customerId} />
      case 'files':
        return <CustomerFiles customerId={customerId} />
      case 'leads':
        return <CustomerLeads customerId={customerId} customer={customer} />
      case 'projects':
        return <CustomerProjects customerId={customerId} customer={customer} />
      default:
        return (
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
                <button
                  onClick={() => setShowEditForm(true)}
                  className="flex items-center px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Company Name</label>
                    <p className="text-gray-900 mt-1">{customer.companyName}</p>
                  </div>
                  {customer.contactName && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Contact Name</label>
                      <p className="text-gray-900 mt-1">{customer.contactName}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {customer.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-start text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                        <div>
                          <div>{customer.address}</div>
                          {(customer.city || customer.state || customer.zipCode) && (
                            <div>{customer.city}, {customer.state} {customer.zipCode}</div>
                          )}
                          {customer.country && <div>{customer.country}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
                        {customer.status}
                      </span>
                    </div>
                  </div>
                  {customer.source && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Source</label>
                      <div className="flex items-center mt-1 text-gray-600">
                        <Tag className="w-4 h-4 mr-2" />
                        <span>{customer.source}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <div className="flex items-center mt-1 text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <div className="flex items-center mt-1 text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{new Date(customer.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {customer.notes && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{customer.notes}</p>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.leads.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Briefcase className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Projects</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.projects.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Contacts</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.contacts.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
              {customer.activities.length > 0 ? (
                <div className="space-y-4">
                  {customer.activities.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.subject}</p>
                        {activity.description && (
                          <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No recent activity to display
                </div>
              )}
            </div>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-8">
        <div className="text-center py-8 text-gray-500">
          Customer not found
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Customers
          </button>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{customer.companyName}</h1>
            {customer.contactName && (
              <p className="text-gray-600 mt-1">Contact: {customer.contactName}</p>
            )}
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
            {customer.status}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Edit Form Modal */}
      <CustomerForm
        isOpen={showEditForm}
        onClose={() => setShowEditForm(false)}
        onSubmit={handleCustomerUpdate}
        customer={customer}
        mode="edit"
      />
    </div>
  )
}
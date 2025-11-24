'use client'

import { useState, useEffect } from 'react'
import { X, Edit, Mail, Phone, MapPin, Building, Calendar, Tag, FileText, Users, Briefcase, TrendingUp } from 'lucide-react'
import CustomerNotes from '../crm/CustomerNotes'
import CustomerFiles from '../crm/CustomerFiles'
import CustomerLeads from '../crm/CustomerLeads'
import CustomerProjects from '../crm/CustomerProjects'
import CustomerContacts from '../crm/CustomerContacts'
import CustomerForm from '../crm/CustomerForm'
import ProjectDetailModal from './ProjectDetailModal'
import { useAppStore } from '@/stores/appStore'

interface Contact {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  title: string | null
  isPrimary: boolean
}

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
  contacts: Contact[]
  leads: any[]
  projects: any[]
  activities: any[]
}

interface CustomerDetailViewProps {
  customerId: number
  onBack: () => void
}

export default function CustomerDetailView({ customerId, onBack }: CustomerDetailViewProps) {
  const { customerDetailTab, setCustomerDetailTab } = useAppStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditForm, setShowEditForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  useEffect(() => {
    // Always reset to overview tab when component mounts or customer changes
    setCustomerDetailTab('overview')
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
    const colors: { [key: string]: string } = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Prospect': 'bg-blue-100 text-blue-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building },
    { key: 'contacts', label: 'Contacts', icon: Users },
    { key: 'notes', label: 'Notes', icon: FileText },
    { key: 'files', label: 'Files', icon: Tag },
    { key: 'leads', label: 'Leads', icon: TrendingUp },
    { key: 'projects', label: 'Projects', icon: Briefcase }
  ]

  const renderTabContent = () => {
    if (!customer) return null

    // Find the primary contact
    const primaryContact = customer.contacts.find(contact => contact.isPrimary)

    switch (customerDetailTab) {
      case 'contacts':
        return <CustomerContacts customerId={customerId} customer={customer} />
      case 'notes':
        return <CustomerNotes customerId={customerId} />
      case 'files':
        return <CustomerFiles customerId={customerId} />
      case 'leads':
        return <CustomerLeads customerId={customerId} customer={customer} />
      case 'projects':
        return <CustomerProjects customerId={customerId} customer={customer} onProjectClick={setSelectedProjectId} showFullHeader={true} />
      default:
        return (
          <div className="space-y-8">
            {/* Projects Section */}
            <CustomerProjects customerId={customerId} customer={customer} onProjectClick={setSelectedProjectId} showFullHeader={false} />

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
                {/* Company Information Section */}
                <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex items-center mb-3">
                    <Building className="w-5 h-5 text-blue-600 mr-2" />
                    <h3 className="text-base font-semibold text-blue-900">Company Information</h3>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-blue-700">Company Name</label>
                    <p className="text-gray-900 mt-1 font-medium">{customer.companyName}</p>
                  </div>
                  {customer.address && (
                    <div className="flex items-start text-gray-700">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-blue-600" />
                      <div>
                        <div>{customer.address}</div>
                        {(customer.city || customer.state || customer.zipCode) && (
                          <div>{customer.city}, {customer.state} {customer.zipCode}</div>
                        )}
                        {customer.country && <div>{customer.country}</div>}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-blue-700">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
                        {customer.status}
                      </span>
                    </div>
                  </div>
                  {customer.source && (
                    <div>
                      <label className="text-sm font-medium text-blue-700">Source</label>
                      <div className="flex items-center mt-1 text-gray-700">
                        <Tag className="w-4 h-4 mr-2 text-blue-600" />
                        <span>{customer.source}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Contact Information Section */}
                <div className="space-y-4 bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex items-center mb-3">
                    <Users className="w-5 h-5 text-green-600 mr-2" />
                    <h3 className="text-base font-semibold text-green-900">Primary Contact</h3>
                  </div>
                  {!primaryContact ? (
                    <p className="text-gray-500 italic text-sm">No primary contact assigned</p>
                  ) : (
                    <>
                      <div>
                        <label className="text-sm font-medium text-green-700">Contact Name</label>
                        <p className="text-gray-900 mt-1 font-medium">
                          {primaryContact.firstName} {primaryContact.lastName}
                        </p>
                      </div>
                      {primaryContact.title && (
                        <div>
                          <label className="text-sm font-medium text-green-700">Title</label>
                          <p className="text-gray-700 mt-1">{primaryContact.title}</p>
                        </div>
                      )}
                      {primaryContact.email && (
                        <div className="flex items-center text-gray-700">
                          <Mail className="w-4 h-4 mr-2 text-green-600" />
                          <span>{primaryContact.email}</span>
                        </div>
                      )}
                      {primaryContact.phone && (
                        <div className="flex items-center text-gray-700">
                          <Phone className="w-4 h-4 mr-2 text-green-600" />
                          <span>{primaryContact.phone}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="pt-3 border-t border-green-200">
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-green-700">Created</label>
                        <div className="flex items-center mt-1 text-gray-700">
                          <Calendar className="w-4 h-4 mr-2 text-green-600" />
                          <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-green-700">Last Updated</label>
                        <div className="flex items-center mt-1 text-gray-700">
                          <Calendar className="w-4 h-4 mr-2 text-green-600" />
                          <span>{new Date(customer.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
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

  // Find the primary contact for header display
  const primaryContact = customer?.contacts.find(contact => contact.isPrimary)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-8 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl flex flex-col">
        {/* Modal Header */}
        <div className="px-8 py-6 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {loading ? (
                <div className="h-8 bg-gray-200 animate-pulse rounded w-48"></div>
              ) : customer ? (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{customer.companyName}</h1>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
                      {customer.status}
                    </span>
                  </div>
                  {primaryContact && (
                    <p className="text-gray-600 mt-1">
                      Contact: {primaryContact.firstName} {primaryContact.lastName}
                    </p>
                  )}
                </>
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">Customer Details</h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {customer && (
          <div className="px-8 border-b border-gray-200 flex-shrink-0">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setCustomerDetailTab(tab.key as any)}
                    className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                      customerDetailTab === tab.key
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
        )}

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : !customer ? (
              <div className="text-center py-12 text-gray-500">
                Customer not found
              </div>
            ) : (
              renderTabContent()
            )}
          </div>
        </div>

        {/* Edit Form Modal */}
        {customer && (
          <CustomerForm
            isOpen={showEditForm}
            onClose={() => setShowEditForm(false)}
            onSubmit={handleCustomerUpdate}
            customer={customer}
            mode="edit"
          />
        )}

        {/* Project Detail Modal */}
        {selectedProjectId && (
          <ProjectDetailModal
            projectId={selectedProjectId}
            onBack={() => setSelectedProjectId(null)}
          />
        )}
      </div>
    </div>
  )
}
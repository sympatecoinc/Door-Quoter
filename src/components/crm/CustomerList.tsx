'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Phone, Mail, MapPin } from 'lucide-react'

interface Customer {
  id: number
  companyName: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  status: string
  source?: string
  createdAt: string
  updatedAt: string
  contacts: any[]
  leads: any[]
  projects: any[]
}

interface CustomerListData {
  customers: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface CustomerListProps {
  onAddCustomer?: () => void
  onViewCustomer?: (customer: Customer) => void
}

export default function CustomerList({ onAddCustomer, onViewCustomer }: CustomerListProps) {
  const [data, setData] = useState<CustomerListData>({
    customers: [],
    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
      })

      // Add multiple status filters if any are selected
      if (statusFilters.length > 0) {
        params.append('status', statusFilters.join(','))
      }

      const response = await fetch(`/api/customers?${params}`)
      if (response.ok) {
        const customerData = await response.json()
        setData(customerData)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [currentPage, searchTerm, statusFilters])

  const toggleStatusFilter = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
    setCurrentPage(1)
  }

  const getStatusBadge = (status: string) => {
    const colors: { [key: string]: string } = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Prospect': 'bg-blue-100 text-blue-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const statuses = ['Active', 'Inactive', 'Prospect']

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Expandable Search Bar */}
          <div className="relative flex items-center">
            <button
              onClick={() => setSearchExpanded(true)}
              className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 ${searchExpanded ? 'opacity-0 pointer-events-none absolute' : ''}`}
              title="Search customers"
            >
              <Search className="w-4 h-4" />
            </button>
            {searchExpanded && (
              <div className="relative animate-expand-search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  onBlur={() => {
                    if (!searchTerm) {
                      setSearchExpanded(false)
                    }
                  }}
                  autoFocus
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-900 placeholder-gray-400 w-64"
                />
              </div>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                filtersExpanded || statusFilters.length > 0
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Filter {statusFilters.length > 0 && `(${statusFilters.length})`}
            </button>
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-out ${
              filtersExpanded ? 'max-w-[400px] opacity-100' : 'max-w-0 opacity-0'
            }`}>
              {statuses.map((status) => {
                const isActive = statusFilters.includes(status)
                const colorClasses = {
                  'Active': isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600',
                  'Inactive': isActive
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600',
                  'Prospect': isActive
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                }[status]

                return (
                  <button
                    key={status}
                    onClick={() => toggleStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${colorClasses}`}
                  >
                    {status}
                  </button>
                )
              })}
              {statusFilters.length > 0 && (
                <button
                  onClick={() => {
                    setStatusFilters([])
                    setCurrentPage(1)
                  }}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 underline whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onAddCustomer}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </button>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : data.customers.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.customers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => onViewCustomer?.(customer)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {customer.companyName}
                          </div>
                          {customer.address && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <MapPin className="w-3 h-3 mr-1" />
                              {customer.city}, {customer.state}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          {customer.contacts && customer.contacts.length > 0 && (() => {
                            const primaryContact = customer.contacts.find(c => c.isPrimary) || customer.contacts[0]
                            return (
                              <>
                                <div className="text-sm font-medium text-gray-900">
                                  {primaryContact.firstName} {primaryContact.lastName}
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  {primaryContact.email && (
                                    <div className="flex items-center">
                                      <Mail className="w-3 h-3 mr-1" />
                                      {primaryContact.email}
                                    </div>
                                  )}
                                  {primaryContact.phone && (
                                    <div className="flex items-center">
                                      <Phone className="w-3 h-3 mr-1" />
                                      {primaryContact.phone}
                                    </div>
                                  )}
                                </div>
                              </>
                            )
                          })()}
                          {(!customer.contacts || customer.contacts.length === 0) && customer.email && (
                            <div className="text-sm text-gray-500 space-y-1">
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {customer.email}
                              </div>
                            </div>
                          )}
                          {(!customer.contacts || customer.contacts.length === 0) && customer.phone && (
                            <div className="text-sm text-gray-500 space-y-1">
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {customer.phone}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.leads.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.projects.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
                          {customer.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-700">
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, data.pagination.total)} of {data.pagination.total} customers
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(data.pagination.pages, currentPage + 1))}
                      disabled={currentPage === data.pagination.pages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No customers found. Add your first customer to get started!
          </div>
        )}
      </div>
    </div>
  )
}
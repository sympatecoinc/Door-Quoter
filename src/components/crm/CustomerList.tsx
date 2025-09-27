'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Edit, Trash2, Phone, Mail, MapPin } from 'lucide-react'

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
  onEditCustomer?: (customer: Customer) => void
  onDeleteCustomer?: (customerId: number) => void
}

export default function CustomerList({ onAddCustomer, onEditCustomer, onDeleteCustomer }: CustomerListProps) {
  const [data, setData] = useState<CustomerListData>({
    customers: [],
    pagination: { page: 1, limit: 10, total: 0, pages: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter })
      })

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
  }, [currentPage, searchTerm, statusFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchCustomers()
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-gray-100 text-gray-800',
      'Prospect': 'bg-blue-100 text-blue-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const handleDeleteClick = (customer: Customer) => {
    setDeleteConfirm({ id: customer.id, name: customer.companyName })
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm) {
      onDeleteCustomer?.(deleteConfirm.id)
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700"
            >
              Search
            </button>
          </form>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Prospect">Prospect</option>
          </select>
        </div>

        <button
          onClick={onAddCustomer}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projects
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
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
                          {customer.contactName && (
                            <div className="text-sm font-medium text-gray-900">
                              {customer.contactName}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 space-y-1">
                            {customer.email && (
                              <div className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {customer.email}
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(customer.status)}`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.leads.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.projects.length}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => onEditCustomer?.(customer)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit customer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(customer)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delete Customer
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              This action cannot be undone and will remove all associated data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
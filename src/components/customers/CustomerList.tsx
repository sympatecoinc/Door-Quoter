'use client'

import { useState, useEffect, useRef } from 'react'
import { Customer, CUSTOMER_STATUSES, CUSTOMER_STATUS_CONFIG } from '@/types/customer'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Archive,
  Phone,
  Mail,
  Building2,
  MoreVertical,
  FileText,
  ShoppingCart
} from 'lucide-react'

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-36 bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-4">
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-100 rounded" />
        </div>
      </td>
      <td className="px-4 py-4 text-right">
        <div className="h-6 w-6 bg-gray-200 rounded ml-auto" />
      </td>
    </tr>
  )
}

interface CustomerListProps {
  onCustomerSelect: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onRefresh: () => void
  searchTerm?: string
  statusFilter?: string
}

export default function CustomerList({
  onCustomerSelect,
  onEdit,
  onRefresh,
  searchTerm = '',
  statusFilter = 'all'
}: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchTerm)
  const [status, setStatus] = useState(statusFilter)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const isFirstRender = useRef(true)
  const limit = 25

  useEffect(() => {
    setSearch(searchTerm)
    setStatus(statusFilter)
    setPage(1)
  }, [searchTerm, statusFilter])

  useEffect(() => {
    fetchCustomers()
  }, [page, search, status])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuOpenId && !(e.target as Element).closest('.customer-menu')) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [menuOpenId])

  async function fetchCustomers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(status !== 'all' && { status })
      })

      const response = await fetch(`/api/customers?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers)
        setTotalPages(data.pagination.pages)
        setTotal(data.pagination.total)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleArchive(customer: Customer) {
    if (!confirm(`Are you sure you want to archive "${customer.companyName}"?\n\nThis will also archive all related sales orders, invoices, and projects.`)) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCustomers()
        onRefresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to archive customer')
      }
    } catch (error) {
      console.error('Error archiving customer:', error)
      alert('Failed to archive customer')
    }

    setMenuOpenId(null)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchCustomers()
  }

  const getStatusConfig = (customerStatus: string) => {
    return CUSTOMER_STATUS_CONFIG[customerStatus as keyof typeof CUSTOMER_STATUS_CONFIG] || {
      label: customerStatus,
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {CUSTOMER_STATUSES.filter(s => s !== 'Archived').map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact Info
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <>
                {[...Array(8)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const statusConfig = getStatusConfig(customer.status)
                return (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {customer.companyName}
                          </div>
                          {customer.contactName && (
                            <div className="text-sm text-gray-500">
                              {customer.contactName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </div>
                        )}
                        {!customer.phone && !customer.email && (
                          <span className="text-sm text-gray-400">No contact info</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {(customer.leadCount !== undefined && customer.leadCount > 0) && (
                          <div className="flex items-center gap-1 text-sm text-gray-600" title="Active Leads">
                            <FileText className="w-3 h-3" />
                            <span>{customer.leadCount}</span>
                          </div>
                        )}
                        {(customer.projectCount !== undefined && customer.projectCount > 0) && (
                          <div className="flex items-center gap-1 text-sm text-gray-600" title="Active Projects">
                            <ShoppingCart className="w-3 h-3" />
                            <span>{customer.projectCount}</span>
                          </div>
                        )}
                        {(!customer.leadCount || customer.leadCount === 0) &&
                         (!customer.projectCount || customer.projectCount === 0) && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="relative customer-menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === customer.id ? null : customer.id)
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-500" />
                        </button>
                        {menuOpenId === customer.id && (
                          <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEdit(customer)
                                setMenuOpenId(null)
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                            {customer.status !== 'Archived' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchive(customer)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Archive className="w-4 h-4" />
                                Archive
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total} customers
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

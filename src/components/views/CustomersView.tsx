'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import CustomerList from '@/components/customers/CustomerList'
import CustomerForm from '@/components/customers/CustomerForm'
import { Customer } from '@/types/customer'
import { Plus, CheckCircle, AlertCircle, X, Building2, Users, Target } from 'lucide-react'
import { useNewShortcut } from '../../hooks/useKeyboardShortcut'

export default function CustomersView() {
  const { setSelectedCustomerId } = useAppStore()
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [stats, setStats] = useState<{ total: number; active: number; leads: number }>({
    total: 0,
    active: 0,
    leads: 0
  })

  useEffect(() => {
    fetchStats()
  }, [refreshKey])

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Cmd+N to create new customer
  useNewShortcut(
    () => {
      setEditingCustomer(null)
      setShowForm(true)
    },
    { disabled: showForm }
  )

  async function fetchStats() {
    try {
      const [totalRes, activeRes, leadsRes] = await Promise.all([
        fetch('/api/customers?limit=1'),
        fetch('/api/customers?limit=1&status=Active'),
        fetch('/api/customers?limit=1&status=Lead')
      ])

      if (totalRes.ok && activeRes.ok && leadsRes.ok) {
        const [totalData, activeData, leadsData] = await Promise.all([
          totalRes.json(),
          activeRes.json(),
          leadsRes.json()
        ])
        setStats({
          total: totalData.pagination.total,
          active: activeData.pagination.total,
          leads: leadsData.pagination.total
        })
      }
    } catch (error) {
      console.error('Error fetching customer stats:', error)
    }
  }

  function handleCustomerSelect(customer: Customer) {
    setSelectedCustomerId(customer.id)
  }

  function handleCreateNew() {
    setEditingCustomer(null)
    setShowForm(true)
  }

  function handleEdit(customer: Customer) {
    setEditingCustomer(customer)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingCustomer(null)
  }

  function handleFormSave() {
    setShowForm(false)
    setEditingCustomer(null)
    setRefreshKey(prev => prev + 1)
    setNotification({
      type: 'success',
      message: editingCustomer ? 'Customer updated successfully' : 'Customer created successfully'
    })
  }

  return (
    <div className="p-6">
      {/* Notifications */}
      {notification && (
        <div className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success'
              ? <CheckCircle className="w-5 h-5" />
              : <AlertCircle className="w-5 h-5" />
            }
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">
            Manage customer relationships and contact information
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total Customers</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
              <div className="text-sm text-gray-500">Active Customers</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.leads}</div>
              <div className="text-sm text-gray-500">Leads</div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer List */}
      <CustomerList
        key={refreshKey}
        onCustomerSelect={handleCustomerSelect}
        onEdit={handleEdit}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
      />

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  )
}

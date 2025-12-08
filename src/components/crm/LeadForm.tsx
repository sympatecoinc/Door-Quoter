'use client'

import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { ProjectStatus, STATUS_CONFIG, LEAD_STATUSES } from '@/types'

interface Customer {
  id: number
  companyName: string
  contactName?: string
}

interface Lead {
  id: number
  customerId?: number
  title: string
  description?: string
  value?: number
  probability: number
  stage: string
  source?: string
  expectedCloseDate?: string
}

interface LeadFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (leadData: any) => Promise<void>
  onDelete?: (leadId: number) => Promise<void>
  defaultStage?: string
  customerId?: number // Optional: pre-set customer ID (hides customer selector)
  lead?: Lead // Optional: existing lead data for edit mode
}

export default function LeadForm({ isOpen, onClose, onSubmit, onDelete, defaultStage = ProjectStatus.STAGING, customerId, lead }: LeadFormProps) {
  const isEditMode = !!lead

  const [formData, setFormData] = useState({
    customerId: customerId ? String(customerId) : '',
    title: '',
    description: '',
    value: '',
    probability: '50',
    stage: defaultStage,
    source: '',
    expectedCloseDate: ''
  })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen: isOpen, isBlocked: isSubmitting || isDeleting, onClose: onClose },
  ])

  // Initialize form data when lead is provided (edit mode)
  useEffect(() => {
    setError(null)
    if (lead) {
      setFormData({
        customerId: lead.customerId ? String(lead.customerId) : '',
        title: lead.title || '',
        description: lead.description || '',
        value: lead.value ? String(lead.value) : '',
        probability: String(lead.probability),
        stage: lead.stage,
        source: lead.source || '',
        expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.split('T')[0] : ''
      })
    }
  }, [lead])

  // Sync defaultStage prop with form state when it changes (e.g., when opening from pipeline column)
  useEffect(() => {
    if (!lead && defaultStage) {
      setFormData(prev => ({ ...prev, stage: defaultStage }))
    }
  }, [defaultStage, lead])

  useEffect(() => {
    if (isOpen && !customerId) {
      fetchCustomers()
    }
  }, [isOpen, customerId])

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await fetch('/api/customers?limit=100')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setError(null)
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) return
    if (!customerId && !formData.customerId) {
      setError('Please select a customer')
      return
    }

    setIsSubmitting(true)
    try {
      const submitData = {
        ...formData,
        customerId: formData.customerId ? parseInt(formData.customerId) : null,
        value: formData.value ? parseFloat(formData.value) : null,
        probability: parseInt(formData.probability),
        expectedCloseDate: formData.expectedCloseDate || null
      }

      await onSubmit(submitData)

      setFormData({
        customerId: customerId ? String(customerId) : '',
        title: '',
        description: '',
        value: '',
        probability: '50',
        stage: defaultStage,
        source: '',
        expectedCloseDate: ''
      })
      onClose()
    } catch (error) {
      console.error('Error creating lead:', error)
      setError(error instanceof Error ? error.message : 'Failed to create lead. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!lead || !onDelete) return

    if (!confirm(`Are you sure you want to delete the lead "${lead.title}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await onDelete(lead.id)
      onClose()
    } catch (error) {
      console.error('Error deleting lead:', error)
      alert('Failed to delete lead. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Office Door Installation Project"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {!customerId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer *
              </label>
              <select
                name="customerId"
                value={formData.customerId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a customer *</option>
                {loadingCustomers ? (
                  <option disabled>Loading customers...</option>
                ) : (
                  customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName} {customer.contactName ? `(${customer.contactName})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the lead opportunity..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Financial Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Value ($)
              </label>
              <input
                type="number"
                name="value"
                value={formData.value}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Probability (%)
              </label>
              <select
                name="probability"
                value={formData.probability}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="10">10% - Long shot</option>
                <option value="25">25% - Possible</option>
                <option value="50">50% - Likely</option>
                <option value="75">75% - Very likely</option>
                <option value="90">90% - Almost certain</option>
              </select>
            </div>
          </div>

          {/* Stage and Source */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stage
              </label>
              <select
                name="stage"
                value={formData.stage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select source...</option>
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Trade Show">Trade Show</option>
                <option value="Advertisement">Advertisement</option>
                <option value="Social Media">Social Media</option>
                <option value="Existing Customer">Existing Customer</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Close Date
            </label>
            <input
              type="date"
              name="expectedCloseDate"
              value={formData.expectedCloseDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-between pt-4">
            {/* Delete icon (left side, only in edit mode) */}
            <div>
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting || isSubmitting}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete lead"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Cancel and Submit buttons (right side) */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isDeleting || !formData.title.trim() || (!customerId && !formData.customerId)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Lead' : 'Create Lead')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
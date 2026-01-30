'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Building2, Phone, MapPin, Check } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface SearchResult {
  id: number
  type: 'customer' | 'prospect'
  companyName: string
  city?: string | null
  state?: string | null
  phone?: string | null
  address?: string | null
  zipCode?: string | null
  status?: string
  projectName?: string
  projectStatus?: string
}

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onLeadCreated: () => void
}

export default function AddLeadModal({ isOpen, onClose, onLeadCreated }: AddLeadModalProps) {
  const [formData, setFormData] = useState({
    prospectCompanyName: '',
    projectName: '',
    dueDate: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Company autocomplete state (includes customers and prospect projects)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Handle Escape key to close modal
  useEscapeKey([
    { isOpen, isBlocked: saving, onClose },
  ])

  // Search companies as user types (customers and prospect projects)
  const searchCompanies = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/search/companies?search=${encodeURIComponent(query)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results || [])
        setShowDropdown(true)
      }
    } catch (error) {
      console.error('Error searching companies:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle company name input change with debounce
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, prospectCompanyName: value })

    // Clear selected result when user types
    if (selectedResult && value !== selectedResult.companyName) {
      setSelectedResult(null)
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      searchCompanies(value)
    }, 300)
  }

  // Handle selection from dropdown (customer or prospect)
  const handleSelectResult = (result: SearchResult) => {
    setSelectedResult(result)

    if (result.type === 'customer') {
      // Just set the company name for customers
      setFormData({ ...formData, prospectCompanyName: result.companyName })
    } else {
      // For prospects, also auto-fill the optional fields
      setFormData({
        ...formData,
        prospectCompanyName: result.companyName,
        phone: result.phone || '',
        address: result.address || '',
        city: result.city || '',
        state: result.state || '',
        zipCode: result.zipCode || ''
      })
    }

    setShowDropdown(false)
    setSearchResults([])
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([])
      setSelectedResult(null)
      setShowDropdown(false)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    if (!formData.prospectCompanyName.trim()) {
      setError('Company name is required')
      return
    }
    if (!formData.projectName.trim()) {
      setError('Project name is required')
      return
    }

    try {
      setSaving(true)

      let customerId: number | undefined

      if (selectedResult?.type === 'customer') {
        // Use existing customer
        customerId = selectedResult.id
      } else {
        // Create new customer from the typed company name
        const customerResponse = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: formData.prospectCompanyName.trim(),
            phone: formData.phone.trim() || undefined,
            address: formData.address.trim() || undefined,
            city: formData.city.trim() || undefined,
            state: formData.state.trim() || undefined,
            zipCode: formData.zipCode.trim() || undefined,
            status: 'Lead'
          })
        })

        if (!customerResponse.ok) {
          const data = await customerResponse.json()
          throw new Error(data.error || 'Failed to create customer')
        }

        const newCustomer = await customerResponse.json()
        customerId = newCustomer.id
      }

      // Create project linked to customer
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.projectName.trim(),
          customerId,
          dueDate: formData.dueDate || undefined,
          status: 'STAGING'
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create lead')
      }

      // Reset form and close
      setFormData({
        prospectCompanyName: '',
        projectName: '',
        dueDate: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: ''
      })
      setSelectedResult(null)
      onLeadCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!saving) {
      setError(null)
      setFormData({
        prospectCompanyName: '',
        projectName: '',
        dueDate: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: ''
      })
      setSelectedResult(null)
      setSearchResults([])
      setShowDropdown(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Lead</h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Required Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                {selectedResult && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={formData.prospectCompanyName}
                  onChange={handleCompanyNameChange}
                  onFocus={() => {
                    if (formData.prospectCompanyName.length >= 2 && searchResults.length > 0) {
                      setShowDropdown(true)
                    }
                  }}
                  placeholder="Search or enter new company"
                  className={`w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    selectedResult ? 'pr-10 border-green-300 bg-green-50' : 'pr-4 border-gray-300'
                  }`}
                  disabled={saving}
                  autoComplete="off"
                />

                {/* Autocomplete dropdown */}
                {showDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {searchLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {/* Group results by type */}
                        {searchResults.some(r => r.type === 'customer') && (
                          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                            Existing Customers
                          </div>
                        )}
                        {searchResults
                          .filter(r => r.type === 'customer')
                          .map((result) => (
                            <button
                              key={`customer-${result.id}`}
                              type="button"
                              onClick={() => handleSelectResult(result)}
                              className="w-full px-4 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100"
                            >
                              <div className="font-medium text-gray-900">{result.companyName}</div>
                              {(result.city || result.state) && (
                                <div className="text-xs text-gray-500">
                                  {[result.city, result.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </button>
                          ))}
                        {searchResults.some(r => r.type === 'prospect') && (
                          <div className="px-3 py-2 text-xs text-gray-500 bg-amber-50 border-b border-t">
                            Existing Leads (Not Converted)
                          </div>
                        )}
                        {searchResults
                          .filter(r => r.type === 'prospect')
                          .map((result) => (
                            <button
                              key={`prospect-${result.id}`}
                              type="button"
                              onClick={() => handleSelectResult(result)}
                              className="w-full px-4 py-2 text-left hover:bg-amber-50 focus:bg-amber-50 focus:outline-none border-b border-gray-100"
                            >
                              <div className="font-medium text-gray-900">{result.companyName}</div>
                              <div className="text-xs text-amber-600">
                                {result.projectName && `Project: ${result.projectName}`}
                                {result.city || result.state ? ` • ${[result.city, result.state].filter(Boolean).join(', ')}` : ''}
                              </div>
                            </button>
                          ))}
                        <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
                          Or continue typing to create new
                        </div>
                      </>
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No matches found - a new customer will be created
                      </div>
                    )}
                  </div>
                )}
              </div>
              {selectedResult?.type === 'customer' && (
                <p className="mt-1 text-xs text-green-600">
                  Linked to existing customer
                </p>
              )}
              {selectedResult?.type === 'prospect' && (
                <p className="mt-1 text-xs text-amber-600">
                  Info filled from existing lead (new customer will be created)
                </p>
              )}
              {!selectedResult && formData.prospectCompanyName.length >= 2 && !showDropdown && (
                <p className="mt-1 text-xs text-gray-500">
                  New customer will be created
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="Enter project name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={saving}
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <p className="text-sm text-gray-500">Optional Information</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 555-5555"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zip Code
                </label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  placeholder="90210"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

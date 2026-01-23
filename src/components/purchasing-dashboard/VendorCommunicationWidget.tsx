'use client'

import { useState, useEffect } from 'react'
import { Mail, Phone, User, ExternalLink, MessageSquare, Search, Info } from 'lucide-react'

interface VendorContact {
  id: number
  displayName: string
  companyName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  contacts: Array<{
    id: number
    name: string
    title: string | null
    email: string | null
    phone: string | null
    isPrimary: boolean
  }>
}

interface VendorCommunicationWidgetProps {
  refreshKey?: number
}

export default function VendorCommunicationWidget({ refreshKey = 0 }: VendorCommunicationWidgetProps) {
  const [vendors, setVendors] = useState<VendorContact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      const response = await fetch('/api/vendors?includeContacts=true&limit=50')
      if (response.ok) {
        const result = await response.json()
        const vendorData = Array.isArray(result) ? result : result.vendors || []
        setVendors(vendorData)
      }
    } catch (error) {
      console.error('Error fetching vendor contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = vendors.filter(vendor =>
    vendor.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Vendor Communication</h3>
          </div>
        </div>

        {/* Gmail Integration Placeholder */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
          <div className="flex items-center gap-2 text-blue-700">
            <Mail className="w-4 h-4" />
            <span className="text-sm font-medium">Gmail Integration Coming Soon</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            View email threads and communication history directly in the dashboard
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {filteredVendors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No vendors found</p>
          </div>
        ) : (
          filteredVendors.slice(0, 20).map(vendor => (
            <VendorContactCard key={vendor.id} vendor={vendor} />
          ))
        )}
      </div>

      {filteredVendors.length > 20 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <span className="text-sm text-gray-500">
            +{filteredVendors.length - 20} more vendors
          </span>
        </div>
      )}
    </div>
  )
}

interface VendorContactCardProps {
  vendor: VendorContact
}

function VendorContactCard({ vendor }: VendorContactCardProps) {
  const [expanded, setExpanded] = useState(false)

  const primaryContact = vendor.contacts?.find(c => c.isPrimary) || vendor.contacts?.[0]

  return (
    <div className="p-3 hover:bg-gray-50">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => vendor.contacts?.length > 0 && setExpanded(!expanded)}
      >
        <div>
          <div className="font-medium text-gray-900">{vendor.displayName}</div>
          {vendor.companyName && vendor.companyName !== vendor.displayName && (
            <div className="text-xs text-gray-500">{vendor.companyName}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {vendor.primaryEmail && (
            <a
              href={`mailto:${vendor.primaryEmail}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
              title={vendor.primaryEmail}
            >
              <Mail className="w-4 h-4" />
            </a>
          )}
          {vendor.primaryPhone && (
            <a
              href={`tel:${vendor.primaryPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
              title={vendor.primaryPhone}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Quick Contact Info */}
      {!expanded && (vendor.primaryEmail || vendor.primaryPhone) && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          {vendor.primaryEmail && (
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {vendor.primaryEmail}
            </span>
          )}
          {vendor.primaryPhone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {vendor.primaryPhone}
            </span>
          )}
        </div>
      )}

      {/* Expanded Contacts */}
      {expanded && vendor.contacts && vendor.contacts.length > 0 && (
        <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
          {vendor.contacts.map(contact => (
            <div key={contact.id} className="text-sm">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 text-gray-400" />
                <span className="font-medium text-gray-900">{contact.name}</span>
                {contact.isPrimary && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>
                )}
              </div>
              {contact.title && (
                <div className="text-xs text-gray-500 ml-5">{contact.title}</div>
              )}
              <div className="flex flex-wrap gap-3 ml-5 mt-1">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-xs text-green-600 hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {contact.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {vendor.contacts && vendor.contacts.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          {expanded ? 'Hide contacts' : `Show ${vendor.contacts.length} contact(s)`}
        </button>
      )}
    </div>
  )
}

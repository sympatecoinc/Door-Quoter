'use client'

import { useState, useEffect } from 'react'
import { Vendor, VendorContact } from '@/types'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Phone,
  Mail,
  Globe,
  MapPin,
  Building,
  Cloud,
  User,
  Star,
  X,
  Save,
  Loader2,
  RefreshCw
} from 'lucide-react'

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vendors
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-7 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 bg-gray-100 rounded" />
                <div className="h-5 w-20 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        </div>
        <div className="h-10 w-20 bg-gray-200 rounded-lg" />
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
          <div className="h-4 w-24 bg-gray-100 rounded mb-3" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-100 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface VendorDetailViewProps {
  vendorId: number
  onBack: () => void
  onEdit: (vendor: Vendor) => void
  onRefresh: () => void
}

type Tab = 'overview' | 'contacts'

export default function VendorDetailView({ vendorId, onBack, onEdit, onRefresh }: VendorDetailViewProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<VendorContact | null>(null)
  const [contactFormData, setContactFormData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    mobile: '',
    isPrimary: false,
    notes: ''
  })
  const [savingContact, setSavingContact] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Initial sync and fetch on mount
  useEffect(() => {
    syncAndFetch()
  }, [vendorId])

  async function syncAndFetch() {
    setLoading(true)
    try {
      // Sync from QuickBooks first
      await fetch('/api/vendors/sync-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId })
      })
    } catch (error) {
      console.error('Error syncing vendor from QuickBooks:', error)
    }
    // Always fetch vendor after sync attempt
    await fetchVendor()
  }

  async function syncFromQuickBooks() {
    setSyncing(true)
    try {
      const response = await fetch('/api/vendors/sync-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId })
      })

      if (response.ok) {
        const data = await response.json()
        setVendor(data.vendor)
      }
    } catch (error) {
      console.error('Error syncing vendor from QuickBooks:', error)
    } finally {
      setSyncing(false)
    }
  }

  async function fetchVendor() {
    try {
      const response = await fetch(`/api/vendors/${vendorId}`)
      if (response.ok) {
        const data = await response.json()
        setVendor(data)
      }
    } catch (error) {
      console.error('Error fetching vendor:', error)
    } finally {
      setLoading(false)
    }
  }

  function openContactForm(contact?: VendorContact) {
    if (contact) {
      setEditingContact(contact)
      setContactFormData({
        name: contact.name,
        title: contact.title || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        isPrimary: contact.isPrimary,
        notes: contact.notes || ''
      })
    } else {
      setEditingContact(null)
      setContactFormData({
        name: '',
        title: '',
        email: '',
        phone: '',
        mobile: '',
        isPrimary: false,
        notes: ''
      })
    }
    setShowContactForm(true)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!vendor || !contactFormData.name.trim()) return

    setSavingContact(true)
    try {
      const url = editingContact
        ? `/api/vendors/${vendor.id}/contacts?contactId=${editingContact.id}`
        : `/api/vendors/${vendor.id}/contacts`

      const response = await fetch(url, {
        method: editingContact ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactFormData)
      })

      if (response.ok) {
        setShowContactForm(false)
        await fetchVendor()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save contact')
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Failed to save contact')
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(contact: VendorContact) {
    if (!vendor || !confirm(`Delete contact "${contact.name}"?`)) return

    try {
      const response = await fetch(`/api/vendors/${vendor.id}/contacts?contactId=${contact.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchVendor()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  if (loading) {
    return <DetailSkeleton onBack={onBack} />
  }

  if (!vendor) {
    return (
      <div className="p-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendors
        </button>
        <div className="text-center text-gray-500 py-8">Vendor not found</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Vendors
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{vendor.displayName}</h1>
                {vendor.quickbooksId && (
                  <button
                    onClick={syncFromQuickBooks}
                    disabled={syncing}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                    title="Click to sync from QuickBooks"
                  >
                    {syncing ? (
                      <RefreshCw className="w-4 h-4 text-green-600 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4 text-green-600" />
                    )}
                    <span className="text-sm text-green-600">
                      {syncing ? 'Syncing...' : 'Synced'}
                    </span>
                  </button>
                )}
              </div>
              {vendor.companyName && vendor.companyName !== vendor.displayName && (
                <p className="text-gray-600">{vendor.companyName}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {vendor.code && (
                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {vendor.code.toUpperCase()}
                  </span>
                )}
                {vendor.category && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {vendor.category}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  vendor.isActive
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => onEdit(vendor)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {(['overview', 'contacts'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'Overview' : `Contacts (${vendor.contacts?.length || 0})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4" />
              Basic Information
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Display Name</span>
                <span className="text-gray-900">{vendor.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Company Name</span>
                <span className="text-gray-900">{vendor.companyName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">First Name</span>
                <span className="text-gray-900">{vendor.givenName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Name</span>
                <span className="text-gray-900">{vendor.familyName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Print on Check Name</span>
                <span className="text-gray-900">{vendor.printOnCheckName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="text-gray-900">{vendor.category || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Short Code</span>
                <span className="text-gray-900 font-mono">{vendor.code?.toUpperCase() || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={vendor.isActive ? 'text-green-600' : 'text-gray-400'}>
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Email</span>
                {vendor.primaryEmail ? (
                  <a href={`mailto:${vendor.primaryEmail}`} className="text-blue-600 hover:underline">
                    {vendor.primaryEmail}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Phone</span>
                {vendor.primaryPhone ? (
                  <a href={`tel:${vendor.primaryPhone}`} className="text-gray-900">
                    {vendor.primaryPhone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Alt Phone</span>
                <span className={vendor.alternatePhone ? 'text-gray-900' : 'text-gray-400'}>
                  {vendor.alternatePhone || '-'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Mobile</span>
                <span className={vendor.mobile ? 'text-gray-900' : 'text-gray-400'}>
                  {vendor.mobile || '-'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Fax</span>
                <span className={vendor.fax ? 'text-gray-900' : 'text-gray-400'}>
                  {vendor.fax || '-'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Website</span>
                {vendor.website ? (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    {vendor.website}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Billing Address
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Address Line 1</span>
                <span className="text-gray-900">{vendor.billAddressLine1 || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Address Line 2</span>
                <span className="text-gray-900">{vendor.billAddressLine2 || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">City</span>
                <span className="text-gray-900">{vendor.billAddressCity || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">State</span>
                <span className="text-gray-900">{vendor.billAddressState || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ZIP Code</span>
                <span className="text-gray-900">{vendor.billAddressZip || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Country</span>
                <span className="text-gray-900">{vendor.billAddressCountry || '-'}</span>
              </div>
            </div>
          </div>

          {/* Tax & Payment */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Tax & Payment</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Account #</span>
                <span className={`font-mono ${vendor.acctNum ? 'text-gray-900' : 'text-gray-400'}`}>
                  {vendor.acctNum || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tax ID</span>
                <span className={`font-mono ${vendor.taxIdentifier ? 'text-gray-900' : 'text-gray-400'}`}>
                  {vendor.taxIdentifier || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Terms</span>
                <span className={vendor.termRefName ? 'text-gray-900' : 'text-gray-400'}>
                  {vendor.termRefName || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">1099 Vendor</span>
                <span className={vendor.vendor1099 ? 'text-green-600' : 'text-gray-400'}>
                  {vendor.vendor1099 ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-100">
                <span className="text-gray-500">Balance (QB)</span>
                <span className={`font-medium ${vendor.balance !== null && vendor.balance !== undefined ? 'text-gray-900' : 'text-gray-400'}`}>
                  {vendor.balance !== null && vendor.balance !== undefined
                    ? `$${vendor.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 lg:col-span-2">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Notes</h3>
            {vendor.notes ? (
              <p className="text-gray-900 whitespace-pre-wrap">{vendor.notes}</p>
            ) : (
              <p className="text-gray-400">-</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => openContactForm()}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>

          {vendor.contacts && vendor.contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendor.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          {contact.name}
                          {contact.isPrimary && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {contact.title && (
                          <div className="text-sm text-gray-500">{contact.title}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openContactForm(contact)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                    {contact.mobile && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {contact.mobile}
                        <span className="text-xs text-gray-400">(Mobile)</span>
                      </div>
                    )}
                    {contact.notes && (
                      <p className="text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        {contact.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No contacts added yet
            </div>
          )}
        </div>
      )}

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h3>
              <button
                onClick={() => setShowContactForm(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactFormData.name}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={contactFormData.title}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Sales Rep, Accounts Payable"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={contactFormData.mobile}
                    onChange={(e) => setContactFormData(prev => ({ ...prev, mobile: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  value={contactFormData.notes}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactFormData.isPrimary}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, isPrimary: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Primary contact</span>
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

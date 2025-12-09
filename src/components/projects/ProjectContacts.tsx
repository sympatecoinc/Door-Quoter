'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X, Building2, HardHat, User, Users, ChevronDown } from 'lucide-react'

interface ProjectContact {
  id: number
  projectId: number
  contactType: 'ARCHITECT' | 'GENERAL_CONTRACTOR' | 'OTHER'
  companyName: string | null
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CustomerContact {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  title: string | null
  isPrimary: boolean
}

interface ProjectContactsProps {
  projectId: number
  customerId?: number
}

const contactTypeLabels = {
  ARCHITECT: 'Architect',
  GENERAL_CONTRACTOR: 'General Contractor',
  OTHER: 'Other Contact'
}

const contactTypeIcons = {
  ARCHITECT: Building2,
  GENERAL_CONTRACTOR: HardHat,
  OTHER: User
}

export default function ProjectContacts({ projectId, customerId }: ProjectContactsProps) {
  const [contacts, setContacts] = useState<ProjectContact[]>([])
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [showImportDropdown, setShowImportDropdown] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    contactType: 'ARCHITECT' as 'ARCHITECT' | 'GENERAL_CONTRACTOR' | 'OTHER',
    companyName: '',
    name: '',
    email: '',
    phone: '',
    notes: ''
  })

  useEffect(() => {
    fetchContacts()
    if (customerId) {
      fetchCustomerContacts()
    }
  }, [projectId, customerId])

  const fetchCustomerContacts = async () => {
    if (!customerId) return
    try {
      const response = await fetch(`/api/customers/${customerId}/contacts`)
      if (response.ok) {
        const data = await response.json()
        setCustomerContacts(data)
      }
    } catch (err) {
      console.error('Error fetching customer contacts:', err)
    }
  }

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/contacts`)
      if (!response.ok) throw new Error('Failed to fetch contacts')
      const data = await response.json()
      setContacts(data)
    } catch (err) {
      console.error('Error fetching contacts:', err)
      setError('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      contactType: 'ARCHITECT',
      companyName: '',
      name: '',
      email: '',
      phone: '',
      notes: ''
    })
  }

  const handleAddContact = async () => {
    if (!formData.name.trim()) {
      setError('Contact name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to create contact')

      await fetchContacts()
      resetForm()
      setIsAdding(false)
    } catch (err) {
      console.error('Error creating contact:', err)
      setError('Failed to create contact')
    } finally {
      setSaving(false)
    }
  }

  const handleImportCustomerContact = async (customerContact: CustomerContact) => {
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactType: 'OTHER',
          companyName: '',
          name: `${customerContact.firstName} ${customerContact.lastName}`,
          email: customerContact.email || '',
          phone: customerContact.phone || '',
          notes: customerContact.title ? `Title: ${customerContact.title}` : ''
        })
      })

      if (!response.ok) throw new Error('Failed to import contact')

      await fetchContacts()
      setShowImportDropdown(false)
    } catch (err) {
      console.error('Error importing contact:', err)
      setError('Failed to import contact')
    } finally {
      setSaving(false)
    }
  }

  const handleEditContact = async (contactId: number) => {
    if (!formData.name.trim()) {
      setError('Contact name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to update contact')

      await fetchContacts()
      setEditingId(null)
      resetForm()
    } catch (err) {
      console.error('Error updating contact:', err)
      setError('Failed to update contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/contacts/${contactId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete contact')

      await fetchContacts()
    } catch (err) {
      console.error('Error deleting contact:', err)
      setError('Failed to delete contact')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (contact: ProjectContact) => {
    setEditingId(contact.id)
    setFormData({
      contactType: contact.contactType,
      companyName: contact.companyName || '',
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      notes: contact.notes || ''
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    resetForm()
    setError(null)
  }

  const renderContactForm = (isEdit: boolean, contactId?: number) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Contact Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contact Type *
        </label>
        <select
          value={formData.contactType}
          onChange={(e) => setFormData({ ...formData, contactType: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        >
          <option value="ARCHITECT">Architect</option>
          <option value="GENERAL_CONTRACTOR">General Contractor</option>
          <option value="OTHER">Other Contact</option>
        </select>
      </div>

      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Name
        </label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        />
      </div>

      {/* Contact Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contact Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={saving}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        <button
          onClick={isEdit ? cancelEditing : () => {
            setIsAdding(false)
            resetForm()
            setError(null)
          }}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={() => isEdit && contactId ? handleEditContact(contactId) : handleAddContact()}
          disabled={saving || !formData.name.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : (isEdit ? 'Update Contact' : 'Add Contact')}
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Add Contact Button with Import Option */}
      {!isAdding && (
        <div className="relative">
          <div className="flex gap-2">
            <button
              onClick={() => setIsAdding(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Contact</span>
            </button>
            {customerContacts.length > 0 && (
              <button
                onClick={() => setShowImportDropdown(!showImportDropdown)}
                className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                title="Import from customer contacts"
              >
                <Users className="w-5 h-5" />
                <ChevronDown className={`w-4 h-4 transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Customer Contacts Dropdown */}
          {showImportDropdown && customerContacts.length > 0 && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <span className="text-sm font-medium text-gray-700">Import from Customer</span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {customerContacts.map((cc) => (
                  <button
                    key={cc.id}
                    onClick={() => handleImportCustomerContact(cc)}
                    disabled={saving}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors disabled:opacity-50 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {cc.firstName} {cc.lastName}
                          {cc.isPrimary && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>
                          )}
                        </div>
                        {cc.title && (
                          <div className="text-xs text-gray-500">{cc.title}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Contact Form */}
      {isAdding && renderContactForm(false)}

      {/* Contacts List */}
      <div className="space-y-3">
        {contacts.length === 0 && !isAdding && (
          <div className="text-center py-8 text-gray-500">
            No contacts yet. Click &quot;Add Contact&quot; to create one.
          </div>
        )}

        {contacts.map((contact) => {
          const Icon = contactTypeIcons[contact.contactType]

          return (
            <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4">
              {editingId === contact.id ? (
                renderContactForm(true, contact.id)
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          {contactTypeLabels[contact.contactType]}
                        </div>
                        <div className="font-semibold text-gray-900">{contact.name}</div>
                        {contact.companyName && (
                          <div className="text-sm text-gray-600">{contact.companyName}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditing(contact)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit contact"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Email:</span>
                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Phone:</span>
                        <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.notes && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500">Notes: </span>
                        <span className="text-gray-700">{contact.notes}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { Plus, Users } from 'lucide-react'
import ContactCard from './ContactCard'
import ContactForm, { ContactFormData } from './ContactForm'
import { useEscapeKey } from '../../hooks/useEscapeKey'

interface Contact {
  id: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  title: string | null
  isPrimary: boolean
  // ClickUp CRM fields
  relationshipStatus?: string | null
  lastContactDate?: string | null
  isActive?: boolean
  clickupContactId?: string | null
}

interface CustomerContactsProps {
  customerId: number
  customer?: any
}

export default function CustomerContacts({ customerId }: CustomerContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [deleteConfirm, setDeleteConfirm] = useState<Contact | null>(null)

  // Handle Escape key to close modals one at a time
  useEscapeKey([
    { isOpen: deleteConfirm !== null, onClose: () => setDeleteConfirm(null) },
    { isOpen: isFormOpen, onClose: () => setIsFormOpen(false) },
  ])

  useEffect(() => {
    fetchContacts()
  }, [customerId])

  const fetchContacts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/contacts`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      } else {
        console.error('Failed to fetch contacts')
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = () => {
    setEditingContact(null)
    setFormMode('create')
    setIsFormOpen(true)
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setFormMode('edit')
    setIsFormOpen(true)
  }

  const handleDeleteContact = (contact: Contact) => {
    setDeleteConfirm(contact)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const response = await fetch(
        `/api/customers/${customerId}/contacts/${deleteConfirm.id}`,
        {
          method: 'DELETE'
        }
      )

      if (response.ok) {
        await fetchContacts()
        setDeleteConfirm(null)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  const handleSetPrimary = async (contact: Contact) => {
    try {
      const response = await fetch(
        `/api/customers/${customerId}/contacts/${contact.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrimary: true })
        }
      )

      if (response.ok) {
        await fetchContacts()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to set primary contact')
      }
    } catch (error) {
      console.error('Error setting primary contact:', error)
      alert('Failed to set primary contact')
    }
  }

  const handleFormSubmit = async (formData: ContactFormData) => {
    if (formMode === 'create') {
      // Create new contact
      const response = await fetch(`/api/customers/${customerId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create contact')
      }

      await fetchContacts()
    } else if (formMode === 'edit' && editingContact) {
      // Update existing contact
      const response = await fetch(
        `/api/customers/${customerId}/contacts/${editingContact.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update contact')
      }

      await fetchContacts()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Contacts ({contacts.length})
        </h2>
        <button
          onClick={handleAddContact}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
          <p className="text-gray-600 mb-4">
            Add your first contact to get started managing customer relationships.
          </p>
          <button
            onClick={handleAddContact}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEditContact}
              onDelete={handleDeleteContact}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      )}

      <ContactForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        contact={editingContact}
        mode={formMode}
      />

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Delete Contact
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{' '}
              <strong>
                {deleteConfirm.firstName} {deleteConfirm.lastName}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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

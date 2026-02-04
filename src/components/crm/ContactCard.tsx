import React from 'react'
import { Mail, Phone, Briefcase, Edit2, Trash2, Star, Clock, Activity } from 'lucide-react'

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

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  onSetPrimary: (contact: Contact) => void
}

export default function ContactCard({
  contact,
  onEdit,
  onDelete,
  onSetPrimary
}: ContactCardProps) {
  return (
    <div className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${
      contact.isPrimary ? 'border-blue-500 border-2' : 'border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {contact.firstName} {contact.lastName}
            </h3>
            {contact.isPrimary && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Primary
              </span>
            )}
          </div>
          {contact.title && (
            <div className="flex items-center text-sm text-gray-600 mt-1">
              <Briefcase className="w-4 h-4 mr-2 flex-shrink-0" />
              {contact.title}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(contact)}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit contact"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {!contact.isPrimary && (
            <button
              onClick={() => onSetPrimary(contact)}
              className="text-gray-400 hover:text-yellow-500 transition-colors"
              title="Set as primary contact"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(contact)}
            className="text-gray-500 hover:text-red-600 transition-colors"
            title="Delete contact"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {contact.email && (
          <div className="flex items-center text-sm text-gray-600">
            <Mail className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
            <a
              href={`mailto:${contact.email}`}
              className="hover:text-blue-600 transition-colors truncate"
            >
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
            <a
              href={`tel:${contact.phone}`}
              className="hover:text-blue-600 transition-colors"
            >
              {contact.phone}
            </a>
          </div>
        )}
      </div>

      {/* ClickUp CRM Fields */}
      {(contact.relationshipStatus || contact.lastContactDate) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {contact.relationshipStatus && (
            <div className="flex items-center text-sm">
              <Activity className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                contact.relationshipStatus === 'Strong/Trusted' ? 'bg-green-100 text-green-800' :
                contact.relationshipStatus === 'Warm/Active' ? 'bg-blue-100 text-blue-800' :
                contact.relationshipStatus === 'New/Recently Introduced' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {contact.relationshipStatus}
              </span>
            </div>
          )}
          {contact.lastContactDate && (
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
              Last contact: {new Date(contact.lastContactDate).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

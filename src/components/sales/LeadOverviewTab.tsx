'use client'

import { useState } from 'react'
import { Building, User, Phone, Mail, MapPin, Calendar, FileText, Save } from 'lucide-react'
import { ProjectStatus } from '@/types'

interface LeadData {
  id: number
  name: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  dueDate: string | null
  customer: {
    id: number
    companyName: string
    contactName: string | null
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    status: string
  } | null
  projectNotes: Array<{
    id: number
    content: string
    createdAt: string
    updatedAt: string
    createdBy: string | null
  }>
}

interface LeadOverviewTabProps {
  lead: LeadData
  onLeadUpdated: () => void
}

export default function LeadOverviewTab({ lead, onLeadUpdated }: LeadOverviewTabProps) {
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [editingDueDate, setEditingDueDate] = useState(false)
  const [dueDate, setDueDate] = useState(lead.dueDate?.split('T')[0] || '')
  const [savingDueDate, setSavingDueDate] = useState(false)

  const handleAddNote = async () => {
    if (!noteContent.trim() || savingNote) return

    try {
      setSavingNote(true)
      const response = await fetch(`/api/projects/${lead.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      })

      if (response.ok) {
        setNoteContent('')
        onLeadUpdated()
      }
    } catch (error) {
      console.error('Error adding note:', error)
    } finally {
      setSavingNote(false)
    }
  }

  const handleSaveDueDate = async () => {
    if (savingDueDate) return

    try {
      setSavingDueDate(true)
      const response = await fetch(`/api/projects/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: dueDate || null }),
      })

      if (response.ok) {
        setEditingDueDate(false)
        onLeadUpdated()
      }
    } catch (error) {
      console.error('Error updating due date:', error)
    } finally {
      setSavingDueDate(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Customer Info Card */}
      {lead.customer && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-500" />
            Customer Information
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Company</p>
              <p className="font-medium text-gray-900">{lead.customer.companyName}</p>
            </div>
            {lead.customer.contactName && (
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Contact
                </p>
                <p className="font-medium text-gray-900">{lead.customer.contactName}</p>
              </div>
            )}
            {lead.customer.phone && (
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </p>
                <a
                  href={`tel:${lead.customer.phone}`}
                  className="font-medium text-blue-600 hover:text-blue-800"
                >
                  {lead.customer.phone}
                </a>
              </div>
            )}
            {lead.customer.email && (
              <div>
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </p>
                <a
                  href={`mailto:${lead.customer.email}`}
                  className="font-medium text-blue-600 hover:text-blue-800"
                >
                  {lead.customer.email}
                </a>
              </div>
            )}
            {(lead.customer.address || lead.customer.city) && (
              <div className="col-span-2">
                <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </p>
                <p className="font-medium text-gray-900">
                  {[
                    lead.customer.address,
                    lead.customer.city,
                    lead.customer.state,
                    lead.customer.zipCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Dates Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          Key Dates
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Created</p>
            <p className="font-medium text-gray-900">{formatDate(lead.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Last Updated</p>
            <p className="font-medium text-gray-900">{formatDate(lead.updatedAt)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Due Date</p>
            {editingDueDate ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSaveDueDate}
                  disabled={savingDueDate}
                  className="p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingDueDate(false)
                    setDueDate(lead.dueDate?.split('T')[0] || '')
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingDueDate(true)}
                className="font-medium text-gray-900 hover:text-blue-600"
              >
                {lead.dueDate ? formatDate(lead.dueDate) : 'Not set - Click to add'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          Notes
        </h3>

        {/* Add Note Form */}
        <div className="mb-4">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleAddNote}
              disabled={!noteContent.trim() || savingNote}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingNote ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Notes List */}
        {lead.projectNotes.length > 0 ? (
          <div className="space-y-3">
            {lead.projectNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <p className="text-gray-800 whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{formatDateTime(note.createdAt)}</span>
                  {note.createdBy && (
                    <>
                      <span>•</span>
                      <span>{note.createdBy}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No notes yet. Add one above.
          </p>
        )}
      </div>
    </div>
  )
}

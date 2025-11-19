'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'

interface ProjectNote {
  id: number
  projectId: number
  content: string
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

interface ProjectNotesProps {
  projectId: number
}

export default function ProjectNotes({ projectId }: ProjectNotesProps) {
  const [notes, setNotes] = useState<ProjectNote[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNotes()
  }, [projectId])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/notes`)
      if (!response.ok) throw new Error('Failed to fetch notes')
      const data = await response.json()
      setNotes(data)
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent })
      })

      if (!response.ok) throw new Error('Failed to create note')

      await fetchNotes()
      setNewNoteContent('')
      setIsAdding(false)
    } catch (err) {
      console.error('Error creating note:', err)
      setError('Failed to create note')
    } finally {
      setSaving(false)
    }
  }

  const handleEditNote = async (noteId: number) => {
    if (!editContent.trim()) {
      setError('Note content cannot be empty')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      })

      if (!response.ok) throw new Error('Failed to update note')

      await fetchNotes()
      setEditingId(null)
      setEditContent('')
    } catch (err) {
      console.error('Error updating note:', err)
      setError('Failed to update note')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete note')

      await fetchNotes()
    } catch (err) {
      console.error('Error deleting note:', err)
      setError('Failed to delete note')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (note: ProjectNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading notes...</div>
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

      {/* Add Note Button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Note</span>
        </button>
      )}

      {/* Add Note Form */}
      {isAdding && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Enter note content..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={saving}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setIsAdding(false)
                setNewNoteContent('')
                setError(null)
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleAddNote}
              disabled={saving || !newNoteContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {notes.length === 0 && !isAdding && (
          <div className="text-center py-8 text-gray-500">
            No notes yet. Click &quot;Add Note&quot; to create one.
          </div>
        )}

        {notes.map((note) => (
          <div key={note.id} className="bg-white border border-gray-200 rounded-lg p-4">
            {editingId === note.id ? (
              // Edit Mode
              <div className="space-y-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={saving}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelEditing}
                    className="px-3 py-1.5 text-gray-600 hover:text-gray-800 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditNote(note.id)}
                    disabled={saving || !editContent.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="text-xs text-gray-500">
                    {formatDate(note.createdAt)}
                    {note.updatedAt !== note.createdAt && (
                      <span className="ml-2">(edited)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(note)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit note"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Users } from 'lucide-react'
import { ALL_TABS } from '@/lib/permissions'

interface Profile {
  id: number
  name: string
  description: string | null
  tabs: string[]
  isActive: boolean
  createdAt: string
  _count: {
    users: number
  }
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard (Sales)',
  projects: 'Projects',
  crm: 'CRM',
  products: 'Products',
  masterParts: 'Master Parts',
  inventory: 'Inventory',
  vendors: 'Vendors',
  quoteDocuments: 'Quote Settings',
  accounting: 'Accounting',
  settings: 'Settings'
}

export default function ProfileManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles')
      if (response.ok) {
        const data = await response.json()
        setProfiles(data.profiles)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProfile = async (profileData: { name: string; description: string; tabs: string[] }) => {
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok) {
        alert('Profile created successfully!')
        setShowCreateModal(false)
        fetchProfiles()
      } else {
        alert(data.error || 'Failed to create profile')
      }
    } catch (error) {
      console.error('Error creating profile:', error)
      alert('Failed to create profile')
    }
  }

  const handleUpdateProfile = async (profileId: number, profileData: { name: string; description: string; tabs: string[] }) => {
    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok) {
        alert('Profile updated successfully!')
        setShowEditModal(false)
        setSelectedProfile(null)
        fetchProfiles()
      } else {
        alert(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    }
  }

  const handleDeleteProfile = async (profileId: number, userCount: number) => {
    const message = userCount > 0
      ? `This profile has ${userCount} user(s) assigned. They will be unlinked from this profile. Are you sure you want to delete it?`
      : 'Are you sure you want to delete this profile?'

    if (!confirm(message)) {
      return
    }

    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        alert('Profile deleted successfully!')
        fetchProfiles()
      } else {
        alert(data.error || 'Failed to delete profile')
      }
    } catch (error) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile')
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading profiles...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Profiles</h3>
          <p className="text-sm text-gray-500">Manage permission profiles for users</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No profiles created yet.</p>
          <p className="text-sm">Create a profile to define tab access for groups of users.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tabs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                      {profile.description && (
                        <div className="text-sm text-gray-500">{profile.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {profile.tabs.slice(0, 3).map(tab => (
                        <span
                          key={tab}
                          className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {TAB_LABELS[tab] || tab}
                        </span>
                      ))}
                      {profile.tabs.length > 3 && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          +{profile.tabs.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <Users className="w-3 h-3 mr-1" />
                      {profile._count.users}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedProfile(profile)
                        setShowEditModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Edit profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id, profile._count.users)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <ProfileFormModal
          title="Create New Profile"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateProfile}
        />
      )}

      {showEditModal && selectedProfile && (
        <ProfileFormModal
          title="Edit Profile"
          profile={selectedProfile}
          onClose={() => {
            setShowEditModal(false)
            setSelectedProfile(null)
          }}
          onSubmit={(data) => handleUpdateProfile(selectedProfile.id, data)}
        />
      )}
    </div>
  )
}

function ProfileFormModal({
  title,
  profile,
  onClose,
  onSubmit
}: {
  title: string
  profile?: Profile
  onClose: () => void
  onSubmit: (data: { name: string; description: string; tabs: string[] }) => void
}) {
  const [name, setName] = useState(profile?.name || '')
  const [description, setDescription] = useState(profile?.description || '')
  const [tabs, setTabs] = useState<string[]>(profile?.tabs || [])

  const toggleTab = (tabId: string) => {
    setTabs(prev =>
      prev.includes(tabId)
        ? prev.filter(t => t !== tabId)
        : [...prev, tabId]
    )
  }

  const selectAllTabs = () => {
    setTabs([...ALL_TABS])
  }

  const clearAllTabs = () => {
    setTabs([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, description, tabs })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Sales, Production, Engineering"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this profile's purpose"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Accessible Tabs
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllTabs}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAllTabs}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
              {ALL_TABS.map(tabId => (
                <div key={tabId} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`profile-tab-${tabId}`}
                    checked={tabs.includes(tabId)}
                    onChange={() => toggleTab(tabId)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor={`profile-tab-${tabId}`} className="ml-2 text-sm text-gray-700">
                    {TAB_LABELS[tabId] || tabId}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Users with this profile will have access to the selected tabs
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {profile ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

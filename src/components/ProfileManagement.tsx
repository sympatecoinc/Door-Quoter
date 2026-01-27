'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Users, GripVertical, Star, ChevronUp, ChevronDown } from 'lucide-react'
import { ALL_TABS } from '@/lib/permissions'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'

interface Profile {
  id: number
  name: string
  description: string | null
  tabs: string[]
  defaultTab: string | null
  isActive: boolean
  createdAt: string
  _count: {
    users: number
  }
}

const TAB_LABELS: Record<string, string> = {
  dashboard: 'Dashboard (Sales)',
  customers: 'Customers',
  crm: 'CRM',
  projects: 'Projects',
  production: 'Production',
  logistics: 'Shipping',
  products: 'Products',
  masterParts: 'Master Parts',
  inventory: 'Inventory',
  vendors: 'Vendors',
  purchaseOrders: 'Purchase Orders',
  receiving: 'Receiving',
  purchasingDashboard: 'Purchasing Dashboard',
  salesOrders: 'Sales Orders',
  invoices: 'Invoices',
  quoteDocuments: 'Quote Settings',
  accounting: 'Pricing',
  settings: 'Settings'
}

export default function ProfileManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const { toasts, removeToast, showSuccess, showError } = useToast()

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles')
      console.log('ProfileManagement - API response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('ProfileManagement - Profiles received:', data.profiles)
        setProfiles(data.profiles || [])
      } else {
        const errorData = await response.json()
        console.error('ProfileManagement - API error:', errorData)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProfile = async (profileData: { name: string; description: string; tabs: string[]; defaultTab: string | null }) => {
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Profile created successfully!')
        setShowCreateModal(false)
        fetchProfiles()
      } else {
        showError(data.error || 'Failed to create profile')
      }
    } catch (error) {
      console.error('Error creating profile:', error)
      showError('Failed to create profile')
    }
  }

  const handleUpdateProfile = async (profileId: number, profileData: { name: string; description: string; tabs: string[]; defaultTab: string | null }) => {
    try {
      const response = await fetch(`/api/profiles/${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Profile updated successfully!')
        setShowEditModal(false)
        setSelectedProfile(null)
        fetchProfiles()
      } else {
        showError(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      showError('Failed to update profile')
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
        showSuccess('Profile deleted successfully!')
        fetchProfiles()
      } else {
        showError(data.error || 'Failed to delete profile')
      }
    } catch (error) {
      console.error('Error deleting profile:', error)
      showError('Failed to delete profile')
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            profile.defaultTab === tab
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {profile.defaultTab === tab && <Star className="w-3 h-3 mr-1 fill-current" />}
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

      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
  onSubmit: (data: { name: string; description: string; tabs: string[]; defaultTab: string | null }) => void
}) {
  const [name, setName] = useState(profile?.name || '')
  const [description, setDescription] = useState(profile?.description || '')
  const [tabs, setTabs] = useState<string[]>(profile?.tabs || [])
  const [defaultTab, setDefaultTab] = useState<string | null>(profile?.defaultTab || null)
  const [draggedTab, setDraggedTab] = useState<string | null>(null)

  const toggleTab = (tabId: string) => {
    setTabs(prev => {
      if (prev.includes(tabId)) {
        // Removing tab - if it's the default, clear default
        if (defaultTab === tabId) {
          setDefaultTab(null)
        }
        return prev.filter(t => t !== tabId)
      } else {
        // Adding tab - append to end
        return [...prev, tabId]
      }
    })
  }

  const selectAllTabs = () => {
    setTabs([...ALL_TABS])
  }

  const clearAllTabs = () => {
    setTabs([])
    setDefaultTab(null)
  }

  const moveTab = (tabId: string, direction: 'up' | 'down') => {
    const currentIndex = tabs.indexOf(tabId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= tabs.length) return

    const newTabs = [...tabs]
    newTabs.splice(currentIndex, 1)
    newTabs.splice(newIndex, 0, tabId)
    setTabs(newTabs)
  }

  const handleDragStart = (tabId: string) => {
    setDraggedTab(tabId)
  }

  const handleDragOver = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (!draggedTab || draggedTab === targetTabId) return

    const draggedIndex = tabs.indexOf(draggedTab)
    const targetIndex = tabs.indexOf(targetTabId)
    if (draggedIndex === -1 || targetIndex === -1) return

    const newTabs = [...tabs]
    newTabs.splice(draggedIndex, 1)
    newTabs.splice(targetIndex, 0, draggedTab)
    setTabs(newTabs)
  }

  const handleDragEnd = () => {
    setDraggedTab(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, description, tabs, defaultTab })
  }

  // Get tabs that are not yet selected (available to add)
  const availableTabs = ALL_TABS.filter(tabId => !tabs.includes(tabId))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Selected Tabs with Ordering */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Selected Tabs (drag to reorder)
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

            {tabs.length === 0 ? (
              <div className="border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">
                No tabs selected. Add tabs from the list below.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {tabs.map((tabId, index) => (
                  <div
                    key={tabId}
                    draggable
                    onDragStart={() => handleDragStart(tabId)}
                    onDragOver={(e) => handleDragOver(e, tabId)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center px-3 py-2 bg-white hover:bg-gray-50 cursor-move ${
                      draggedTab === tabId ? 'opacity-50' : ''
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-sm text-gray-700 flex-1">
                      {TAB_LABELS[tabId] || tabId}
                    </span>
                    <div className="flex items-center gap-1">
                      {defaultTab === tabId ? (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center">
                          <Star className="w-3 h-3 mr-1 fill-current" />
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDefaultTab(tabId)}
                          className="text-xs text-gray-400 hover:text-yellow-600 px-1"
                          title="Set as default page"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => moveTab(tabId, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTab(tabId, 'down')}
                        disabled={index === tabs.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTab(tabId)}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove tab"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              The order here determines the sidebar order. Click the star to set the default landing page.
            </p>
          </div>

          {/* Available Tabs to Add */}
          {availableTabs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Tabs
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTabs.map(tabId => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => toggleTab(tabId)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {TAB_LABELS[tabId] || tabId}
                  </button>
                ))}
              </div>
            </div>
          )}

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

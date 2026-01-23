'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Edit2, Trash2, Shield, Eye, Settings, X, Plus, Minus, Check } from 'lucide-react'
import { ALL_TABS, parseTabOverrides, serializeTabOverrides, calculateEffectivePermissions, getPermissionSources, type TabOverrides } from '@/lib/permissions'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'

interface Profile {
  id: number
  name: string
  tabs: string[]
}

interface User {
  id: number
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'VIEWER'
  isActive: boolean
  permissions: string[]
  profileId: number | null
  tabOverrides: string
  profile: Profile | null
  createdAt: string
}

const AVAILABLE_TABS = [
  { id: 'dashboard', label: 'Dashboard (Sales)' },
  { id: 'crm', label: 'CRM' },
  { id: 'projects', label: 'Projects' },
  { id: 'production', label: 'Production' },
  { id: 'logistics', label: 'Shipping' },
  { id: 'products', label: 'Products' },
  { id: 'masterParts', label: 'Master Parts' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'purchaseOrders', label: 'Purchase Orders' },
  { id: 'receiving', label: 'Receiving' },
  { id: 'purchasingDashboard', label: 'Purchasing Dashboard' },
  { id: 'salesOrders', label: 'Sales Orders' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'quoteDocuments', label: 'Quote Settings' },
  { id: 'accounting', label: 'Pricing' },
  { id: 'settings', label: 'Settings' },
] as const

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { toasts, removeToast, showSuccess, showError } = useToast()

  useEffect(() => {
    fetchUsers()
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles')
      console.log('Profiles API response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Profiles received:', data.profiles)
        setProfiles(data.profiles || [])
      } else {
        const errorData = await response.json()
        console.error('Profiles API error:', errorData)
      }
    } catch (error) {
      console.error('Error fetching profiles:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (userData: any) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('User created successfully!')
        setShowCreateModal(false)
        fetchUsers()
      } else {
        showError(data.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      showError('Failed to create user')
    }
  }

  const handleUpdateUser = async (userId: number, userData: any) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('User updated successfully!')
        setShowEditModal(false)
        setSelectedUser(null)
        fetchUsers()
      } else {
        showError(data.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Error updating user:', error)
      showError('Failed to update user')
    }
  }

  const handleDeactivateUser = async (userId: number) => {
    if (!confirm('Are you sure you want to deactivate this user?')) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('User deactivated successfully!')
        fetchUsers()
      } else {
        showError(data.error || 'Failed to deactivate user')
      }
    } catch (error) {
      console.error('Error deactivating user:', error)
      showError('Failed to deactivate user')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <Shield className="w-4 h-4" />
      case 'MANAGER':
        return <Settings className="w-4 h-4" />
      case 'VIEWER':
        return <Eye className="w-4 h-4" />
      default:
        return null
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800'
      case 'MANAGER':
        return 'bg-blue-100 text-blue-800'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading users...</div>
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Create User
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                    {getRoleIcon(user.role)}
                    <span className="ml-1">{user.role}</span>
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => {
                      setSelectedUser(user)
                      setShowEditModal(true)
                    }}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    title="Edit user"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {user.isActive && (
                    <button
                      onClick={() => handleDeactivateUser(user.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Deactivate user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <UserFormModal
          title="Create New User"
          profiles={profiles}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
          onRefreshProfiles={fetchProfiles}
        />
      )}

      {showEditModal && selectedUser && (
        <UserFormModal
          title="Edit User"
          user={selectedUser}
          profiles={profiles}
          onClose={() => {
            setShowEditModal(false)
            setSelectedUser(null)
          }}
          onSubmit={(data) => handleUpdateUser(selectedUser.id, data)}
          onRefreshProfiles={fetchProfiles}
        />
      )}
    </div>
  )
}

function UserFormModal({
  title,
  user,
  profiles,
  onClose,
  onSubmit,
  onRefreshProfiles,
}: {
  title: string
  user?: User
  profiles: Profile[]
  onClose: () => void
  onSubmit: (data: any) => void
  onRefreshProfiles: () => void
}) {
  // Refresh profiles when modal opens to ensure we have latest data
  useEffect(() => {
    if (profiles.length === 0) {
      console.log('Profiles empty on modal open, refreshing...')
      onRefreshProfiles()
    }
  }, [])
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [role, setRole] = useState(user?.role || 'VIEWER')
  const [password, setPassword] = useState('')
  const [isActive, setIsActive] = useState(user?.isActive ?? true)

  // Profile-based permissions
  const [profileId, setProfileId] = useState<number | null>(user?.profileId ?? null)
  const [tabOverrides, setTabOverrides] = useState<TabOverrides>(
    parseTabOverrides(user?.tabOverrides || '{}')
  )

  // Legacy permissions (only used when no profile)
  const [permissions, setPermissions] = useState<string[]>(
    user?.permissions || ['dashboard', 'projects', 'crm', 'products', 'masterParts', 'quoteDocuments', 'accounting', 'settings']
  )

  // Get selected profile
  const selectedProfile = profiles.find(p => p.id === profileId) || null

  // Calculate effective permissions for display
  const effectivePermissions = calculateEffectivePermissions(
    selectedProfile,
    serializeTabOverrides(tabOverrides),
    permissions
  )

  // Get permission sources for visual display
  const permissionSources = getPermissionSources(
    selectedProfile,
    serializeTabOverrides(tabOverrides),
    permissions
  )

  const toggleLegacyPermission = (tabId: string) => {
    setPermissions(prev =>
      prev.includes(tabId)
        ? prev.filter(p => p !== tabId)
        : [...prev, tabId]
    )
  }

  const toggleOverride = (tabId: string, type: 'add' | 'remove') => {
    setTabOverrides(prev => {
      const newOverrides = { ...prev }

      if (type === 'add') {
        // Toggle add override
        if (prev.add.includes(tabId)) {
          newOverrides.add = prev.add.filter(t => t !== tabId)
        } else {
          newOverrides.add = [...prev.add, tabId]
          // Remove from 'remove' if it was there
          newOverrides.remove = prev.remove.filter(t => t !== tabId)
        }
      } else {
        // Toggle remove override
        if (prev.remove.includes(tabId)) {
          newOverrides.remove = prev.remove.filter(t => t !== tabId)
        } else {
          newOverrides.remove = [...prev.remove, tabId]
          // Remove from 'add' if it was there
          newOverrides.add = prev.add.filter(t => t !== tabId)
        }
      }

      return newOverrides
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = { name, email, role, isActive }

    if (password) {
      data.password = password
    }

    // If using a profile, send profileId and tabOverrides
    if (profileId !== null) {
      data.profileId = profileId
      data.tabOverrides = serializeTabOverrides(tabOverrides)
    } else {
      // No profile - use legacy permissions and clear profile
      data.profileId = null
      data.permissions = permissions
      data.tabOverrides = '{}'
    }

    onSubmit(data)
  }

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
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {user && '(leave blank to keep current)'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!user}
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              placeholder={user ? 'Leave blank to keep current' : 'At least 8 characters'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="VIEWER">Viewer - Read-only access</option>
              <option value="MANAGER">Manager - Can edit projects and data</option>
              <option value="ADMIN">Admin - Full access including user management</option>
            </select>
          </div>

          {/* Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Permission Profile {profiles.length > 0 && <span className="text-xs text-green-600">({profiles.length} available)</span>}
            </label>
            <select
              value={profileId ?? ''}
              onChange={(e) => {
                const value = e.target.value
                setProfileId(value === '' ? null : parseInt(value))
                // Clear overrides when changing profile
                if (value !== String(profileId)) {
                  setTabOverrides({ add: [], remove: [] })
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="">No Profile (Manual Permissions)</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {profileId ? 'Profile defines base tab access. Use overrides below to customize.' : 'Select individual tabs below when not using a profile.'}
            </p>
          </div>

          {/* Tab Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {profileId ? 'Tab Access (Profile + Overrides)' : 'Accessible Tabs'}
            </label>
            <div className="space-y-1 border border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
              {AVAILABLE_TABS.map(tab => {
                const source = permissionSources[tab.id]
                const hasAccess = effectivePermissions.includes(tab.id)
                const isFromProfile = source === 'profile'
                const isAddedOverride = source === 'override-add'
                const isRemovedOverride = source === 'override-remove'

                if (profileId !== null) {
                  // Profile mode - show status and override controls
                  return (
                    <div key={tab.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center">
                        {hasAccess ? (
                          <Check className={`w-4 h-4 mr-2 ${isFromProfile ? 'text-green-600' : 'text-blue-600'}`} />
                        ) : (
                          <X className={`w-4 h-4 mr-2 ${isRemovedOverride ? 'text-red-500' : 'text-gray-300'}`} />
                        )}
                        <span className={`text-sm ${!hasAccess && isRemovedOverride ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {tab.label}
                        </span>
                        {isFromProfile && (
                          <span className="ml-2 text-xs text-green-600">(profile)</span>
                        )}
                        {isAddedOverride && (
                          <span className="ml-2 text-xs text-blue-600">(+added)</span>
                        )}
                        {isRemovedOverride && (
                          <span className="ml-2 text-xs text-red-500">(-removed)</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {/* Add override button - only show if not already in profile or added */}
                        {!isFromProfile && !isAddedOverride && (
                          <button
                            type="button"
                            onClick={() => toggleOverride(tab.id, 'add')}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Add access"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        {/* Remove added override */}
                        {isAddedOverride && (
                          <button
                            type="button"
                            onClick={() => toggleOverride(tab.id, 'add')}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Remove added override"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {/* Remove override button - only show if in profile and not already removed */}
                        {isFromProfile && !isRemovedOverride && (
                          <button
                            type="button"
                            onClick={() => toggleOverride(tab.id, 'remove')}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Remove access"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                        {/* Undo remove override */}
                        {isRemovedOverride && (
                          <button
                            type="button"
                            onClick={() => toggleOverride(tab.id, 'remove')}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Undo removal"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                } else {
                  // No profile - simple checkbox mode
                  return (
                    <div key={tab.id} className="flex items-center py-1">
                      <input
                        type="checkbox"
                        id={`tab-${tab.id}`}
                        checked={permissions.includes(tab.id)}
                        onChange={() => toggleLegacyPermission(tab.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`tab-${tab.id}`} className="ml-2 text-sm text-gray-700">
                        {tab.label}
                      </label>
                    </div>
                  )
                }
              })}
            </div>
            {profileId !== null && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  From Profile
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Added Override
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Removed Override
                </span>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                User is active
              </label>
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
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

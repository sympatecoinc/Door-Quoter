'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/appStore'
import { MenuOption } from '@/types'
import {
  Home,
  Folder,
  Package,
  Database,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Users,
  LogOut,
  User,
  DollarSign,
  FileText,
  Truck,
  Warehouse,
  ShoppingCart,
  ClipboardList,
  Receipt,
  Factory,
  PackageCheck
} from 'lucide-react'

const menuItems = [
  { id: 'dashboard' as MenuOption, label: 'Dashboard (Sales)', icon: Home },
  { id: 'crm' as MenuOption, label: 'CRM', icon: Users },
  { id: 'projects' as MenuOption, label: 'Projects', icon: Folder },
  { id: 'production' as MenuOption, label: 'Production', icon: Factory },
  { id: 'logistics' as MenuOption, label: 'Logistics', icon: PackageCheck },
  { id: 'products' as MenuOption, label: 'Products', icon: Package },
  { id: 'masterParts' as MenuOption, label: 'Master Parts', icon: Database },
  { id: 'inventory' as MenuOption, label: 'Inventory', icon: Warehouse },
  { id: 'vendors' as MenuOption, label: 'Vendors', icon: Truck },
  { id: 'purchaseOrders' as MenuOption, label: 'Purchase Orders', icon: ShoppingCart },
  { id: 'salesOrders' as MenuOption, label: 'Sales Orders', icon: ClipboardList },
  { id: 'invoices' as MenuOption, label: 'Invoices', icon: Receipt },
  { id: 'quoteDocuments' as MenuOption, label: 'Quote Settings', icon: FileText },
  { id: 'accounting' as MenuOption, label: 'Pricing', icon: DollarSign },
  { id: 'settings' as MenuOption, label: 'Settings', icon: Settings },
]

interface Project {
  id: number
  name: string
  status: string
}

export default function Sidebar() {
  const router = useRouter()
  const { currentMenu, setCurrentMenu, selectedProjectId, setSelectedProjectId, notificationRefreshTrigger } = useAppStore()
  const [showProjects, setShowProjects] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [inventoryNotificationCount, setInventoryNotificationCount] = useState(0)
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)

  useEffect(() => {
    if (showProjects) {
      fetchProjects()
    }
  }, [showProjects])

  useEffect(() => {
    fetchCurrentUser()
    fetchInventoryNotificationCount()
    fetchPendingQuotesCount()
    fetchBranding()
  }, [])

  async function fetchBranding() {
    try {
      const response = await fetch('/api/settings/branding')
      if (response.ok) {
        const data = await response.json()
        setCompanyLogo(data.logo)
      }
    } catch (error) {
      console.error('Error fetching branding:', error)
    }
  }

  // Refresh notification count when navigating away from inventory
  useEffect(() => {
    if (currentMenu !== 'inventory') {
      fetchInventoryNotificationCount()
    }
    if (currentMenu !== 'salesOrders') {
      fetchPendingQuotesCount()
    }
  }, [currentMenu])

  // Refresh notification count when triggered (e.g., after creating a master part)
  useEffect(() => {
    if (notificationRefreshTrigger > 0) {
      fetchInventoryNotificationCount()
    }
  }, [notificationRefreshTrigger])

  async function fetchInventoryNotificationCount() {
    try {
      const response = await fetch('/api/inventory/notifications/count')
      if (response.ok) {
        const data = await response.json()
        setInventoryNotificationCount(data.count)
      }
    } catch (error) {
      console.error('Error fetching notification count:', error)
    }
  }

  async function fetchPendingQuotesCount() {
    try {
      const response = await fetch('/api/projects/pending-quotes')
      if (response.ok) {
        const data = await response.json()
        setPendingQuotesCount(data.pendingQuotes?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching pending quotes count:', error)
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  // Filter menu items based on user permissions
  // Use effectivePermissions (computed from profile + overrides) if available, fall back to legacy permissions
  const visibleMenuItems = currentUser
    ? menuItems.filter(item =>
        (currentUser.effectivePermissions || currentUser.permissions)?.includes(item.id)
      )
    : menuItems

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
      alert('Failed to logout')
    }
  }

  async function fetchProjects() {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const projectsData = await response.json()
        setProjects(projectsData)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0 min-h-[64px] flex justify-center items-center">
        {companyLogo && (
          <img
            src={companyLogo}
            alt="Company Logo"
            className="max-h-12 w-auto object-contain"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = currentMenu === item.id
          const showInventoryBadge = item.id === 'inventory' && inventoryNotificationCount > 0
          const showSalesOrdersBadge = item.id === 'salesOrders' && pendingQuotesCount > 0

          return (
            <button
              key={item.id}
              onClick={() => setCurrentMenu(item.id)}
              className={`w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              <span className="flex-1">{item.label}</span>
              {showInventoryBadge && (
                <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {inventoryNotificationCount}
                </span>
              )}
              {showSalesOrdersBadge && (
                <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium">
                  {pendingQuotesCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Project Selector */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={() => setShowProjects(!showProjects)}
          className="w-full flex items-center justify-between px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
        >
          <span className="font-medium">Projects</span>
          {showProjects ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {showProjects && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => setCurrentMenu('projects')}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id)
                  setCurrentMenu('projects')
                }}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg text-left ${
                  selectedProjectId === project.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 truncate">
                  {project.name}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === 'Draft'
                    ? 'bg-gray-100 text-gray-600'
                    : project.status === 'In Progress'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-green-100 text-green-600'
                }`}>
                  {project.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User Section */}
      {currentUser && (
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center mb-2 px-3 py-2">
            <User className="w-5 h-5 text-gray-600 mr-3" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
              <div className="text-xs text-gray-500">{currentUser.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/appStore'
import { MenuOption, PortalContext } from '@/types'
import {
  Home,
  Folder,
  Package,
  Database,
  Settings,
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
  PackageCheck,
  LayoutDashboard,
  PackageOpen,
  Building2,
  Globe,
  LucideIcon,
  TestTube2
} from 'lucide-react'

// Menu item metadata (icons and labels)
const menuItemsMap: Record<string, { label: string; icon: LucideIcon }> = {
  dashboard: { label: 'Dashboard (Sales)', icon: Home },
  customers: { label: 'Customers', icon: Building2 },
  crm: { label: 'CRM', icon: Users },
  projects: { label: 'Projects', icon: Folder },
  production: { label: 'Production', icon: Factory },
  logistics: { label: 'Shipping', icon: PackageCheck },
  products: { label: 'Products', icon: Package },
  masterParts: { label: 'Master Parts', icon: Database },
  inventory: { label: 'Inventory', icon: Warehouse },
  vendors: { label: 'Vendors', icon: Truck },
  purchaseOrders: { label: 'Purchase Orders', icon: ShoppingCart },
  receiving: { label: 'Receiving', icon: PackageOpen },
  purchasingDashboard: { label: 'Purchasing Dashboard', icon: LayoutDashboard },
  purchaseSummary: { label: 'Purchase Summary', icon: ClipboardList },
  salesOrders: { label: 'Sales Orders', icon: ClipboardList },
  invoices: { label: 'Invoices', icon: Receipt },
  quoteDocuments: { label: 'Quote Settings', icon: FileText },
  accounting: { label: 'Pricing', icon: DollarSign },
  settings: { label: 'Settings', icon: Settings },
  clickupTest: { label: 'ClickUp Test', icon: TestTube2 },
}

// Default order (used when no profile ordering is set)
const defaultMenuOrder: MenuOption[] = [
  'dashboard', 'customers', 'crm', 'projects', 'production', 'logistics', 'products',
  'masterParts', 'inventory', 'vendors', 'purchaseOrders', 'receiving',
  'purchasingDashboard', 'purchaseSummary', 'salesOrders', 'invoices', 'quoteDocuments',
  'accounting', 'settings', 'clickupTest'
]

// Get cached skeleton count from localStorage
function getCachedTabCount(): number {
  if (typeof window === 'undefined') return 5
  try {
    const cached = localStorage.getItem('sidebar-tab-count')
    return cached ? parseInt(cached, 10) : 5
  } catch {
    return 5
  }
}

// Cache tab count to localStorage
function setCachedTabCount(count: number) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('sidebar-tab-count', count.toString())
  } catch {
    // Ignore localStorage errors
  }
}

export default function Sidebar() {
  const router = useRouter()
  const { currentMenu, setCurrentMenu, notificationRefreshTrigger } = useAppStore()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [portalContext, setPortalContext] = useState<PortalContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [skeletonCount, setSkeletonCount] = useState(5)
  const [inventoryNotificationCount, setInventoryNotificationCount] = useState(0)
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0)
  const [receivingCount, setReceivingCount] = useState(0)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const hasSetDefaultTab = useRef(false)

  // Load cached skeleton count on mount
  useEffect(() => {
    setSkeletonCount(getCachedTabCount())
  }, [])

  useEffect(() => {
    fetchCurrentUser()
    fetchInventoryNotificationCount()
    fetchPendingQuotesCount()
    fetchReceivingCount()
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
    if (currentMenu !== 'receiving') {
      fetchReceivingCount()
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

  async function fetchReceivingCount() {
    try {
      const response = await fetch('/api/receiving/count')
      if (response.ok) {
        const data = await response.json()
        setReceivingCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching receiving count:', error)
    }
  }

  async function fetchCurrentUser() {
    try {
      // Check for portal query parameter override (for testing on staging)
      const urlParams = new URLSearchParams(window.location.search)
      const portalOverride = urlParams.get('portal')
      const sessionUrl = portalOverride
        ? `/api/auth/session?portal=${encodeURIComponent(portalOverride)}`
        : '/api/auth/session'

      const response = await fetch(sessionUrl)
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
        setPortalContext(data.portal || null)

        // Set default tab on first load (only once)
        if (!hasSetDefaultTab.current && data.user) {
          hasSetDefaultTab.current = true
          const profile = data.user.profile
          const effectivePermissions = data.user.effectivePermissions || data.user.permissions || []
          const portal = data.portal

          // Priority 1: Portal's defaultTab (if in portal mode and user has access)
          if (portal?.defaultTab && effectivePermissions.includes(portal.defaultTab)) {
            setCurrentMenu(portal.defaultTab as MenuOption)
          }
          // Priority 2: Profile's defaultTab (if set and user has access)
          else if (profile?.defaultTab && effectivePermissions.includes(profile.defaultTab)) {
            setCurrentMenu(profile.defaultTab as MenuOption)
          }
          // Priority 3: First available tab from the profile's ordered tabs
          else if (profile?.tabs?.length > 0) {
            const firstAccessibleTab = profile.tabs.find((tab: string) => effectivePermissions.includes(tab))
            if (firstAccessibleTab) {
              setCurrentMenu(firstAccessibleTab as MenuOption)
            }
          }
          // Priority 4: First permission the user has
          else if (effectivePermissions.length > 0) {
            setCurrentMenu(effectivePermissions[0] as MenuOption)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Build visible menu items based on user permissions and portal/profile tab ordering
  const visibleMenuItems = (() => {
    // While loading, don't show any tabs to prevent flash
    if (isLoading || !currentUser) {
      return []
    }

    const effectivePermissions = currentUser.effectivePermissions || currentUser.permissions || []
    const profile = currentUser.profile

    // Priority 1: If in portal mode, use portal's tab ordering
    if (portalContext?.tabs?.length > 0) {
      // Filter portal tabs to only those the user has access to, preserving portal order
      return portalContext.tabs
        .filter((tabId: string) => effectivePermissions.includes(tabId))
        .map((tabId: string) => ({
          id: tabId as MenuOption,
          label: menuItemsMap[tabId]?.label || tabId,
          icon: menuItemsMap[tabId]?.icon || Home
        }))
    }

    // Priority 2: If user has a profile with ordered tabs, use that order
    if (profile?.tabs?.length > 0) {
      // Filter to only tabs the user has access to, preserving profile order
      return profile.tabs
        .filter((tabId: string) => effectivePermissions.includes(tabId))
        .map((tabId: string) => ({
          id: tabId as MenuOption,
          label: menuItemsMap[tabId]?.label || tabId,
          icon: menuItemsMap[tabId]?.icon || Home
        }))
    }

    // Fallback: filter default order by permissions
    return defaultMenuOrder
      .filter(id => effectivePermissions.includes(id))
      .map(id => ({
        id,
        label: menuItemsMap[id]?.label || id,
        icon: menuItemsMap[id]?.icon || Home
      }))
  })()

  // Cache tab count when menu items change
  useEffect(() => {
    if (visibleMenuItems.length > 0) {
      setCachedTabCount(visibleMenuItems.length)
    }
  }, [visibleMenuItems.length])

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

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header with Portal Context */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0 min-h-[64px] flex flex-col justify-center items-center">
        {/* Portal Header Title (if in portal mode) */}
        {portalContext?.headerTitle && (
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 mb-2">
            <Globe className="w-4 h-4" />
            <span>{portalContext.headerTitle}</span>
          </div>
        )}
        {/* Company Logo */}
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
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(skeletonCount)].map((_, i) => (
              <div key={i} className="flex items-center px-3 py-2 rounded-lg animate-pulse">
                <div className="w-5 h-5 bg-gray-200 rounded mr-3"></div>
                <div
                  className="h-4 bg-gray-200 rounded"
                  style={{ width: `${65 + (i % 3) * 15}%` }}
                ></div>
              </div>
            ))}
          </div>
        ) : visibleMenuItems.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            <p>No tabs available</p>
            {portalContext && (
              <p className="text-xs mt-1">You don't have access to any tabs in this portal</p>
            )}
          </div>
        ) : (
          visibleMenuItems.map((item: { id: MenuOption; label: string; icon: LucideIcon }) => {
            const Icon = item.icon
            const isActive = currentMenu === item.id
            const showInventoryBadge = item.id === 'inventory' && inventoryNotificationCount > 0
            const showSalesOrdersBadge = item.id === 'salesOrders' && pendingQuotesCount > 0
            const showReceivingBadge = item.id === 'receiving' && receivingCount > 0

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
                {showReceivingBadge && (
                  <span className="bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 text-xs font-medium">
                    {receivingCount}
                  </span>
                )}
              </button>
            )
          })
        )}
      </nav>

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

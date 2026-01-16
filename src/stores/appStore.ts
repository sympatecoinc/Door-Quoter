import { create } from 'zustand'
import { MenuOption } from '@/types'

export type SalesViewMode = 'leads' | 'projects'

interface AppState {
  currentMenu: MenuOption
  selectedProjectId: number | null
  selectedCustomerId: number | null
  customerDetailView: boolean
  customerDetailTab: 'overview' | 'contacts' | 'notes' | 'files'
  autoOpenAddOpening: boolean
  notificationRefreshTrigger: number
  // Sales Lead View state
  salesLeadId: number | null
  showSalesLeadView: boolean
  salesViewMode: SalesViewMode
  setCurrentMenu: (menu: MenuOption) => void
  setSelectedProjectId: (id: number | null) => void
  setSelectedCustomerId: (id: number | null) => void
  setCustomerDetailView: (show: boolean) => void
  setCustomerDetailTab: (tab: 'overview' | 'contacts' | 'notes' | 'files') => void
  setAutoOpenAddOpening: (open: boolean) => void
  triggerNotificationRefresh: () => void
  // Sales Lead View actions
  setSalesLeadId: (id: number | null) => void
  setShowSalesLeadView: (show: boolean) => void
  openSalesLead: (id: number, mode: SalesViewMode) => void
  closeSalesLeadView: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMenu: 'dashboard',
  selectedProjectId: null,
  selectedCustomerId: null,
  customerDetailView: false,
  customerDetailTab: 'overview',
  autoOpenAddOpening: false,
  notificationRefreshTrigger: 0,
  // Sales Lead View state
  salesLeadId: null,
  showSalesLeadView: false,
  salesViewMode: 'leads',
  setCurrentMenu: (menu) => set({ currentMenu: menu }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  setCustomerDetailView: (show) => set({ customerDetailView: show }),
  setCustomerDetailTab: (tab) => set({ customerDetailTab: tab }),
  setAutoOpenAddOpening: (open) => set({ autoOpenAddOpening: open }),
  triggerNotificationRefresh: () => set((state) => ({ notificationRefreshTrigger: state.notificationRefreshTrigger + 1 })),
  // Sales Lead View actions
  setSalesLeadId: (id) => set({ salesLeadId: id }),
  setShowSalesLeadView: (show) => set({ showSalesLeadView: show }),
  openSalesLead: (id, mode) => set({ salesLeadId: id, showSalesLeadView: true, salesViewMode: mode }),
  closeSalesLeadView: () => set({ showSalesLeadView: false }),
}))
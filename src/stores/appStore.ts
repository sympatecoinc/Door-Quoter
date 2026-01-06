import { create } from 'zustand'
import { MenuOption } from '@/types'

interface AppState {
  currentMenu: MenuOption
  selectedProjectId: number | null
  selectedCustomerId: number | null
  customerDetailView: boolean
  customerDetailTab: 'overview' | 'contacts' | 'notes' | 'files'
  autoOpenAddOpening: boolean
  notificationRefreshTrigger: number
  setCurrentMenu: (menu: MenuOption) => void
  setSelectedProjectId: (id: number | null) => void
  setSelectedCustomerId: (id: number | null) => void
  setCustomerDetailView: (show: boolean) => void
  setCustomerDetailTab: (tab: 'overview' | 'contacts' | 'notes' | 'files') => void
  setAutoOpenAddOpening: (open: boolean) => void
  triggerNotificationRefresh: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMenu: 'dashboard',
  selectedProjectId: null,
  selectedCustomerId: null,
  customerDetailView: false,
  customerDetailTab: 'overview',
  autoOpenAddOpening: false,
  notificationRefreshTrigger: 0,
  setCurrentMenu: (menu) => set({ currentMenu: menu }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  setCustomerDetailView: (show) => set({ customerDetailView: show }),
  setCustomerDetailTab: (tab) => set({ customerDetailTab: tab }),
  setAutoOpenAddOpening: (open) => set({ autoOpenAddOpening: open }),
  triggerNotificationRefresh: () => set((state) => ({ notificationRefreshTrigger: state.notificationRefreshTrigger + 1 })),
}))
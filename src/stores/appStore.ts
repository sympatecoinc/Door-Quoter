import { create } from 'zustand'
import { MenuOption } from '@/types'

export type SalesViewMode = 'leads' | 'projects'

interface AppState {
  currentMenu: MenuOption
  selectedProjectId: number | null
  selectedCustomerId: number | null
  autoOpenAddOpening: boolean
  notificationRefreshTrigger: number
  // Sales Lead View state
  salesLeadId: number | null
  showSalesLeadView: boolean
  salesViewMode: SalesViewMode
  cameFromSalesDashboard: boolean
  // Purchase Order state
  selectedPOId: number | null
  setSelectedPOId: (id: number | null) => void
  setCurrentMenu: (menu: MenuOption) => void
  setSelectedProjectId: (id: number | null) => void
  setSelectedCustomerId: (id: number | null) => void
  setAutoOpenAddOpening: (open: boolean) => void
  triggerNotificationRefresh: () => void
  // Sales Lead View actions
  setSalesLeadId: (id: number | null) => void
  setShowSalesLeadView: (show: boolean) => void
  openSalesLead: (id: number, mode: SalesViewMode) => void
  setSalesViewMode: (mode: SalesViewMode) => void
  closeSalesLeadView: () => void
  setCameFromSalesDashboard: (value: boolean) => void
  openProjectFromSalesDashboard: (projectId: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMenu: 'dashboard',
  selectedProjectId: null,
  selectedCustomerId: null,
  autoOpenAddOpening: false,
  notificationRefreshTrigger: 0,
  // Sales Lead View state
  salesLeadId: null,
  showSalesLeadView: false,
  salesViewMode: 'leads',
  cameFromSalesDashboard: false,
  // Purchase Order state
  selectedPOId: null,
  setSelectedPOId: (id) => set({ selectedPOId: id }),
  setCurrentMenu: (menu) => set({ currentMenu: menu }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  setAutoOpenAddOpening: (open) => set({ autoOpenAddOpening: open }),
  triggerNotificationRefresh: () => set((state) => ({ notificationRefreshTrigger: state.notificationRefreshTrigger + 1 })),
  // Sales Lead View actions
  setSalesLeadId: (id) => set({ salesLeadId: id }),
  setShowSalesLeadView: (show) => set({ showSalesLeadView: show }),
  openSalesLead: (id, mode) => set({ salesLeadId: id, showSalesLeadView: true, salesViewMode: mode }),
  setSalesViewMode: (mode) => set({ salesViewMode: mode }),
  closeSalesLeadView: () => set({ showSalesLeadView: false }),
  setCameFromSalesDashboard: (value) => set({ cameFromSalesDashboard: value }),
  openProjectFromSalesDashboard: (projectId) => set({
    selectedProjectId: projectId,
    currentMenu: 'projects',
    showSalesLeadView: false,
    cameFromSalesDashboard: true,
  }),
}))
import { create } from 'zustand'
import { MenuOption } from '@/types'

interface AppState {
  currentMenu: MenuOption
  selectedProjectId: number | null
  setCurrentMenu: (menu: MenuOption) => void
  setSelectedProjectId: (id: number | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentMenu: 'dashboard',
  selectedProjectId: null,
  setCurrentMenu: (menu) => set({ currentMenu: menu }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}))
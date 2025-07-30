'use client'

import { useAppStore } from '@/stores/appStore'
import DashboardView from './views/DashboardView'
import ProjectsView from './views/ProjectsView'
import ProjectDetailView from './views/ProjectDetailView'
import ProductsView from './views/ProductsView'
import MasterPartsView from './views/MasterPartsView'
import SettingsView from './views/SettingsView'
import QuoteView from './views/QuoteView'

export default function Dashboard() {
  const { currentMenu, selectedProjectId } = useAppStore()

  const renderView = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <DashboardView />
      case 'projects':
        return selectedProjectId ? <ProjectDetailView /> : <ProjectsView />
      case 'products':
        return <ProductsView />
      case 'masterParts':
        return <MasterPartsView />
      case 'settings':
        return <SettingsView />
      case 'quote':
        return <QuoteView />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {renderView()}
    </div>
  )
}
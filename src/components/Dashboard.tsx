'use client'

import { useAppStore } from '@/stores/appStore'
import DashboardView from './views/DashboardView'
import CRMView from './views/CRMView'
import ProjectsView from './views/ProjectsView'
import ProjectDetailView from './views/ProjectDetailView'
import ProductionView from './views/ProductionView'
import ProductsView from './views/ProductsView'
import MasterPartsView from './views/MasterPartsView'
import InventoryView from './views/InventoryView'
import VendorsView from './views/VendorsView'
import PurchaseOrdersView from './views/PurchaseOrdersView'
import SalesOrdersView from './views/SalesOrdersView'
import InvoicesView from './views/InvoicesView'
import AccountingView from './views/AccountingView'
import SettingsView from './views/SettingsView'
import QuoteView from './views/QuoteView'
import QuoteDocumentsView from './views/QuoteDocumentsView'

export default function Dashboard() {
  const { currentMenu, selectedProjectId } = useAppStore()

  const renderView = () => {
    switch (currentMenu) {
      case 'dashboard':
        return <DashboardView />
      case 'crm':
        return <CRMView />
      case 'projects':
        return selectedProjectId ? <ProjectDetailView /> : <ProjectsView />
      case 'production':
        return <ProductionView />
      case 'products':
        return <ProductsView />
      case 'masterParts':
        return <MasterPartsView />
      case 'inventory':
        return <InventoryView />
      case 'vendors':
        return <VendorsView />
      case 'purchaseOrders':
        return <PurchaseOrdersView />
      case 'salesOrders':
        return <SalesOrdersView />
      case 'invoices':
        return <InvoicesView />
      case 'quoteDocuments':
        return <QuoteDocumentsView />
      case 'accounting':
        return <AccountingView />
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
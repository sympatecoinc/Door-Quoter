'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ShoppingBag } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import type { DashboardTab, DateRange } from '@/components/purchasing-dashboard/types'

// Widgets
import InventoryAlertsWidget from '@/components/purchasing-dashboard/InventoryAlertsWidget'
import VendorScorecardWidget from '@/components/purchasing-dashboard/VendorScorecardWidget'
import MRPWidget from '@/components/purchasing-dashboard/MRPWidget'
import StockOptimizationWidget from '@/components/purchasing-dashboard/StockOptimizationWidget'
import PriceTrackingWidget from '@/components/purchasing-dashboard/PriceTrackingWidget'
import ReceivingQueueWidget from '@/components/purchasing-dashboard/ReceivingQueueWidget'
import SpendAnalyticsWidget from '@/components/purchasing-dashboard/SpendAnalyticsWidget'
import OpenOrdersSummaryWidget from '@/components/purchasing-dashboard/OpenOrdersSummaryWidget'
import VendorCommunicationWidget from '@/components/purchasing-dashboard/VendorCommunicationWidget'

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Receiving' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'stock', label: 'Stock' }
]

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' }
]

export default function PurchasingDashboardView() {
  const { setCurrentMenu } = useAppStore()
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [dateRange, setDateRange] = useState<DateRange>(30)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  // Auto-refresh when page becomes visible again (returning from inventory edits, PO receiving, etc.)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [handleRefresh])

  const handleViewPO = (poId: number) => {
    // Navigate to Purchase Orders view
    // In a more integrated version, we could pass the PO ID to highlight
    setCurrentMenu('purchaseOrders')
  }

  const handlePOCreated = () => {
    // Refresh data and navigate to Purchase Orders view
    handleRefresh()
    setCurrentMenu('purchaseOrders')
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchasing Dashboard</h1>
            <p className="text-sm text-gray-500">Command center for procurement operations</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {DATE_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  dateRange === range.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          refreshKey={refreshKey}
          dateRange={dateRange}
          onViewPO={handleViewPO}
          onPOCreated={handlePOCreated}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersTab
          refreshKey={refreshKey}
          onViewPO={handleViewPO}
        />
      )}

      {activeTab === 'vendors' && (
        <VendorsTab
          refreshKey={refreshKey}
          dateRange={dateRange}
        />
      )}

      {activeTab === 'pricing' && (
        <PricingTab
          refreshKey={refreshKey}
          dateRange={dateRange}
        />
      )}

      {activeTab === 'stock' && (
        <StockTab
          refreshKey={refreshKey}
        />
      )}

    </div>
  )
}

// Overview Tab - Quick summary of all key metrics
interface OverviewTabProps {
  refreshKey: number
  dateRange: DateRange
  onViewPO: (poId: number) => void
  onPOCreated: () => void
}

function OverviewTab({ refreshKey, dateRange, onViewPO, onPOCreated }: OverviewTabProps) {
  return (
    <div className="columns-1 lg:columns-2 gap-6 space-y-6">
      <div className="break-inside-avoid">
        <InventoryAlertsWidget refreshKey={refreshKey} onPOCreated={onPOCreated} />
      </div>
      <div className="break-inside-avoid">
        <MRPWidget refreshKey={refreshKey} />
      </div>
    </div>
  )
}

// Orders Tab - Open orders and receiving queue
interface OrdersTabProps {
  refreshKey: number
  onViewPO: (poId: number) => void
}

function OrdersTab({ refreshKey, onViewPO }: OrdersTabProps) {
  return (
    <div className="columns-1 xl:columns-2 gap-6 space-y-6">
      <div className="break-inside-avoid">
        <OpenOrdersSummaryWidget refreshKey={refreshKey} onViewPO={onViewPO} />
      </div>
      <div className="break-inside-avoid">
        <ReceivingQueueWidget refreshKey={refreshKey} onViewPO={onViewPO} />
      </div>
    </div>
  )
}

// Vendors Tab - Vendor scorecard and communication
interface VendorsTabProps {
  refreshKey: number
  dateRange: DateRange
}

function VendorsTab({ refreshKey, dateRange }: VendorsTabProps) {
  return (
    <div className="columns-1 xl:columns-2 gap-6 space-y-6">
      <div className="break-inside-avoid">
        <VendorScorecardWidget refreshKey={refreshKey} dateRange={dateRange} />
      </div>
      <div className="break-inside-avoid">
        <VendorCommunicationWidget refreshKey={refreshKey} />
      </div>
    </div>
  )
}

// Pricing Tab - Price tracking and spend analytics
interface PricingTabProps {
  refreshKey: number
  dateRange: DateRange
}

function PricingTab({ refreshKey, dateRange }: PricingTabProps) {
  return (
    <div className="columns-1 xl:columns-2 gap-6 space-y-6">
      <div className="break-inside-avoid">
        <PriceTrackingWidget refreshKey={refreshKey} dateRange={dateRange} />
      </div>
      <div className="break-inside-avoid">
        <SpendAnalyticsWidget refreshKey={refreshKey} dateRange={dateRange} />
      </div>
    </div>
  )
}

// Stock Tab - Extrusion stock optimization
interface StockTabProps {
  refreshKey: number
}

function StockTab({ refreshKey }: StockTabProps) {
  return (
    <div className="max-w-4xl">
      <StockOptimizationWidget refreshKey={refreshKey} />
    </div>
  )
}


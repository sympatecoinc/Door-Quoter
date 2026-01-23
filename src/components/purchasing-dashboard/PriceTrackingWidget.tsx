'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, BarChart2, Info } from 'lucide-react'
import type { PriceHistoryResponse, PriceAlert, VendorPriceComparison, DateRange } from './types'

interface PriceTrackingWidgetProps {
  refreshKey?: number
  dateRange?: DateRange
}

export default function PriceTrackingWidget({ refreshKey = 0, dateRange = 90 }: PriceTrackingWidgetProps) {
  const [data, setData] = useState<PriceHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'alerts' | 'comparison'>('alerts')

  useEffect(() => {
    fetchData()
  }, [refreshKey, dateRange])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchasing/price-history?days=${dateRange}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching price history:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Failed to load price data</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Price Tracking</h3>
          </div>
          <span className="text-xs text-gray-500">Last {dateRange} days</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              activeTab === 'alerts'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Price Alerts ({data.priceAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              activeTab === 'comparison'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Vendor Comparison
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'alerts' ? (
          <PriceAlertsView alerts={data.priceAlerts} formatCurrency={formatCurrency} />
        ) : (
          <VendorComparisonView comparisons={data.vendorComparison} formatCurrency={formatCurrency} />
        )}

        {/* LME Placeholder */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500">
            <Info className="w-4 h-4" />
            <span className="text-sm">LME aluminum price tracking coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface PriceAlertsViewProps {
  alerts: PriceAlert[]
  formatCurrency: (amount: number) => string
}

function PriceAlertsView({ alerts, formatCurrency }: PriceAlertsViewProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <DollarSign className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No significant price changes (&gt;5%)</p>
        <p className="text-xs mt-1">Alerts appear when prices change significantly</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {alerts.map(alert => {
        const isIncrease = alert.percentChange > 0

        return (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${
              isIncrease ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">
                  {alert.partNumber || alert.itemDescription}
                </div>
                <div className="text-xs text-gray-500">{alert.vendorName}</div>
              </div>
              <div className={`flex items-center gap-1 font-semibold ${
                isIncrease ? 'text-red-600' : 'text-green-600'
              }`}>
                {isIncrease ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {isIncrease ? '+' : ''}{alert.percentChange.toFixed(1)}%
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="text-gray-500">{formatCurrency(alert.previousPrice)}</span>
              <span className="text-gray-400">→</span>
              <span className={isIncrease ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(alert.currentPrice)}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(alert.effectiveDate).toLocaleDateString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface VendorComparisonViewProps {
  comparisons: VendorPriceComparison[]
  formatCurrency: (amount: number) => string
}

function VendorComparisonView({ comparisons, formatCurrency }: VendorComparisonViewProps) {
  if (comparisons.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No multi-vendor items found</p>
        <p className="text-xs mt-1">Comparison available when items have multiple vendors</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-h-80 overflow-y-auto">
      {comparisons.slice(0, 10).map((item, index) => {
        const prices = item.vendors.map(v => v.price)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)
        const savings = maxPrice - minPrice

        return (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900">{item.partNumber}</div>
                {item.description && (
                  <div className="text-xs text-gray-500">{item.description}</div>
                )}
              </div>
              {savings > 0 && (
                <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Save up to {formatCurrency(savings)}
                </div>
              )}
            </div>
            <div className="space-y-1">
              {item.vendors
                .sort((a, b) => a.price - b.price)
                .map(vendor => {
                  const isCheapest = vendor.price === minPrice

                  return (
                    <div
                      key={vendor.vendorId}
                      className={`flex items-center justify-between text-sm p-2 rounded ${
                        isCheapest ? 'bg-green-100' : 'bg-white'
                      }`}
                    >
                      <span className={isCheapest ? 'font-medium text-green-700' : 'text-gray-600'}>
                        {vendor.vendorName}
                      </span>
                      <span className={isCheapest ? 'font-semibold text-green-700' : 'text-gray-900'}>
                        {formatCurrency(vendor.price)}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

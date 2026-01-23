'use client'

import { useState, useEffect } from 'react'
import { Award, TrendingUp, Clock, DollarSign, Package, ChevronRight } from 'lucide-react'
import type { VendorMetricsResponse, VendorMetrics } from './types'
import type { DateRange } from './types'

interface VendorScorecardWidgetProps {
  refreshKey?: number
  compact?: boolean
  dateRange?: DateRange
}

export default function VendorScorecardWidget({ refreshKey = 0, compact = false, dateRange = 30 }: VendorScorecardWidgetProps) {
  const [data, setData] = useState<VendorMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [refreshKey, dateRange])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchasing/vendor-metrics?days=${dateRange}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching vendor metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Failed to load vendor metrics</p>
      </div>
    )
  }

  const displayVendors = compact ? data.vendors.slice(0, 5) : data.vendors

  const getDeliveryRateColor = (rate: number | null) => {
    if (rate === null) return 'text-gray-400'
    if (rate >= 90) return 'text-green-600'
    if (rate >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDeliveryRateBg = (rate: number | null) => {
    if (rate === null) return 'bg-gray-100'
    if (rate >= 90) return 'bg-green-100'
    if (rate >= 70) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Vendor Scorecard</h3>
          </div>
          <span className="text-xs text-gray-500">Last {dateRange} days</span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {displayVendors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No vendor activity in this period</p>
          </div>
        ) : (
          displayVendors.map((vendor, index) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              rank={index + 1}
              compact={compact}
              formatCurrency={formatCurrency}
              getDeliveryRateColor={getDeliveryRateColor}
              getDeliveryRateBg={getDeliveryRateBg}
            />
          ))
        )}
      </div>

      {compact && data.vendors.length > 5 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <span className="text-sm text-gray-500">
            +{data.vendors.length - 5} more vendors
          </span>
        </div>
      )}
    </div>
  )
}

interface VendorCardProps {
  vendor: VendorMetrics
  rank: number
  compact: boolean
  formatCurrency: (amount: number) => string
  getDeliveryRateColor: (rate: number | null) => string
  getDeliveryRateBg: (rate: number | null) => string
}

function VendorCard({ vendor, rank, compact, formatCurrency, getDeliveryRateColor, getDeliveryRateBg }: VendorCardProps) {
  const { metrics } = vendor

  if (compact) {
    return (
      <div className="p-3 flex items-center justify-between hover:bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400 w-5">#{rank}</span>
          <div>
            <div className="font-medium text-gray-900">{vendor.displayName}</div>
            <div className="text-xs text-gray-500">{metrics.totalPOs} POs</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-2 py-1 rounded text-sm font-medium ${getDeliveryRateBg(metrics.onTimeDeliveryRate)} ${getDeliveryRateColor(metrics.onTimeDeliveryRate)}`}>
            {metrics.onTimeDeliveryRate !== null ? `${metrics.onTimeDeliveryRate}%` : 'N/A'}
          </div>
          <div className="text-right">
            <div className="font-medium text-gray-900">{formatCurrency(metrics.totalValue)}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
            #{rank}
          </div>
          <div>
            <div className="font-medium text-gray-900">{vendor.displayName}</div>
            <div className="text-sm text-gray-500">{metrics.totalPOs} purchase orders</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-gray-900">{formatCurrency(metrics.totalValue)}</div>
          <div className="text-xs text-gray-500">Total Spend</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-lg p-2 ${getDeliveryRateBg(metrics.onTimeDeliveryRate)}`}>
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">On-Time</span>
          </div>
          <div className={`text-lg font-bold ${getDeliveryRateColor(metrics.onTimeDeliveryRate)}`}>
            {metrics.onTimeDeliveryRate !== null ? `${metrics.onTimeDeliveryRate}%` : 'N/A'}
          </div>
        </div>

        <div className="rounded-lg p-2 bg-gray-50">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">Lead Time</span>
          </div>
          <div className="text-lg font-bold text-gray-700">
            {metrics.avgLeadTimeDays !== null ? `${metrics.avgLeadTimeDays}d` : 'N/A'}
          </div>
        </div>

        <div className="rounded-lg p-2 bg-blue-50">
          <div className="flex items-center gap-1 mb-1">
            <Package className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-blue-500">Completed</span>
          </div>
          <div className="text-lg font-bold text-blue-600">
            {metrics.completedPOs}/{metrics.totalPOs}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { BarChart3, PieChart, TrendingUp, DollarSign } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'
import type { SpendAnalyticsResponse, DateRange } from './types'

interface SpendAnalyticsWidgetProps {
  refreshKey?: number
  dateRange?: DateRange
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function SpendAnalyticsWidget({ refreshKey = 0, dateRange = 90 }: SpendAnalyticsWidgetProps) {
  const [data, setData] = useState<SpendAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState<'vendor' | 'category' | 'trend'>('vendor')

  useEffect(() => {
    fetchData()
  }, [refreshKey, dateRange])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/purchasing/spend-analytics?days=${dateRange}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching spend analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`
    }
    return `$${amount.toFixed(0)}`
  }

  const formatFullCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Failed to load spend analytics</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Spend Analytics</h3>
          </div>
          <span className="text-xs text-gray-500">Last {dateRange} days</span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-600 mb-1">Period Total</div>
            <div className="text-xl font-bold text-blue-700">{formatFullCurrency(data.periodTotal)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xs text-green-600 mb-1">YTD Total</div>
            <div className="text-xl font-bold text-green-700">{formatFullCurrency(data.ytdTotal)}</div>
          </div>
        </div>

        {/* Chart Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveChart('vendor')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              activeChart === 'vendor'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PieChart className="w-4 h-4" />
            By Vendor
          </button>
          <button
            onClick={() => setActiveChart('category')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              activeChart === 'category'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            By Category
          </button>
          <button
            onClick={() => setActiveChart('trend')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              activeChart === 'trend'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Trend
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeChart === 'vendor' && (
          <VendorChart data={data.byVendor} formatCurrency={formatCurrency} formatFullCurrency={formatFullCurrency} />
        )}
        {activeChart === 'category' && (
          <CategoryChart data={data.byCategory} formatCurrency={formatCurrency} />
        )}
        {activeChart === 'trend' && (
          <TrendChart data={data.monthlyTrend} formatCurrency={formatCurrency} />
        )}
      </div>
    </div>
  )
}

interface VendorChartProps {
  data: SpendAnalyticsResponse['byVendor']
  formatCurrency: (amount: number) => string
  formatFullCurrency: (amount: number) => string
}

function VendorChart({ data, formatCurrency, formatFullCurrency }: VendorChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No vendor spend data available
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="flex gap-4">
      <div className="w-1/2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              dataKey="amount"
              nameKey="vendorName"
            >
              {data.map((entry, index) => (
                <Cell key={entry.vendorId} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatFullCurrency(Number(value) || 0)}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-1/2 space-y-2 max-h-64 overflow-y-auto">
        {data.map((vendor, index) => {
          const percentage = ((vendor.amount / total) * 100).toFixed(1)
          return (
            <div key={vendor.vendorId} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{vendor.vendorName}</div>
                <div className="text-xs text-gray-500">{vendor.poCount} POs</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatCurrency(vendor.amount)}</div>
                <div className="text-xs text-gray-500">{percentage}%</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface CategoryChartProps {
  data: SpendAnalyticsResponse['byCategory']
  formatCurrency: (amount: number) => string
}

function CategoryChart({ data, formatCurrency }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No category spend data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatCurrency} />
          <YAxis type="category" dataKey="category" width={100} />
          <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
          <Bar dataKey="amount" fill="#3B82F6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TrendChartProps {
  data: SpendAnalyticsResponse['monthlyTrend']
  formatCurrency: (amount: number) => string
}

function TrendChart({ data, formatCurrency }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No trend data available
      </div>
    )
  }

  const chartData = data.map(item => ({
    ...item,
    monthLabel: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' })
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="monthLabel" />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

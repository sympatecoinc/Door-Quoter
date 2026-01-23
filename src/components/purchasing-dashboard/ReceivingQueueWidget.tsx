'use client'

import { useState, useEffect } from 'react'
import { Truck, Calendar, AlertCircle } from 'lucide-react'
import type { ReceivingQueueResponse, ReceivingPO } from './types'

interface ReceivingQueueWidgetProps {
  refreshKey?: number
  compact?: boolean
  onViewPO?: (poId: number) => void
}

export default function ReceivingQueueWidget({ refreshKey = 0, compact = false, onViewPO }: ReceivingQueueWidgetProps) {
  const [data, setData] = useState<ReceivingQueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'overdue'>('today')

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      const response = await fetch('/api/purchasing/receiving-queue')
      if (response.ok) {
        const result = await response.json()
        setData(result)
        // Auto-select tab with content
        if (result.overdue.length > 0) {
          setActiveTab('overdue')
        } else if (result.today.length > 0) {
          setActiveTab('today')
        } else {
          setActiveTab('upcoming')
        }
      }
    } catch (error) {
      console.error('Error fetching receiving queue:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-3 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <p className="text-sm text-gray-500">Failed to load receiving queue</p>
      </div>
    )
  }

  const getActivePOs = () => {
    switch (activeTab) {
      case 'today':
        return data.today
      case 'upcoming':
        return data.upcoming
      case 'overdue':
        return data.overdue
      default:
        return []
    }
  }

  const activePOs = getActivePOs()
  const displayPOs = compact ? activePOs.slice(0, 10) : activePOs

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Receiving Queue</h3>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveTab('overdue')}
            className={`p-2 rounded-lg text-center transition-colors ${
              activeTab === 'overdue'
                ? 'bg-red-100 ring-2 ring-red-500'
                : 'bg-red-50 hover:bg-red-100'
            }`}
          >
            <div className="text-xl font-bold text-red-600">{data.summary.overdueCount}</div>
            <div className="text-xs text-red-600">Overdue</div>
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`p-2 rounded-lg text-center transition-colors ${
              activeTab === 'today'
                ? 'bg-blue-100 ring-2 ring-blue-500'
                : 'bg-blue-50 hover:bg-blue-100'
            }`}
          >
            <div className="text-xl font-bold text-blue-600">{data.summary.todayCount}</div>
            <div className="text-xs text-blue-600">Today</div>
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`p-2 rounded-lg text-center transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-gray-200 ring-2 ring-gray-500'
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="text-xl font-bold text-gray-600">{data.summary.upcomingCount}</div>
            <div className="text-xs text-gray-600">Upcoming</div>
          </button>
        </div>

        {data.summary.overdueValue > 0 && (
          <div className="text-xs text-red-600 flex items-center gap-1 mt-2">
            <AlertCircle className="w-3 h-3" />
            {formatCurrency(data.summary.overdueValue)} in overdue orders
          </div>
        )}
      </div>

      {displayPOs.length === 0 ? (
        <div className="p-3 text-center text-gray-500 text-sm">
          No {activeTab === 'today' ? "deliveries today" : activeTab === 'overdue' ? 'overdue orders' : 'upcoming deliveries'}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {displayPOs.map(po => (
            <POCard
              key={po.poId}
              po={po}
              isOverdue={activeTab === 'overdue'}
              formatCurrency={formatCurrency}
              onView={onViewPO ? () => onViewPO(po.poId) : undefined}
            />
          ))}
        </div>
      )}

      {compact && activePOs.length > 10 && (
        <div className="p-3 border-t border-gray-200 text-center">
          <span className="text-sm text-gray-500">
            +{activePOs.length - 10} more orders
          </span>
        </div>
      )}
    </div>
  )
}

interface POCardProps {
  po: ReceivingPO
  isOverdue: boolean
  formatCurrency: (amount: number) => string
  onView?: () => void
}

function POCard({ po, isOverdue, formatCurrency, onView }: POCardProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div
      className={`px-3 py-2 hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''} ${onView ? 'cursor-pointer' : ''}`}
      onClick={onView}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">{po.poNumber}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              po.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
              po.status === 'ACKNOWLEDGED' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {po.status}
            </span>
          </div>
          <div className="text-xs text-gray-600">{po.vendorName}</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-gray-900 text-sm">{formatCurrency(po.totalAmount)}</div>
          <div className={`text-xs flex items-center gap-1 justify-end ${
            isOverdue ? 'text-red-600' : 'text-gray-500'
          }`}>
            {isOverdue ? (
              <>
                <AlertCircle className="w-3 h-3" />
                {Math.abs(po.daysUntilDue)}d late
              </>
            ) : (
              <>
                <Calendar className="w-3 h-3" />
                {formatDate(po.expectedDate)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

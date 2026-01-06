'use client'

import { useState, useEffect } from 'react'
import { FileText, DollarSign, Clock, CheckCircle } from 'lucide-react'

interface SOStats {
  total: number
  byStatus: Record<string, number>
  totalAmount: number
  totalBalance: number
  thisMonth: {
    count: number
    amount: number
  }
}

interface SOStatsWidgetProps {
  refreshKey?: number
}

export default function SOStatsWidget({ refreshKey }: SOStatsWidgetProps) {
  const [stats, setStats] = useState<SOStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [refreshKey])

  async function fetchStats() {
    try {
      const response = await fetch('/api/sales-orders/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching SO stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const paidCount = stats.byStatus.PAID || 0
  const openCount = stats.total - paidCount - (stats.byStatus.VOIDED || 0)

  const widgets = [
    {
      label: 'Total Orders',
      value: stats.total.toString(),
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats.totalAmount),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Outstanding Balance',
      value: formatCurrency(stats.totalBalance),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      label: 'This Month',
      value: formatCurrency(stats.thisMonth.amount),
      subtext: `${stats.thisMonth.count} orders`,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {widgets.map((widget, index) => {
        const Icon = widget.icon
        return (
          <div key={index} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{widget.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{widget.value}</p>
                {widget.subtext && (
                  <p className="text-xs text-gray-500 mt-1">{widget.subtext}</p>
                )}
              </div>
              <div className={`p-3 rounded-full ${widget.bgColor}`}>
                <Icon className={`w-6 h-6 ${widget.color}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { FileText, DollarSign, Clock, AlertTriangle } from 'lucide-react'

interface InvoiceStats {
  total: number
  byStatus: Record<string, number>
  totalAmount: number
  totalBalance: number
  thisMonth: {
    count: number
    amount: number
  }
  overdue: {
    count: number
    amount: number
  }
}

interface InvoiceStatsWidgetProps {
  refreshKey?: number
}

export default function InvoiceStatsWidget({ refreshKey }: InvoiceStatsWidgetProps) {
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [refreshKey])

  async function fetchStats() {
    try {
      const response = await fetch('/api/invoices/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching invoice stats:', error)
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

  const widgets = [
    {
      label: 'Total Invoices',
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
      label: 'Overdue',
      value: formatCurrency(stats.overdue.amount),
      subtext: `${stats.overdue.count} invoices`,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
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

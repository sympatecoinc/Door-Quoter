'use client'

import { useState, useEffect } from 'react'
import {
  FileText,
  Send,
  CheckCircle,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp
} from 'lucide-react'

interface POStats {
  draft: number
  sent: number
  acknowledged: number
  partial: number
  complete: number
  cancelled: number
  onHold: number
  totalCount: number
  totalValue: number
  pendingValue: number
  completedValue: number
}

interface POStatsWidgetProps {
  refreshKey?: number
}

export default function POStatsWidget({ refreshKey = 0 }: POStatsWidgetProps) {
  const [stats, setStats] = useState<POStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [refreshKey])

  async function fetchStats() {
    try {
      const response = await fetch('/api/purchase-orders/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching PO stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-8 w-8 bg-gray-200 rounded-lg mb-3" />
            <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
            <div className="h-6 w-12 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  const statCards = [
    {
      label: 'Pending POs',
      value: stats.sent + stats.acknowledged + stats.partial,
      subValue: formatCurrency(stats.pendingValue),
      icon: Clock,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    {
      label: 'Awaiting Receipt',
      value: stats.sent + stats.acknowledged,
      icon: Package,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      label: 'Partial Receipts',
      value: stats.partial,
      icon: AlertTriangle,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600'
    },
    {
      label: 'Completed',
      value: stats.complete,
      subValue: formatCurrency(stats.completedValue),
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {statCards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 ${card.iconBg} rounded-lg`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
                {card.subValue && (
                  <p className="text-xs text-gray-500">{card.subValue}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

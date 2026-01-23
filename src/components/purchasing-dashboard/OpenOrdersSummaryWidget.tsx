'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock, AlertTriangle, CheckCircle, PauseCircle, Mail, Package } from 'lucide-react'
import type { OpenOrdersSummaryResponse, AtRiskOrder } from './types'

interface OpenOrdersSummaryWidgetProps {
  refreshKey?: number
  compact?: boolean
  onViewPO?: (poId: number) => void
}

export default function OpenOrdersSummaryWidget({ refreshKey = 0, compact = false, onViewPO }: OpenOrdersSummaryWidgetProps) {
  const [data, setData] = useState<OpenOrdersSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      // Use existing purchase-orders stats endpoint
      const response = await fetch('/api/purchase-orders/stats')
      if (response.ok) {
        const result = await response.json()

        // Transform the data to match our expected format
        const transformed: OpenOrdersSummaryResponse = {
          totalOutstanding: result.stats.pendingValue || 0,
          counts: {
            draft: result.stats.draft || 0,
            sent: result.stats.sent || 0,
            acknowledged: result.stats.acknowledged || 0,
            partial: result.stats.partial || 0,
            onHold: result.stats.onHold || 0,
            complete: result.stats.complete || 0,
            cancelled: result.stats.cancelled || 0
          },
          atRiskOrders: (result.awaitingReceiving || [])
            .filter((po: any) => {
              if (!po.expectedDate) return false
              const expected = new Date(po.expectedDate)
              const today = new Date()
              return expected < today
            })
            .map((po: any) => {
              const expected = new Date(po.expectedDate)
              const today = new Date()
              const daysLate = Math.ceil((today.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24))
              return {
                poId: po.id,
                poNumber: po.poNumber,
                vendorName: po.vendor?.displayName || 'Unknown',
                vendorEmail: po.vendor?.email || null,
                expectedDate: po.expectedDate,
                daysLate,
                totalAmount: po.totalAmount || 0
              }
            })
        }

        setData(transformed)
      }
    } catch (error) {
      console.error('Error fetching open orders summary:', error)
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
        <div className="h-5 bg-gray-200 rounded w-40 mb-2"></div>
        <div className="grid grid-cols-5 gap-2">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
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
        <p className="text-sm text-gray-500">Failed to load open orders</p>
      </div>
    )
  }

  const totalOpenOrders = data.counts.sent + data.counts.acknowledged + data.counts.partial + data.counts.onHold

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Open Orders Summary</h3>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">{formatCurrency(data.totalOutstanding)}</div>
            <div className="text-xs text-gray-500">Outstanding Value</div>
          </div>
        </div>
      </div>

      <div className="p-3">
        {/* Open Status Cards */}
        <div className={`grid grid-cols-2 md:grid-cols-5 gap-2 ${data.atRiskOrders.length > 0 ? 'mb-3' : ''}`}>
          <StatusCard
            label="Draft"
            count={data.counts.draft}
            icon={<FileText className="w-4 h-4" />}
            color="gray"
          />
          <StatusCard
            label="Sent"
            count={data.counts.sent}
            icon={<Clock className="w-4 h-4" />}
            color="blue"
          />
          <StatusCard
            label="Acknowledged"
            count={data.counts.acknowledged}
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
          />
          <StatusCard
            label="Partial"
            count={data.counts.partial}
            icon={<Package className="w-4 h-4" />}
            color="yellow"
          />
          <StatusCard
            label="On Hold"
            count={data.counts.onHold}
            icon={<PauseCircle className="w-4 h-4" />}
            color="orange"
          />
        </div>

        {/* At Risk Orders */}
        {data.atRiskOrders.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Overdue Orders ({data.atRiskOrders.length})</span>
            </div>
            <div className="space-y-2">
              {(compact ? data.atRiskOrders.slice(0, 3) : data.atRiskOrders).map(order => (
                <div
                  key={order.poId}
                  className="p-3 bg-red-50 rounded-lg border border-red-200"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={onViewPO ? 'cursor-pointer hover:underline' : ''}
                      onClick={() => onViewPO?.(order.poId)}
                    >
                      <div className="font-medium text-gray-900">{order.poNumber}</div>
                      <div className="text-sm text-gray-600">{order.vendorName}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{formatCurrency(order.totalAmount)}</div>
                        <div className="text-xs text-red-600">
                          {order.daysLate} days late
                        </div>
                      </div>
                      {order.vendorEmail && (
                        <a
                          href={`mailto:${order.vendorEmail}?subject=PO ${order.poNumber} - Order Status Inquiry&body=Hi,%0D%0A%0D%0AI am following up on PO ${order.poNumber} which was expected to arrive ${order.daysLate} days ago.%0D%0A%0D%0ACould you please provide an update on the status of this order?%0D%0A%0D%0AThank you.`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Contact vendor"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {compact && data.atRiskOrders.length > 3 && (
              <div className="text-center mt-2">
                <span className="text-sm text-gray-500">
                  +{data.atRiskOrders.length - 3} more overdue
                </span>
              </div>
            )}
          </div>
        )}

        {totalOpenOrders === 0 && data.counts.draft === 0 && (
          <div className="mt-2 p-2 text-center text-sm text-gray-500">
            No open purchase orders
          </div>
        )}
      </div>
    </div>
  )
}

interface StatusCardProps {
  label: string
  count: number
  icon: React.ReactNode
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'teal'
}

function StatusCard({ label, count, icon, color }: StatusCardProps) {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    teal: 'bg-teal-50 text-teal-600'
  }

  return (
    <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold">{count}</div>
    </div>
  )
}

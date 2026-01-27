'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Package, AlertCircle, CheckCircle, ShoppingCart, ChevronDown, ChevronRight, Clock } from 'lucide-react'
import type { InventoryAlertsResponse, InventoryAlert } from './types'
import QuickPOModal from './QuickPOModal'

interface InventoryAlertsWidgetProps {
  refreshKey?: number
  compact?: boolean
  onPOCreated?: () => void
}

export default function InventoryAlertsWidget({ refreshKey = 0, compact = false, onPOCreated }: InventoryAlertsWidgetProps) {
  const [data, setData] = useState<InventoryAlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'critical' | 'low' | 'projected'>('all')
  const [expandedAlerts, setExpandedAlerts] = useState<Set<number>>(new Set())
  const [quickPOAlert, setQuickPOAlert] = useState<InventoryAlert | null>(null)

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      const response = await fetch('/api/purchasing/inventory-alerts')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching inventory alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (partId: number) => {
    const newExpanded = new Set(expandedAlerts)
    if (newExpanded.has(partId)) {
      newExpanded.delete(partId)
    } else {
      newExpanded.add(partId)
    }
    setExpandedAlerts(newExpanded)
  }

  const handlePOCreated = () => {
    setQuickPOAlert(null)
    fetchData()
    onPOCreated?.()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Failed to load inventory alerts</p>
      </div>
    )
  }

  const filteredAlerts = data.alerts.filter(alert => {
    if (filter === 'all') return true
    return alert.urgency === filter
  })

  const displayAlerts = compact ? filteredAlerts.slice(0, 5) : filteredAlerts

  const getUrgencyStyle = (urgency: InventoryAlert['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800'
      case 'low':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 'projected':
        return 'bg-blue-50 border-blue-200 text-blue-800'
      default:
        return 'bg-green-50 border-green-200 text-green-800'
    }
  }

  const getUrgencyIcon = (urgency: InventoryAlert['urgency']) => {
    switch (urgency) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'low':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'projected':
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />
    }
  }

  const totalAlerts = data.summary.critical + data.summary.low + (data.summary.projected || 0)

  return (
    <>
      <div className="bg-white rounded-lg shadow flex flex-col min-h-[calc(100vh-280px)]">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Inventory Alerts</h3>
            </div>
            {!compact && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({totalAlerts})
                </button>
                <button
                  onClick={() => setFilter('critical')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    filter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  Critical ({data.summary.critical})
                </button>
                <button
                  onClick={() => setFilter('low')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    filter === 'low' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                  }`}
                >
                  Low ({data.summary.low})
                </button>
                {(data.summary.projected || 0) > 0 && (
                  <button
                    onClick={() => setFilter('projected')}
                    className={`px-3 py-1 text-xs rounded-full ${
                      filter === 'projected' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                  >
                    Projected ({data.summary.projected})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {!compact && (
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{data.summary.critical}</div>
                <div className="text-xs text-red-600">Critical</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{data.summary.low}</div>
                <div className="text-xs text-yellow-600">Low Stock</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{data.summary.projected || 0}</div>
                <div className="text-xs text-blue-600">Projected</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{data.summary.healthy}</div>
                <div className="text-xs text-green-600">Healthy</div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {displayAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>All inventory levels are healthy!</p>
            </div>
          ) : (
            displayAlerts.map(alert => {
              const isExpanded = expandedAlerts.has(alert.partId)
              const hasDemandSources = alert.demandSources && alert.demandSources.length > 0

              return (
                <div
                  key={alert.variantId ? `${alert.partId}-${alert.variantId}` : alert.partId}
                  className={`border rounded-lg p-3 ${getUrgencyStyle(alert.urgency)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getUrgencyIcon(alert.urgency)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {hasDemandSources && !compact && (
                            <button
                              onClick={() => toggleExpanded(alert.partId)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <span className="font-medium">{alert.partNumber}</span>
                          {/* Show color and stock length for extrusions */}
                          {(alert.color || alert.stockLength) && (
                            <span className="text-xs ml-2 px-1.5 py-0.5 bg-gray-200 bg-opacity-50 rounded">
                              {alert.color && <span>{alert.color}</span>}
                              {alert.color && alert.stockLength && <span> · </span>}
                              {alert.stockLength && <span>{alert.stockLength >= 12 ? `${Math.round(alert.stockLength / 12)}ft` : `${alert.stockLength}"`}</span>}
                            </span>
                          )}
                        </div>
                        <div className="text-sm opacity-80">{alert.description}</div>
                        <div className="text-xs mt-1 opacity-70">
                          {alert.vendorName && <span>Vendor: {alert.vendorName} | </span>}
                          {alert.category && <span>Category: {alert.category}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <span className="text-xs opacity-70 text-right">On Hand:</span>
                        <span className="font-medium">{alert.qtyOnHand}</span>
                        {alert.qtyReserved > 0 && (
                          <>
                            <span className="text-xs opacity-70 text-right">Reserved:</span>
                            <span className="font-medium text-orange-600">-{alert.qtyReserved}</span>
                          </>
                        )}
                        {alert.projectedDemand > 0 && (
                          <>
                            <span className="text-xs opacity-70 text-right">Projected:</span>
                            <span className="font-medium text-blue-600">-{alert.projectedDemand}</span>
                          </>
                        )}
                        <span className="text-xs opacity-70 text-right border-t pt-0.5">Available:</span>
                        <span className={`font-bold border-t pt-0.5 ${alert.availableQty < 0 ? 'text-red-600' : ''}`}>
                          {alert.availableQty}
                        </span>
                        {alert.shortage > 0 && (
                          <>
                            <span className="text-xs opacity-70 text-right">Shortage:</span>
                            <span className="font-bold text-red-600">{alert.shortage}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Demand Sources Expansion */}
                  {isExpanded && hasDemandSources && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                      <div className="text-xs font-medium mb-2 opacity-80">Demand Sources:</div>
                      <div className="space-y-1.5">
                        {alert.demandSources.map((source, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white bg-opacity-50 rounded px-2 py-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded ${
                                source.type === 'reserved'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {source.type === 'reserved' ? 'SO' : 'Pipeline'}
                              </span>
                              <span className="font-medium">{source.projectName}</span>
                              <span className="opacity-60">({source.projectStatus})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{source.quantity} units</span>
                              {source.shipDate && (
                                <span className="opacity-60">
                                  Ship: {new Date(source.shipDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create PO Button */}
                  <button
                    onClick={() => setQuickPOAlert(alert)}
                    className="mt-3 flex items-center gap-1.5 text-xs bg-white bg-opacity-60 hover:bg-opacity-100 px-3 py-1.5 rounded font-medium transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Create PO {alert.shortage > 0 ? `(${alert.shortage} short)` : alert.reorderQty ? `(${alert.reorderQty} reorder qty)` : ''}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {compact && filteredAlerts.length > 5 && (
          <div className="p-3 border-t border-gray-200 text-center">
            <span className="text-sm text-gray-500">
              +{filteredAlerts.length - 5} more alerts
            </span>
          </div>
        )}
      </div>

      {/* Quick PO Modal */}
      {quickPOAlert && (
        <QuickPOModal
          alert={quickPOAlert}
          onClose={() => setQuickPOAlert(null)}
          onSuccess={handlePOCreated}
        />
      )}
    </>
  )
}

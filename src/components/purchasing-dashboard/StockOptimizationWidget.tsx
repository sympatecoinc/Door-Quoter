'use client'

import { useState, useEffect } from 'react'
import { Ruler, TrendingUp, AlertTriangle, Package, Info } from 'lucide-react'
import type { StockMetricsResponse, ProfileSummary, FastBurningProfile } from './types'

interface StockOptimizationWidgetProps {
  refreshKey?: number
}

export default function StockOptimizationWidget({ refreshKey = 0 }: StockOptimizationWidgetProps) {
  const [data, setData] = useState<StockMetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'profiles' | 'consumption'>('profiles')

  useEffect(() => {
    fetchData()
  }, [refreshKey])

  async function fetchData() {
    try {
      const response = await fetch('/api/purchasing/stock-metrics')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching stock metrics:', error)
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
        <p className="text-gray-500">Failed to load stock metrics</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Extrusion Stock Analysis</h3>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              activeTab === 'profiles'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Profile Summary
          </button>
          <button
            onClick={() => setActiveTab('consumption')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              activeTab === 'consumption'
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Fast-Burning
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'profiles' ? (
          <ProfileSummaryView profiles={data.profileSummary} />
        ) : (
          <FastBurningView profiles={data.fastBurning} />
        )}

        {/* Opticutter Placeholder */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500">
            <Info className="w-4 h-4" />
            <span className="text-sm">Opticutter integration coming soon - waste analysis and cut optimization</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ProfileSummaryViewProps {
  profiles: ProfileSummary[]
}

function ProfileSummaryView({ profiles }: ProfileSummaryViewProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No extrusion profiles found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {profiles.slice(0, 8).map((profile, index) => (
        <div
          key={profile.profileType}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div>
            <div className="font-medium text-gray-900">{profile.profileType}</div>
            <div className="text-xs text-gray-500">{profile.variants} variants</div>
          </div>
          <div className="flex items-center gap-4">
            {profile.lowStockCount > 0 && (
              <div className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{profile.lowStockCount} low</span>
              </div>
            )}
            <div className="text-right">
              <div className="font-semibold text-gray-900">{profile.totalStock}</div>
              <div className="text-xs text-gray-500">Total Stock</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface FastBurningViewProps {
  profiles: FastBurningProfile[]
}

function FastBurningView({ profiles }: FastBurningViewProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No consumption data available</p>
        <p className="text-xs mt-1">Data appears after receiving POs</p>
      </div>
    )
  }

  const maxConsumption = Math.max(...profiles.map(p => p.consumption30Days))

  return (
    <div className="space-y-3">
      {profiles.map((profile, index) => {
        const barWidth = (profile.consumption30Days / maxConsumption) * 100
        const isLowStock = profile.currentStock < profile.consumption30Days

        return (
          <div key={profile.partNumber} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium text-gray-900">{profile.partNumber}</div>
                <div className="text-xs text-gray-500">{profile.description}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{profile.consumption30Days}</div>
                <div className="text-xs text-gray-500">30-day usage</div>
              </div>
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${
                  isLowStock ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className={isLowStock ? 'text-red-600' : 'text-gray-500'}>
                Current: {profile.currentStock}
              </span>
              {isLowStock && (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Below 30-day usage
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

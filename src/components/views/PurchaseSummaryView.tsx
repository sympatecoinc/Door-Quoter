'use client'

import { useState } from 'react'
import { RefreshCw, ClipboardList } from 'lucide-react'
import CombinedPurchaseSummaryWidget from '@/components/purchasing-dashboard/CombinedPurchaseSummaryWidget'

export default function PurchaseSummaryView() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Summary</h1>
            <p className="text-sm text-gray-500">Combined material requirements for selected projects</p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <CombinedPurchaseSummaryWidget refreshKey={refreshKey} />
    </div>
  )
}

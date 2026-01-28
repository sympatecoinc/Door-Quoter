'use client'

import { useState, useEffect, useCallback, use } from 'react'
import {
  Camera,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Package,
  CheckCircle2
} from 'lucide-react'
import PackingScanner from '@/components/packing/PackingScanner'
import PackingChecklist from '@/components/packing/PackingChecklist'

interface PackingItem {
  id: number
  openingName: string
  itemType: 'component' | 'hardware' | 'jambkit'
  itemName: string
  partNumber: string | null
  dimensions?: string
  qrData: string
  status: 'pending' | 'packed'
  stickerNumber: number
  packedAt?: string | null
}

interface PackingData {
  project: {
    id: number
    name: string
    customerName: string | null
  }
  items: PackingItem[]
  stats: {
    total: number
    packed: number
    remaining: number
  }
}

type ViewMode = 'scanner' | 'checklist'

export default function PackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PackingData | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('scanner')
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Fetch packing list data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/packing/${token}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load packing list')
      }
      const packingData = await response.json()
      setData(packingData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packing list')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle QR scan
  const handleScan = useCallback(async (qrData: string) => {
    try {
      const response = await fetch(`/api/packing/${token}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData })
      })

      const result = await response.json()

      if (result.success) {
        setLastScanResult({
          success: true,
          message: `Packed: ${result.item.itemName}`
        })

        // Update local data
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map(item =>
              item.qrData === qrData
                ? { ...item, status: 'packed' as const, packedAt: new Date().toISOString() }
                : item
            ),
            stats: result.stats || prev.stats
          }
        })
      } else if (result.alreadyPacked) {
        setLastScanResult({
          success: false,
          message: `Already packed: ${result.item?.itemName || 'Item'}`
        })
      } else {
        setLastScanResult({
          success: false,
          message: result.error || 'Item not found'
        })
      }

      // Clear result after delay
      setTimeout(() => setLastScanResult(null), 3000)
    } catch (err) {
      setLastScanResult({
        success: false,
        message: 'Scan failed. Please try again.'
      })
      setTimeout(() => setLastScanResult(null), 3000)
    }
  }, [token])

  // Handle manual toggle (for checklist)
  const handleManualToggle = useCallback(async (item: PackingItem) => {
    if (item.status === 'packed') return // Don't allow unpacking

    await handleScan(item.qrData)
  }, [handleScan])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading packing list...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Packing List Not Found
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              fetchData()
            }}
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const progressPercent = data.stats.total > 0
    ? Math.round((data.stats.packed / data.stats.total) * 100)
    : 0

  const isComplete = data.stats.packed === data.stats.total && data.stats.total > 0

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className={`${isComplete ? 'bg-green-600' : 'bg-blue-600'} text-white p-4 shadow-lg transition-colors`}>
        <div className="max-w-lg mx-auto">
          {/* Project Info */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-5 w-5" />
                <span className="text-sm font-medium opacity-80">Packing Verification</span>
              </div>
              <h1 className="text-xl font-bold">{data.project.name}</h1>
              {data.project.customerName && (
                <p className={`text-sm ${isComplete ? 'text-green-100' : 'text-blue-100'}`}>
                  {data.project.customerName}
                </p>
              )}
            </div>
            <button
              onClick={fetchData}
              className={`p-2 rounded-lg ${isComplete ? 'bg-green-700 hover:bg-green-800' : 'bg-blue-700 hover:bg-blue-800'}`}
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                {isComplete ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    All items packed!
                  </span>
                ) : (
                  `${data.stats.packed} of ${data.stats.total} items packed`
                )}
              </span>
              <span className="font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isComplete ? 'bg-white' : 'bg-white'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24">
        <div className="max-w-lg mx-auto">
          {viewMode === 'scanner' ? (
            <PackingScanner
              onScan={handleScan}
              disabled={isComplete}
              lastScanResult={lastScanResult}
            />
          ) : (
            <PackingChecklist
              items={data.items}
              onManualToggle={handleManualToggle}
            />
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setViewMode('scanner')}
            className={`flex-1 flex flex-col items-center py-3 transition-colors ${
              viewMode === 'scanner'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Camera className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">Scan</span>
          </button>
          <button
            onClick={() => setViewMode('checklist')}
            className={`flex-1 flex flex-col items-center py-3 transition-colors ${
              viewMode === 'checklist'
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <ClipboardList className="h-6 w-6 mb-1" />
            <span className="text-xs font-medium">Checklist</span>
          </button>
        </div>
      </nav>

      {/* Completion Celebration */}
      {isComplete && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-2">🎉</div>
          </div>
        </div>
      )}
    </div>
  )
}

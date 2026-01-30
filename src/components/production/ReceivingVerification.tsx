'use client'

import { useState, useEffect, useRef } from 'react'
import {
  QrCode,
  Check,
  X,
  AlertTriangle,
  Package,
  Camera,
  CheckCircle2,
  XCircle,
  ScanLine,
  Keyboard,
  MessageSquare
} from 'lucide-react'

interface ReceivingItem {
  id: string
  partNumber: string
  partName: string
  partType: string | null
  quantity: number
  cutLength: number | null
  stockLength: number | null
  binLocation: string | null
  openingName: string | null
  productName: string | null
  isReceived: boolean
  receivedAt: string | null
  receivedBy?: { id: number; name: string } | null
  receivingNotes: string | null
}

interface ReceivingVerificationProps {
  items: ReceivingItem[]
  onItemReceive: (itemId: string, isReceived: boolean, notes?: string) => Promise<void>
  onBulkReceive: (itemIds: string[], isReceived: boolean) => Promise<void>
  disabled?: boolean
}

export default function ReceivingVerification({
  items,
  onItemReceive,
  onBulkReceive,
  disabled = false
}: ReceivingVerificationProps) {
  const [scannerMode, setScannerMode] = useState<'keyboard' | 'camera'>('keyboard')
  const [scanInput, setScanInput] = useState('')
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean
    message: string
    itemId?: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState<Set<string>>(new Set())
  const [showNotesModal, setShowNotesModal] = useState<string | null>(null)
  const [notesInput, setNotesInput] = useState('')
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Filter to only extrusion items (cuts from Cutting station)
  const receivingItems = items.filter(item => item.partType === 'Extrusion')

  // Focus scan input when component mounts or scanner mode changes
  useEffect(() => {
    if (scannerMode === 'keyboard' && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scannerMode])

  // Calculate progress
  const totalItems = receivingItems.length
  const receivedItems = receivingItems.filter(i => i.isReceived).length
  const progressPercent = totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0
  const allReceived = receivedItems === totalItems

  // Parse QR code data
  // Expected format: WO:{workOrderId}|P:{partNumber}|B:{batchNumber}
  const parseQRCode = (qrData: string): { partNumber: string; batchNumber?: number } | null => {
    try {
      const parts = qrData.split('|')
      const partNumberPart = parts.find(p => p.startsWith('P:'))
      if (!partNumberPart) return null

      const partNumber = partNumberPart.replace('P:', '')
      const batchPart = parts.find(p => p.startsWith('B:'))
      const batchNumber = batchPart ? parseInt(batchPart.replace('B:', '')) : undefined

      return { partNumber, batchNumber }
    } catch {
      return null
    }
  }

  const handleScan = async () => {
    if (!scanInput.trim()) return

    const parsed = parseQRCode(scanInput.trim())

    if (!parsed) {
      // Try direct part number match
      const matchingItem = receivingItems.find(
        item => item.partNumber.toLowerCase() === scanInput.trim().toLowerCase()
      )

      if (matchingItem) {
        await handleReceiveItem(matchingItem)
      } else {
        setLastScanResult({
          success: false,
          message: `No matching part found: ${scanInput}`
        })
      }
    } else {
      // Find matching item by part number
      const matchingItem = receivingItems.find(
        item => item.partNumber === parsed.partNumber
      )

      if (matchingItem) {
        await handleReceiveItem(matchingItem)
      } else {
        setLastScanResult({
          success: false,
          message: `Part not in this work order: ${parsed.partNumber}`
        })
      }
    }

    setScanInput('')
    scanInputRef.current?.focus()
  }

  const handleReceiveItem = async (item: ReceivingItem) => {
    if (item.isReceived) {
      setLastScanResult({
        success: false,
        message: `Already received: ${item.partNumber}`
      })
      return
    }

    setIsLoading(prev => new Set(prev).add(item.id))
    try {
      await onItemReceive(item.id, true)
      setLastScanResult({
        success: true,
        message: `Received: ${item.partName}`,
        itemId: item.id
      })
    } catch {
      setLastScanResult({
        success: false,
        message: `Failed to mark as received: ${item.partNumber}`
      })
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleToggleItem = async (item: ReceivingItem) => {
    if (disabled || isLoading.has(item.id)) return

    setIsLoading(prev => new Set(prev).add(item.id))
    try {
      await onItemReceive(item.id, !item.isReceived)
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const handleReceiveAll = async () => {
    if (disabled) return
    const unreceivedIds = receivingItems.filter(i => !i.isReceived).map(i => i.id)
    if (unreceivedIds.length === 0) return

    setIsLoading(new Set(unreceivedIds))
    try {
      await onBulkReceive(unreceivedIds, true)
    } finally {
      setIsLoading(new Set())
    }
  }

  const handleAddNotes = async () => {
    if (!showNotesModal || !notesInput.trim()) return

    setIsLoading(prev => new Set(prev).add(showNotesModal))
    try {
      await onItemReceive(showNotesModal, true, notesInput.trim())
      setShowNotesModal(null)
      setNotesInput('')
    } finally {
      setIsLoading(prev => {
        const next = new Set(prev)
        next.delete(showNotesModal)
        return next
      })
    }
  }

  const formatLength = (inches: number | null): string => {
    if (!inches) return '-'
    // Always show in inches
    return `${inches.toFixed(3)}"`
  }

  // Group items by opening for organized display
  const itemsByOpening = receivingItems.reduce((acc, item) => {
    const opening = item.openingName || 'Unassigned'
    if (!acc[opening]) acc[opening] = []
    acc[opening].push(item)
    return acc
  }, {} as Record<string, ReceivingItem[]>)

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Receiving Verification</h3>
            <p className="text-sm text-gray-600">
              Scan or check off bundles from cutting
            </p>
          </div>

          {!allReceived && (
            <button
              onClick={handleReceiveAll}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Receive All
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                allReceived ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {receivedItems} / {totalItems} received
          </span>
        </div>

        {allReceived && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">All items received - Ready to start assembly</span>
          </div>
        )}
      </div>

      {/* Scanner section */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Quick Scan</h4>
          <div className="flex gap-1">
            <button
              onClick={() => setScannerMode('keyboard')}
              className={`p-2 rounded transition-colors ${
                scannerMode === 'keyboard' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScannerMode('camera')}
              className={`p-2 rounded transition-colors ${
                scannerMode === 'camera' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {scannerMode === 'keyboard' ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScan()
                  }
                }}
                placeholder="Scan QR code or enter part number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                disabled={disabled}
              />
            </div>
            <button
              onClick={handleScan}
              disabled={!scanInput.trim() || disabled}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        ) : (
          <div className="p-8 bg-gray-100 rounded-lg text-center">
            <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Camera scanning not yet implemented.
              <br />
              Use keyboard mode for now.
            </p>
          </div>
        )}

        {/* Last scan result */}
        {lastScanResult && (
          <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
            lastScanResult.success
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {lastScanResult.success ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{lastScanResult.message}</span>
          </div>
        )}
      </div>

      {/* Items list by opening */}
      <div className="space-y-3">
        {Object.entries(itemsByOpening).map(([opening, openingItems]) => {
          const openingReceived = openingItems.filter(i => i.isReceived).length
          const openingTotal = openingItems.length

          return (
            <div key={opening} className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">{opening}</span>
                </div>
                <span className={`text-sm px-2 py-0.5 rounded-full ${
                  openingReceived === openingTotal
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {openingReceived}/{openingTotal}
                </span>
              </div>

              <div className="divide-y">
                {openingItems.map(item => {
                  const itemLoading = isLoading.has(item.id)

                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 flex items-center justify-between ${
                        item.isReceived ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleItem(item)}
                          disabled={disabled || itemLoading}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                            item.isReceived
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          } ${itemLoading ? 'opacity-50' : ''}`}
                        >
                          {item.isReceived && <Check className="w-4 h-4" />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${item.isReceived ? 'text-gray-500 line-through' : ''}`}>
                              {item.partName}
                            </span>
                            {item.receivingNotes && (
                              <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                                Has notes
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="font-mono">{item.partNumber}</span>
                            <span>•</span>
                            <span>{formatLength(item.cutLength)}</span>
                            <span>•</span>
                            <span>{item.quantity} pcs</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!item.isReceived && (
                          <button
                            onClick={() => {
                              setShowNotesModal(item.id)
                              setNotesInput('')
                            }}
                            className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                            title="Report issue"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        )}

                        {item.isReceived && item.receivedBy && (
                          <span className="text-xs text-gray-500">
                            by {item.receivedBy.name}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {receivingItems.length === 0 && (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No extrusion items to receive.</p>
        </div>
      )}

      {/* Notes modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Report Issue</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add notes about any issues with this item (damage, missing pieces, etc.)
            </p>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="e.g., 2 pieces damaged during cutting"
              className="w-full px-3 py-2 border rounded-lg mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(null)
                  setNotesInput('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNotes}
                disabled={!notesInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save & Mark Received
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

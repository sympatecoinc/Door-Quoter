'use client'

import { useState } from 'react'
import { FileText, FilePlus, X, ArrowRight, Loader2, AlertTriangle } from 'lucide-react'

interface FamilySalesOrderInfo {
  id: number
  orderNumber: string
  projectId: number | null
  projectVersion: number | null
  projectName: string | null
  status: string
  totalAmount: number
}

interface SOChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: number
  projectVersion: number
  familySalesOrder: FamilySalesOrderInfo
  onNewSalesOrder: () => Promise<void>
  onChangeOrder: () => Promise<void>
}

export default function SOChoiceModal({
  isOpen,
  onClose,
  projectId,
  projectVersion,
  familySalesOrder,
  onNewSalesOrder,
  onChangeOrder,
}: SOChoiceModalProps) {
  const [loading, setLoading] = useState<'new' | 'change' | null>(null)

  if (!isOpen) return null

  const handleNewSO = async () => {
    setLoading('new')
    try {
      await onNewSalesOrder()
    } finally {
      setLoading(null)
    }
  }

  const handleChangeOrder = async () => {
    setLoading('change')
    try {
      await onChangeOrder()
    } finally {
      setLoading(null)
    }
  }

  const isLoading = loading !== null
  const isConfirmed = familySalesOrder.status !== 'DRAFT'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Sales Order Already Exists
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info */}
        <div className="px-6 py-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <p className="text-sm text-blue-800">
              <strong>{familySalesOrder.orderNumber}</strong> exists for
              {familySalesOrder.projectVersion ? ` v${familySalesOrder.projectVersion}` : ''} of this project.
              Choose how to handle the Sales Order for this new revision (v{projectVersion}).
            </p>
          </div>

          {/* Warning for confirmed SOs */}
          {isConfirmed && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                The existing SO has been <strong>confirmed</strong> with inventory reserved.
                A new Sales Order is required — the previous SO will be voided and reservations released.
              </p>
            </div>
          )}

          {/* Choice Cards */}
          <div className="space-y-3">
            {/* New Sales Order */}
            <button
              onClick={handleNewSO}
              disabled={isLoading}
              className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  {loading === 'new' ? (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  ) : (
                    <FilePlus className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">New Sales Order</h4>
                    <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Void the existing SO ({familySalesOrder.orderNumber}) and create a new one from this revision.
                    Use when the scope has changed significantly.
                  </p>
                </div>
              </div>
            </button>

            {/* Change Order */}
            <button
              onClick={handleChangeOrder}
              disabled={isConfirmed || isLoading}
              className={`w-full p-4 border-2 rounded-lg transition-all text-left group ${
                isConfirmed
                  ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                  : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  isConfirmed ? 'bg-gray-200' : 'bg-amber-100 group-hover:bg-amber-200'
                }`}>
                  {loading === 'change' ? (
                    <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                  ) : (
                    <FileText className={`w-5 h-5 ${isConfirmed ? 'text-gray-400' : 'text-amber-600'}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold ${isConfirmed ? 'text-gray-400' : 'text-gray-900'}`}>Change Order</h4>
                    {!isConfirmed && (
                      <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${isConfirmed ? 'text-gray-400' : 'text-gray-600'}`}>
                    Create a Change Order documenting what changed. The existing SO will be updated to match this revision.
                    Use for incremental changes.
                  </p>
                  {isConfirmed && (
                    <p className="text-xs text-amber-600 font-medium mt-1">Not available — SO has been confirmed</p>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { X, Bell, AlertTriangle, Wrench, Package, HelpCircle, AlertCircle, Loader2 } from 'lucide-react'

export type IssueType = 'URGENT' | 'MATERIAL' | 'EQUIPMENT' | 'QUALITY' | 'OTHER'

interface IssueTypeOption {
  value: IssueType
  label: string
  description: string
  icon: React.ReactNode
  color: string
}

const ISSUE_TYPES: IssueTypeOption[] = [
  {
    value: 'URGENT',
    label: 'Urgent',
    description: 'Needs immediate attention',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'bg-red-100 text-red-700 border-red-300'
  },
  {
    value: 'MATERIAL',
    label: 'Material Issue',
    description: 'Material shortage or quality issue',
    icon: <Package className="w-5 h-5" />,
    color: 'bg-orange-100 text-orange-700 border-orange-300'
  },
  {
    value: 'EQUIPMENT',
    label: 'Equipment Problem',
    description: 'Equipment malfunction or maintenance needed',
    icon: <Wrench className="w-5 h-5" />,
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300'
  },
  {
    value: 'QUALITY',
    label: 'Quality Concern',
    description: 'Quality concern with product',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'bg-purple-100 text-purple-700 border-purple-300'
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'General assistance needed',
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'bg-gray-100 text-gray-700 border-gray-300'
  }
]

interface CallManagerModalProps {
  isOpen: boolean
  onClose: () => void
  stationName: string
  workOrderInfo?: {
    id: string
    projectName: string
    batchNumber: number
  } | null
}

export default function CallManagerModal({
  isOpen,
  onClose,
  stationName,
  workOrderInfo
}: CallManagerModalProps) {
  const [issueType, setIssueType] = useState<IssueType>('OTHER')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim()) {
      setError('Please describe the issue')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/production/call-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: stationName,
          issueType,
          message: message.trim(),
          workOrderId: workOrderInfo?.id || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notification')
      }

      setSuccess(true)
      // Reset and close after showing success
      setTimeout(() => {
        setMessage('')
        setIssueType('OTHER')
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setMessage('')
      setIssueType('OTHER')
      setError(null)
      setSuccess(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-full">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contact Production Manager</h2>
              <p className="text-sm text-gray-600">Send a notification to the manager</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notification Sent</h3>
            <p className="text-gray-600">The production manager has been notified.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Station and Work Order Info */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
                {stationName} Station
              </span>
              {workOrderInfo && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                  {workOrderInfo.projectName} - Batch {workOrderInfo.batchNumber}
                </span>
              )}
            </div>

            {/* Issue Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Issue Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ISSUE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setIssueType(type.value)}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      issueType === type.value
                        ? `${type.color} border-current`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <span className={issueType === type.value ? '' : 'text-gray-400'}>
                      {type.icon}
                    </span>
                    <div>
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs opacity-75">{type.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                Describe the Issue <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what's happening and what help you need..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                disabled={isSubmitting}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

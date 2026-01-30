'use client'

import { Check, Clock } from 'lucide-react'

interface FieldVerificationIndicatorProps {
  uploadCount: number
  confirmedCount: number
  onClick?: () => void
  showWhenEmpty?: boolean
}

export default function FieldVerificationIndicator({
  uploadCount,
  confirmedCount,
  onClick,
  showWhenEmpty = false
}: FieldVerificationIndicatorProps) {
  // Determine status: grey (no uploads), yellow (pending), green (confirmed)
  const hasUploads = uploadCount > 0
  const allConfirmed = hasUploads && confirmedCount === uploadCount
  const hasPending = hasUploads && confirmedCount < uploadCount

  // If no uploads and not showing empty state, return null
  if (!hasUploads && !showWhenEmpty) {
    return null
  }

  // Grey state - no uploads
  if (!hasUploads) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        title="No verification photos uploaded"
      >
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium">0</span>
      </button>
    )
  }

  // Green state - all confirmed
  if (allConfirmed) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-1 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
        title={`${uploadCount} verification photo${uploadCount !== 1 ? 's' : ''} confirmed`}
      >
        <Check className="w-4 h-4 text-green-600" />
        <span className="text-xs font-medium">{uploadCount}</span>
      </button>
    )
  }

  // Yellow state - has pending (uploaded but not all confirmed)
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
      title={`${uploadCount} photo${uploadCount !== 1 ? 's' : ''} uploaded, ${confirmedCount} confirmed - click to review`}
    >
      <Clock className="w-4 h-4 text-amber-500" />
      <span className="text-xs font-medium">{uploadCount}</span>
    </button>
  )
}

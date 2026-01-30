'use client'

import { CheckCircle2 } from 'lucide-react'

interface FieldVerificationIndicatorProps {
  uploadCount: number
  onClick?: () => void
}

export default function FieldVerificationIndicator({
  uploadCount,
  onClick
}: FieldVerificationIndicatorProps) {
  if (uploadCount === 0) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
      title={`${uploadCount} verification photo${uploadCount !== 1 ? 's' : ''} uploaded`}
    >
      <CheckCircle2 className="w-4 h-4 text-green-600" />
      <span className="text-xs font-medium">{uploadCount}</span>
    </button>
  )
}

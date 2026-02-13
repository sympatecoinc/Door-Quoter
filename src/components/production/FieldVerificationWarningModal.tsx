'use client'

import { AlertTriangle, X, Download, Eye } from 'lucide-react'

interface FieldVerificationWarningModalProps {
  projectName: string
  uploadCount: number
  confirmedCount: number
  onStartVerification: () => void
  onReviewVerification: () => void
  onOverride: () => void
  onCancel: () => void
}

export default function FieldVerificationWarningModal({
  projectName,
  uploadCount,
  confirmedCount,
  onStartVerification,
  onReviewVerification,
  onOverride,
  onCancel
}: FieldVerificationWarningModalProps) {
  const hasUploads = uploadCount > 0
  const allConfirmed = hasUploads && confirmedCount === uploadCount

  // If all confirmed, this modal shouldn't be shown — but guard anyway
  if (allConfirmed) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-gray-900">Field Verification Incomplete</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message */}
        <div className="mb-6">
          {!hasUploads ? (
            <p className="text-sm text-gray-600">
              No field verification photos have been submitted for <span className="font-semibold">{projectName}</span>. Generating work orders without verified field measurements may lead to production errors.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              {uploadCount} photo{uploadCount !== 1 ? 's' : ''} uploaded but only {confirmedCount} confirmed for <span className="font-semibold">{projectName}</span>. Generating work orders before all measurements are verified may lead to production errors.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          {/* Left: FV action */}
          {!hasUploads ? (
            <button
              onClick={onStartVerification}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Start Field Verification
            </button>
          ) : (
            <button
              onClick={onReviewVerification}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              Review Verification
            </button>
          )}

          {/* Right: Override */}
          <button
            onClick={onOverride}
            className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            Override & Generate
          </button>
        </div>
      </div>
    </div>
  )
}

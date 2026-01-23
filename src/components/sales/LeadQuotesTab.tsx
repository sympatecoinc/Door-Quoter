'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Download, Send, Clock, DollarSign, FileText, RefreshCw, Info } from 'lucide-react'
import { QuoteVersion, ProjectStatus } from '@/types'
import QuoteVersionModal from './QuoteVersionModal'
import QuoteSettingsPanel from './QuoteSettingsPanel'
import QuoteDocumentsPanel from './QuoteDocumentsPanel'

// Statuses where quote generation is locked (quote has been accepted or project is in progress)
const QUOTE_LOCKED_STATUSES = [
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE
]

interface LeadQuotesTabProps {
  leadId: number
  leadName: string
  isCurrentVersion?: boolean
  status?: ProjectStatus
}

interface ChangeStatus {
  hasChanges: boolean
  reason: string
  details?: {
    isFirstQuote?: boolean
    hasNoOpenings?: boolean
    changeCount?: number
    changes?: string[]
  }
}

export default function LeadQuotesTab({ leadId, leadName, isCurrentVersion = true, status }: LeadQuotesTabProps) {
  // Check if quotes are locked due to status (accepted/active/complete)
  const isQuoteLocked = status ? QUOTE_LOCKED_STATUSES.includes(status) : false
  const [versions, setVersions] = useState<QuoteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<QuoteVersion | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null)
  const [changeStatus, setChangeStatus] = useState<ChangeStatus | null>(null)
  const [checkingChanges, setCheckingChanges] = useState(false)

  // Track latest request to prevent stale responses from race conditions
  const latestChangeCheckRef = useRef(0)

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${leadId}/quote-versions`)
      if (response.ok) {
        const data = await response.json()
        setVersions(data.versions || [])
      }
    } catch (error) {
      console.error('Error fetching quote versions:', error)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const checkForChanges = useCallback(async () => {
    // Increment and capture the request ID to detect stale responses
    const requestId = ++latestChangeCheckRef.current

    try {
      setCheckingChanges(true)
      const response = await fetch(`/api/projects/${leadId}/quote-versions/has-changes`)

      // Only update state if this is still the latest request
      if (requestId !== latestChangeCheckRef.current) {
        return // Discard stale response
      }

      if (response.ok) {
        const data = await response.json()
        setChangeStatus(data)
      }
    } catch (error) {
      // Only update state if this is still the latest request
      if (requestId !== latestChangeCheckRef.current) {
        return
      }
      console.error('Error checking for changes:', error)
      // On error, allow generating (fail open)
      setChangeStatus({ hasChanges: true, reason: 'Unable to check for changes' })
    } finally {
      // Only clear loading state if this is still the latest request
      if (requestId === latestChangeCheckRef.current) {
        setCheckingChanges(false)
      }
    }
  }, [leadId])

  useEffect(() => {
    fetchVersions()
    checkForChanges()
  }, [fetchVersions, checkForChanges])

  // Re-check for changes when settings or documents are updated
  const handleSettingsOrDocumentsChanged = useCallback(() => {
    fetchVersions()
    checkForChanges()
  }, [fetchVersions, checkForChanges])

  const handleGenerateQuote = async () => {
    if (generating) return

    try {
      setGenerating(true)
      const response = await fetch(`/api/projects/${leadId}/quote-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        await fetchVersions()
        await checkForChanges() // Re-check changes after generating
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to generate quote')
      }
    } catch (error) {
      console.error('Error generating quote:', error)
      alert('Failed to generate quote')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPdf = async (version: QuoteVersion) => {
    try {
      setDownloadingPdf(version.id)
      const response = await fetch(`/api/projects/${leadId}/quote-versions/${version.id}/pdf`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${leadName}-Quote-v${version.version}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('Failed to generate PDF')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return (
    <div className="space-y-4">
      {/* Quote Settings Panels */}
      <QuoteSettingsPanel projectId={leadId} onSettingsChanged={handleSettingsOrDocumentsChanged} />
      <QuoteDocumentsPanel projectId={leadId} onDocumentsChanged={handleSettingsOrDocumentsChanged} />

      {/* Header with Generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Quote Versions ({versions.length})
          </h3>
          <p className="text-sm text-gray-500">
            Configure settings above, then generate quote snapshots
          </p>
        </div>
        {isCurrentVersion && (
          <div className="flex items-center gap-3">
            {/* Show reason when button is disabled */}
            {!generating && isQuoteLocked && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600" title="Quote is locked after acceptance">
                <Info className="w-4 h-4" />
                <span>Quote locked - create revision to modify</span>
              </div>
            )}
            {!generating && !isQuoteLocked && changeStatus && !changeStatus.hasChanges && (
              <div className={`flex items-center gap-1.5 text-sm ${changeStatus.details?.hasNoOpenings ? 'text-amber-600' : 'text-gray-500'}`} title={changeStatus.reason}>
                <Info className="w-4 h-4" />
                <span>{changeStatus.details?.hasNoOpenings ? 'Add openings to generate quote' : 'No changes since last quote'}</span>
              </div>
            )}
            <button
              onClick={handleGenerateQuote}
              disabled={isQuoteLocked || generating || checkingChanges || (changeStatus !== null && !changeStatus.hasChanges)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                isQuoteLocked
                  ? 'Quote is locked after acceptance. Create a revision to generate new quotes.'
                  : changeStatus?.details?.hasNoOpenings
                    ? 'Add openings to the project before generating a quote'
                    : changeStatus && !changeStatus.hasChanges
                      ? changeStatus.reason
                      : changeStatus?.details?.changes?.join(', ') || 'Generate a new quote version'
              }
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : checkingChanges ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generate New Quote
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Quote Versions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-24 bg-gray-200 rounded"></div>
                  <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : versions.length > 0 ? (
        <div className="space-y-3">
          {versions.map((version) => (
            <div
              key={version.id}
              onClick={() => setSelectedVersion(version)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
                      v{version.version}
                    </span>
                    <span className="text-lg font-semibold text-gray-900">
                      {formatPrice(version.totalPrice)}
                    </span>
                    {version.pricingModeName && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {version.pricingModeName}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(version.createdAt)}
                    </span>
                    {version.createdBy && (
                      <span>by {version.createdBy}</span>
                    )}
                    {version.sentAt && (
                      <span className="flex items-center gap-1 text-green-600">
                        <Send className="w-4 h-4" />
                        Sent to {version.sentTo}
                      </span>
                    )}
                  </div>
                  {version.changeNotes && (
                    <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                      {version.changeNotes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-start justify-start gap-4 text-xs text-gray-500 divide-x divide-gray-200">
                    <div className="pr-4">
                      <span className="block text-gray-400">Subtotal</span>
                      <span className="text-gray-700">{formatPrice(version.subtotal)}</span>
                    </div>
                    {version.markupAmount > 0 && (
                      <div className="pl-4 pr-4">
                        <span className="block text-gray-400">Markup</span>
                        <span className="text-gray-700">+{formatPrice(version.markupAmount)}</span>
                      </div>
                    )}
                    {version.taxAmount > 0 && (
                      <div className="pl-4 pr-4">
                        <span className="block text-gray-400">Tax ({(version.taxRate * 100).toFixed(1)}%)</span>
                        <span className="text-gray-700">{formatPrice(version.taxAmount)}</span>
                      </div>
                    )}
                    <div className="pl-4 pr-4">
                      <span className="block text-gray-400">Drawing View</span>
                      <span className="text-gray-700">
                        {(version.snapshot as any)?.quoteDrawingView === 'PLAN' ? 'Plan' : 'Elevation'}
                      </span>
                    </div>
                    <div className="pl-4">
                      <span className="block text-gray-400">Installation</span>
                      <span className="text-gray-700">
                        {(version.snapshot as any)?.installationMethod === 'MANUAL'
                          ? 'Manual'
                          : (version.snapshot as any)?.installationComplexity || 'Standard'}
                        {version.installationCost > 0 && ` (${formatPrice(version.installationCost)})`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDownloadPdf(version)
                    }}
                    disabled={downloadingPdf === version.id}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                    title="Download PDF"
                  >
                    {downloadingPdf === version.id ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No quote versions yet</h3>
          <p className="text-gray-500 mb-4">
            {!isCurrentVersion
              ? 'This historical version has no quotes.'
              : isQuoteLocked
                ? 'Quote generation is locked. Create a revision to generate new quotes.'
                : changeStatus?.details?.hasNoOpenings
                  ? 'Add openings to the project before generating a quote.'
                  : 'Generate your first quote to create a versioned snapshot.'}
          </p>
          {isCurrentVersion && !isQuoteLocked && !changeStatus?.details?.hasNoOpenings && (
            <button
              onClick={handleGenerateQuote}
              disabled={generating || checkingChanges || (changeStatus !== null && !changeStatus.hasChanges)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                changeStatus && !changeStatus.hasChanges
                  ? changeStatus.reason
                  : 'Generate your first quote'
              }
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : checkingChanges ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Generate Quote
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Quote Version Modal */}
      {selectedVersion && (
        <QuoteVersionModal
          version={selectedVersion}
          leadName={leadName}
          onClose={() => setSelectedVersion(null)}
          onVersionUpdated={fetchVersions}
        />
      )}
    </div>
  )
}

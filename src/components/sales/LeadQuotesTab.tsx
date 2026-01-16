'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Send, Clock, DollarSign, FileText, RefreshCw } from 'lucide-react'
import { QuoteVersion } from '@/types'
import QuoteVersionModal from './QuoteVersionModal'
import QuoteSettingsPanel from './QuoteSettingsPanel'
import QuoteDocumentsPanel from './QuoteDocumentsPanel'

interface LeadQuotesTabProps {
  leadId: number
  leadName: string
}

export default function LeadQuotesTab({ leadId, leadName }: LeadQuotesTabProps) {
  const [versions, setVersions] = useState<QuoteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<QuoteVersion | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null)

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

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

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
      <QuoteSettingsPanel projectId={leadId} onSettingsChanged={fetchVersions} />
      <QuoteDocumentsPanel projectId={leadId} onDocumentsChanged={fetchVersions} />

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
        <button
          onClick={handleGenerateQuote}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Generate New Quote
            </>
          )}
        </button>
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
                  <div className="mt-2 grid grid-cols-4 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="block text-gray-400">Subtotal</span>
                      <span className="text-gray-700">{formatPrice(version.subtotal)}</span>
                    </div>
                    {version.markupAmount > 0 && (
                      <div>
                        <span className="block text-gray-400">Markup</span>
                        <span className="text-gray-700">+{formatPrice(version.markupAmount)}</span>
                      </div>
                    )}
                    {version.installationCost > 0 && (
                      <div>
                        <span className="block text-gray-400">Installation</span>
                        <span className="text-gray-700">{formatPrice(version.installationCost)}</span>
                      </div>
                    )}
                    {version.taxAmount > 0 && (
                      <div>
                        <span className="block text-gray-400">Tax ({(version.taxRate * 100).toFixed(1)}%)</span>
                        <span className="text-gray-700">{formatPrice(version.taxAmount)}</span>
                      </div>
                    )}
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
            Generate your first quote to create a versioned snapshot.
          </p>
          <button
            onClick={handleGenerateQuote}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate Quote
              </>
            )}
          </button>
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

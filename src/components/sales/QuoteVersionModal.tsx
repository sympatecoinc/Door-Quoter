'use client'

import { useState } from 'react'
import { X, Download, Send, Mail, Clock, DollarSign, LayoutGrid, RefreshCw, FileJson } from 'lucide-react'
import { QuoteVersion, QuoteSnapshot } from '@/types'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface QuoteVersionModalProps {
  version: QuoteVersion
  leadName: string
  onClose: () => void
  onVersionUpdated: () => void
}

export default function QuoteVersionModal({
  version,
  leadName,
  onClose,
  onVersionUpdated,
}: QuoteVersionModalProps) {
  const [showSendForm, setShowSendForm] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  useEscapeKey([
    { isOpen: showSendForm, isBlocked: sending, onClose: () => setShowSendForm(false) },
    { isOpen: true, isBlocked: false, onClose: onClose },
  ])

  const snapshot = version.snapshot as QuoteSnapshot

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true)
      const response = await fetch(
        `/api/projects/${version.projectId}/quote-versions/${version.id}/pdf`
      )

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
      setDownloadingPdf(false)
    }
  }

  const handleMarkAsSent = async () => {
    if (!sendEmail.trim() || sending) return

    try {
      setSending(true)
      const response = await fetch(
        `/api/projects/${version.projectId}/quote-versions/${version.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentAt: new Date().toISOString(),
            sentTo: sendEmail,
          }),
        }
      )

      if (response.ok) {
        setShowSendForm(false)
        onVersionUpdated()
      } else {
        alert('Failed to update quote status')
      }
    } catch (error) {
      console.error('Error marking quote as sent:', error)
      alert('Failed to update quote status')
    } finally {
      setSending(false)
    }
  }

  const handleDownloadDebugReport = async () => {
    try {
      const response = await fetch(`/api/projects/${version.projectId}/pricing-debug`)

      if (!response.ok) {
        throw new Error('Failed to fetch pricing debug data')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate pricing debug')
      }

      // Build CSV content (same format as QuoteView)
      let csv = ''

      // Header section
      csv += '=== PROJECT PRICING DEBUG ===\n'
      csv += `Project,"${data.project.name}"\n`
      csv += `Status,"${data.project.status}"\n`
      csv += '\n'

      if (data.pricingMode) {
        csv += '=== PRICING MODE ===\n'
        csv += `Name,"${data.pricingMode.name}"\n`
        csv += `Extrusion Markup,${data.pricingMode.extrusionMarkup}%\n`
        csv += `Hardware Markup,${data.pricingMode.hardwareMarkup}%\n`
        csv += `Glass Markup,${data.pricingMode.glassMarkup}%\n`
        csv += `Packaging Markup,${data.pricingMode.packagingMarkup}%\n`
        csv += `Global Markup,${data.pricingMode.globalMarkup}%\n`
        csv += `Discount,${data.pricingMode.discount}%\n`
        csv += `Extrusion Costing,"${data.pricingMode.extrusionCostingMethod}"\n`
        csv += '\n'
      }

      // Process each opening
      for (const opening of data.openings) {
        csv += `=== OPENING: ${opening.name} ===\n`
        csv += `Finish Color,"${opening.finishColor}"\n`
        csv += '\n'

        // Process each component
        for (const component of opening.components) {
          csv += `--- Component: ${component.productName} (Panel ${component.panelId}) ---\n`
          csv += `Dimensions,"${component.dimensions.width}" W x ${component.dimensions.height}" H"\n`
          csv += '\n'

          // BOM Items
          if (component.bomItems.length > 0) {
            csv += 'BOM ITEMS\n'
            csv += 'Part Number,Part Name,Part Type,Quantity,Unit Cost,Total Cost,Method,Details\n'
            for (const bom of component.bomItems) {
              const partNumber = bom.partNumber || ''
              const partName = (bom.partName || '').replace(/"/g, '""')
              const partType = bom.partType || ''
              const quantity = bom.quantity || 1
              const unitCost = bom.unitCost?.toFixed(2) || '0.00'
              const totalCost = bom.totalCost?.toFixed(2) || '0.00'
              const method = bom.method || ''
              const details = (bom.details || '').replace(/"/g, '""')
              csv += `"${partNumber}","${partName}","${partType}",${quantity},$${unitCost},$${totalCost},"${method}","${details}"\n`
            }
            csv += '\n'
          }

          // Option Items
          if (component.optionItems.length > 0) {
            csv += 'OPTION ITEMS\n'
            csv += 'Category,Option Name,Part Number,Quantity,Unit Price,Total Price,Is Standard,Is Included\n'
            for (const opt of component.optionItems) {
              const category = (opt.category || '').replace(/"/g, '""')
              const optName = (opt.optionName || '').replace(/"/g, '""')
              const partNumber = opt.partNumber || ''
              const quantity = opt.quantity || 1
              const unitPrice = opt.unitPrice?.toFixed(2) || '0.00'
              const price = opt.price?.toFixed(2) || '0.00'
              const isStandard = opt.isStandard ? 'Yes' : 'No'
              const isIncluded = opt.isIncluded ? 'Yes' : 'No'
              csv += `"${category}","${optName}","${partNumber}",${quantity},$${unitPrice},$${price},${isStandard},${isIncluded}\n`
            }
            csv += '\n'
          }

          // Glass Item
          if (component.glassItem) {
            const g = component.glassItem
            csv += 'GLASS\n'
            csv += 'Glass Type,Width Formula,Height Formula,Calc Width,Calc Height,Qty,Sqft,Price/Sqft,Total Cost\n'
            csv += `"${g.glassType}","${g.widthFormula}","${g.heightFormula}",${g.calculatedWidth?.toFixed(3)},${g.calculatedHeight?.toFixed(3)},${g.quantity},${g.sqft},$${g.pricePerSqFt?.toFixed(2)},$${g.totalCost?.toFixed(2)}\n`
            csv += '\n'
          }

          csv += `Component BOM Total,$${component.totalBOMCost?.toFixed(2)}\n`
          csv += `Component Options Total,$${component.totalOptionCost?.toFixed(2)}\n`
          csv += `Component Glass Total,$${component.totalGlassCost?.toFixed(2)}\n`
          csv += '\n'
        }

        // Cost Summary
        csv += '--- OPENING COST SUMMARY ---\n'
        csv += 'Category,Base Cost,Markup %,Marked Up Cost\n'
        csv += `Extrusion,$${opening.costSummary.extrusion.base?.toFixed(2)},${opening.costSummary.extrusion.markup}%,$${opening.costSummary.extrusion.markedUp?.toFixed(2)}\n`
        csv += `Hardware,$${opening.costSummary.hardware.base?.toFixed(2)},${opening.costSummary.hardware.markup}%,$${opening.costSummary.hardware.markedUp?.toFixed(2)}\n`
        csv += `Glass,$${opening.costSummary.glass.base?.toFixed(2)},${opening.costSummary.glass.markup}%,$${opening.costSummary.glass.markedUp?.toFixed(2)}\n`
        csv += `Packaging,$${opening.costSummary.packaging.base?.toFixed(2)},${opening.costSummary.packaging.markup}%,$${opening.costSummary.packaging.markedUp?.toFixed(2)}\n`
        csv += `Other,$${opening.costSummary.other.base?.toFixed(2)},${opening.costSummary.other.markup}%,$${opening.costSummary.other.markedUp?.toFixed(2)}\n`
        csv += `Standard Options (no markup),$${opening.costSummary.standardOptions.base?.toFixed(2)},0%,$${opening.costSummary.standardOptions.markedUp?.toFixed(2)}\n`
        csv += `Hybrid Remaining (no markup),$${opening.costSummary.hybridRemaining.base?.toFixed(2)},0%,$${opening.costSummary.hybridRemaining.markedUp?.toFixed(2)}\n`
        csv += '\n'
        csv += `Opening Total (Base),$${opening.totalBaseCost?.toFixed(2)}\n`
        csv += `Opening Total (Marked Up),$${opening.totalMarkedUpCost?.toFixed(2)}\n`
        csv += '\n\n'
      }

      // Project totals
      csv += '=== PROJECT TOTALS ===\n'
      csv += `Subtotal (Base),$${data.totals.subtotalBase?.toFixed(2)}\n`
      csv += `Subtotal (Marked Up),$${data.totals.subtotalMarkedUp?.toFixed(2)}\n`
      csv += `Installation,$${data.totals.installation?.toFixed(2)}\n`
      csv += `Tax Rate,${(data.totals.taxRate * 100).toFixed(1)}%\n`
      csv += `Tax Amount,$${data.totals.taxAmount?.toFixed(2)}\n`
      csv += `Grand Total,$${data.totals.grandTotal?.toFixed(2)}\n`

      // Create download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `PricingDebug_${leadName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating pricing debug:', error)
      alert('Failed to download pricing debug')
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-lg font-semibold rounded">
                v{version.version}
              </span>
              <h2 className="text-xl font-semibold text-gray-900">{leadName}</h2>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Created: {formatDate(version.createdAt)}
              </span>
              {version.createdBy && <span>by {version.createdBy}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Sent Status Banner */}
          {version.sentAt && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <Send className="w-5 h-5" />
              <span>
                Sent to <strong>{version.sentTo}</strong> on{' '}
                {formatDate(version.sentAt)}
              </span>
            </div>
          )}

          {/* Price Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Price Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500 block">Subtotal</span>
                <span className="text-lg font-medium text-gray-900">
                  {formatPrice(version.subtotal)}
                </span>
              </div>
              {version.markupAmount > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block">Markup</span>
                  <span className="text-lg font-medium text-gray-900">
                    +{formatPrice(version.markupAmount)}
                  </span>
                </div>
              )}
              {version.discountAmount > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block">Discount</span>
                  <span className="text-lg font-medium text-red-600">
                    -{formatPrice(version.discountAmount)}
                  </span>
                </div>
              )}
              {version.installationCost > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block">Installation</span>
                  <span className="text-lg font-medium text-gray-900">
                    {formatPrice(version.installationCost)}
                  </span>
                </div>
              )}
              {version.taxAmount > 0 && (
                <div>
                  <span className="text-sm text-gray-500 block">
                    Tax ({(version.taxRate * 100).toFixed(1)}%)
                  </span>
                  <span className="text-lg font-medium text-gray-900">
                    {formatPrice(version.taxAmount)}
                  </span>
                </div>
              )}
              <div className="col-span-2 md:col-span-4 pt-3 border-t border-gray-200">
                <span className="text-sm text-gray-500 block">Total</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(version.totalPrice)}
                </span>
              </div>
            </div>
            {version.pricingModeName && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">Pricing Mode: </span>
                <span className="text-sm font-medium text-gray-700">
                  {version.pricingModeName}
                </span>
              </div>
            )}
          </div>

          {/* Change Notes */}
          {version.changeNotes && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h4 className="text-sm font-medium text-amber-800 mb-1">
                Changes from previous version:
              </h4>
              <p className="text-sm text-amber-700">{version.changeNotes}</p>
            </div>
          )}

          {/* Openings Snapshot */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" />
              Openings at time of quote
            </h3>
            {snapshot?.quoteItems && snapshot.quoteItems.length > 0 ? (
              <div className="space-y-3">
                {snapshot.quoteItems.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="p-4 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.dimensions}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {item.description}
                        </p>
                        {item.color && item.color !== 'Standard' && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 rounded">
                            {item.color}
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPrice(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : snapshot?.openings && snapshot.openings.length > 0 ? (
              <div className="space-y-3">
                {snapshot.openings.map((opening: any, index: number) => (
                  <div
                    key={index}
                    className="p-4 bg-white border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{opening.name}</h4>
                        <p className="text-sm text-gray-500">{opening.dimensions}</p>
                        {opening.panels && opening.panels.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            {opening.panels.length} panel{opening.panels.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPrice(opening.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No opening data available in snapshot
              </p>
            )}

            {/* Debug Report Download */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleDownloadDebugReport}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                <FileJson className="w-4 h-4" />
                Download Debug Report
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {downloadingPdf ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </button>
            {!version.sentAt && (
              <button
                onClick={() => setShowSendForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Mark as Sent
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Send Form Modal */}
      {showSendForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Mark Quote as Sent
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="customer@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSendForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsSent}
                disabled={!sendEmail.trim() || sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {sending ? 'Saving...' : 'Mark as Sent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

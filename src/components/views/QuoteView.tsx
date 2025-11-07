'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Download, FileText, Printer, Ruler, Palette, Eye, Wrench, DollarSign, Paperclip } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { ToastContainer } from '../ui/Toast'
import { useToast } from '../../hooks/useToast'
import QuoteAttachmentsManager from '../quote/QuoteAttachmentsManager'

interface QuoteItem {
  openingId: number
  name: string
  description: string
  dimensions: string
  color: string
  hardware: string
  hardwarePrice: number
  glassType: string
  costPrice: number // Internal cost (not shown to customer)
  price: number // Customer-facing marked-up price
  elevationImages: string[]
}

interface QuoteData {
  project: {
    id: number
    name: string
    status: string
    createdAt: string
    updatedAt: string
    installationMethod: 'MANUAL' | 'PER_PRODUCT_TOTAL'
    installationComplexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'VERY_COMPLEX'
    manualInstallationCost: number
    pricingMode?: {
      name: string
      markup: number
      discount: number
    } | null
  }
  quoteItems: QuoteItem[]
  subtotal: number
  markupAmount: number
  discountAmount: number
  adjustedSubtotal: number
  installationCost: number
  taxRate: number
  taxAmount: number
  totalPrice: number
}

export default function QuoteView() {
  const { selectedProjectId, setSelectedProjectId, setCurrentMenu } = useAppStore()
  const { toasts, removeToast, showSuccess, showError } = useToast()
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const quoteRef = useRef<HTMLDivElement>(null)

  // Installation state
  const [installationMethod, setInstallationMethod] = useState<'MANUAL' | 'PER_PRODUCT_TOTAL'>('MANUAL')
  const [installationComplexity, setInstallationComplexity] = useState<'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'VERY_COMPLEX'>('STANDARD')
  const [manualInstallationCost, setManualInstallationCost] = useState<number>(0)

  useEffect(() => {
    if (selectedProjectId) {
      fetchQuoteData()
    }
  }, [selectedProjectId])

  // Initialize installation state from quote data
  useEffect(() => {
    if (quoteData?.project) {
      setInstallationMethod(quoteData.project.installationMethod)
      setInstallationComplexity(quoteData.project.installationComplexity)
      setManualInstallationCost(quoteData.project.manualInstallationCost)
    }
  }, [quoteData])

  const fetchQuoteData = async () => {
    if (!selectedProjectId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${selectedProjectId}/quote`)

      if (!response.ok) {
        throw new Error('Failed to generate quote')
      }

      const data = await response.json()

      if (data.success) {
        setQuoteData(data)
      } else {
        showError(data.error || 'Failed to generate quote')
      }
    } catch (error) {
      console.error('Error fetching quote:', error)
      showError('Error generating quote')
    } finally {
      setLoading(false)
    }
  }

  const updateProjectInstallation = async (
    method: 'MANUAL' | 'PER_PRODUCT_TOTAL',
    complexity: 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'VERY_COMPLEX',
    manualCost: number
  ) => {
    if (!selectedProjectId || !quoteData) return

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: quoteData.project.name,
          status: quoteData.project.status,
          installationMethod: method,
          installationComplexity: complexity,
          manualInstallationCost: manualCost,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update installation settings')
      }

      // Refresh quote to show updated installation cost
      await fetchQuoteData()
      showSuccess('Installation settings updated')
    } catch (error) {
      console.error('Error updating installation:', error)
      showError('Failed to update installation settings')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownload = async () => {
    if (!quoteData) return

    try {
      setIsDownloading(true)

      // Use the new server-side PDF generation API
      const response = await fetch(`/api/projects/${selectedProjectId}/quote/pdf`)

      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Quote_${quoteData.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      showSuccess('Quote downloaded successfully!')

    } catch (error) {
      console.error('Error generating PDF:', error)
      showError('Failed to download quote')
    } finally {
      setIsDownloading(false)
    }
  }

  const getColorPill = (color: string) => {
    const colorMap: { [key: string]: string } = {
      'black': 'bg-black text-white',
      'white': 'bg-white text-black border border-gray-300',
      'brown': 'bg-amber-800 text-white',
      'bronze': 'bg-amber-700 text-white',
      'silver': 'bg-gray-400 text-white',
      'gray': 'bg-gray-500 text-white',
      'grey': 'bg-gray-500 text-white',
      'gold': 'bg-yellow-500 text-white',
      'red': 'bg-red-500 text-white',
      'blue': 'bg-blue-500 text-white',
      'green': 'bg-green-500 text-white',
    }
    
    const lowerColor = color.toLowerCase()
    const colorClass = colorMap[lowerColor] || 'bg-gray-200 text-gray-800'
    
    return (
      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {color}
      </span>
    )
  }

  if (!selectedProjectId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No project selected</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!quoteData) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Failed to generate quote</p>
        <button
          onClick={() => {
            setCurrentMenu('projects')
          }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentMenu('projects')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Quote - {quoteData.project.name}
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isDownloading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Installation Settings */}
      <div className="mb-6 print:hidden">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Wrench className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Installation Settings</h2>
          </div>

          <div className="space-y-4">
            {/* Installation Method Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calculation Method
              </label>
              <select
                value={installationMethod}
                onChange={(e) => {
                  const method = e.target.value as 'MANUAL' | 'PER_PRODUCT_TOTAL'
                  setInstallationMethod(method)
                  updateProjectInstallation(method, installationComplexity, manualInstallationCost)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MANUAL">Manual - Enter Fixed Amount</option>
                <option value="PER_PRODUCT_TOTAL">Per Product Total - Auto-Calculate from Products</option>
              </select>
            </div>

            {/* Conditional Inputs */}
            {installationMethod === 'MANUAL' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Installation Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualInstallationCost}
                    onChange={(e) => {
                      const cost = parseFloat(e.target.value) || 0
                      setManualInstallationCost(cost)
                    }}
                    onBlur={() => {
                      updateProjectInstallation(installationMethod, installationComplexity, manualInstallationCost)
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Installation Complexity
                </label>
                <select
                  value={installationComplexity}
                  onChange={(e) => {
                    const complexity = e.target.value as 'SIMPLE' | 'STANDARD' | 'COMPLEX' | 'VERY_COMPLEX'
                    setInstallationComplexity(complexity)
                    updateProjectInstallation(installationMethod, complexity, manualInstallationCost)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SIMPLE">Simple (0.9x multiplier)</option>
                  <option value="STANDARD">Standard (1.0x multiplier)</option>
                  <option value="COMPLEX">Complex (1.25x multiplier)</option>
                  <option value="VERY_COMPLEX">Very Complex (1.5x multiplier)</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Automatically calculates installation based on product installation prices and complexity.
                </p>
              </div>
            )}

            {/* Current Installation Cost Display */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Current Installation Cost:</span>
                <span className="text-xl font-semibold text-gray-900">
                  ${quoteData.installationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quote Attachments Manager */}
      <div className="mb-6 print:hidden">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <QuoteAttachmentsManager projectId={quoteData.project.id} />
        </div>
      </div>

      {/* Quote Content */}
      <div ref={quoteRef} className="bg-white border border-gray-200 rounded-lg shadow-sm print:shadow-none print:border-0">
        {/* Quote Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-light text-gray-900 mb-6">Project Quote</h1>
              <div className="space-y-3">
                <div className="flex items-center space-x-8">
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Project</span>
                    <p className="text-lg text-gray-900 mt-1">{quoteData.project.name}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</span>
                    <p className="text-lg text-gray-900 mt-1">{quoteData.project.status}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Created</span>
                    <p className="text-lg text-gray-900 mt-1">{new Date(quoteData.project.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Openings</span>
                  <p className="text-xl font-semibold text-gray-900 mt-1">{quoteData.quoteItems.length}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Valid Until</span>
                  <p className="text-lg text-gray-900 mt-1">{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Items - Table Style */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-black">
                <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide text-xs border-r border-gray-400 align-middle">Elevation</th>
                <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide text-xs border-r border-gray-400 align-middle">Opening</th>
                <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide text-xs border-r border-gray-400 align-middle">Specs</th>
                <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide text-xs border-r border-gray-400 align-middle">Hardware</th>
                <th className="text-center py-4 px-6 font-bold text-white uppercase tracking-wide text-xs align-middle">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quoteData.quoteItems.map((item, index) => (
                <tr key={item.openingId} className="hover:bg-gray-50 transition-colors">
                  {/* Elevation Thumbnails - All Panels Side by Side */}
                  <td className="py-6 px-6 w-56 border-r border-gray-200">
                    {item.elevationImages && item.elevationImages.length > 0 ? (
                      <div className="flex items-center justify-center h-40">
                        {item.elevationImages.map((elevationImage, imgIndex) => (
                          <div key={imgIndex} className="flex-1 h-full flex items-center justify-center">
                            <img
                              src={elevationImage.startsWith('data:') ? elevationImage : `data:image/png;base64,${elevationImage}`}
                              alt={`Opening ${item.name} panel ${imgIndex + 1}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-40">
                        <FileText className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </td>

                  {/* Opening Details */}
                  <td className="py-6 px-6 min-w-0 border-r border-gray-200">
                    <div className="space-y-3">
                      {/* Opening name and color pill for screen */}
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-gray-900">
                          {item.name}
                        </h3>
                        <span className="print:hidden">
                          {getColorPill(item.color)}
                        </span>
                      </div>
                      
                      {/* Description */}
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </td>

                  {/* Specifications */}
                  <td className="py-6 px-6 min-w-0 border-r border-gray-200">
                    <div className="space-y-1 text-sm">
                      <div className="whitespace-nowrap">
                        <span className="font-medium text-gray-500 uppercase tracking-wide">DIMENSIONS </span>
                        <span className="font-medium text-gray-900">{item.dimensions}</span>
                      </div>
                      <div className="whitespace-nowrap">
                        <span className="font-medium text-gray-500 uppercase tracking-wide">COLOR </span>
                        <span className="font-medium text-gray-900">{item.color.toUpperCase()}</span>
                      </div>
                      <div className="whitespace-nowrap">
                        <span className="font-medium text-gray-500 uppercase tracking-wide">GLASS </span>
                        <span className="font-medium text-gray-900">{item.glassType.toUpperCase()}</span>
                      </div>
                    </div>
                  </td>

                  {/* Hardware */}
                  <td className="py-6 px-6 min-w-0 border-r border-gray-200">
                    {item.hardware && item.hardware !== 'Standard' ? (
                      <div className="space-y-1">
                        {item.hardware.split(' • ').map((hardwareItem, index) => (
                          <div key={index} className="text-sm whitespace-nowrap text-gray-700">
                            • {hardwareItem}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        <span>Standard Hardware</span>
                      </div>
                    )}
                  </td>

                  {/* Price */}
                  <td className="py-6 px-6 text-right">
                    <div className="text-xl font-semibold text-gray-900">
                      ${item.price.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quote Footer */}
        <div className="p-8 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-start">
            <div className="text-gray-600">
              <p className="text-lg">This quote includes {quoteData.quoteItems.length} opening{quoteData.quoteItems.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="text-right space-y-3">
              {/* Subtotal (after markup/discount applied) */}
              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Subtotal (Openings)</span>
                <span className="text-xl text-gray-900">
                  ${quoteData.adjustedSubtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>

              {/* Installation - always show */}
              <div className="flex justify-between items-center gap-8">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Installation</span>
                <span className="text-xl text-gray-900">
                  ${quoteData.installationCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>

              {/* Tax - only show if not 0 */}
              {quoteData.taxRate > 0 && (
                <div className="flex justify-between items-center gap-8">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Tax ({(quoteData.taxRate * 100).toFixed(1)}%)
                  </span>
                  <span className="text-xl text-gray-900">
                    ${quoteData.taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              )}

              {/* Total */}
              <div className="pt-3 border-t border-gray-300">
                <div className="flex justify-between items-center gap-8">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Project Cost</span>
                  <span className="text-4xl font-light text-gray-900">
                    ${quoteData.totalPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
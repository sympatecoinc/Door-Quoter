'use client'

import { useState, useEffect } from 'react'
import { X, Download, FileText, Eye } from 'lucide-react'
import { processParametricSVG, svgToDataUrl } from '@/lib/parametric-svg'

interface DrawingData {
  elevation_image?: string
  plan_image?: string
  elevationImages?: Array<{
    productName: string
    imageData: string
    fileName?: string
    width: number
    height: number
  }>
  planViews?: Array<{
    productName: string
    planViewName: string
    imageData: string
    fileName?: string
    width: number
    height: number
  }>
  door_schedule?: {
    headers: string[]
    rows: string[][]
  }
  total_width?: number
  height?: number
}

interface DrawingViewerProps {
  openingId: number
  openingNumber: string
  isOpen: boolean
  onClose: () => void
}

export default function DrawingViewer({ openingId, openingNumber, isOpen, onClose }: DrawingViewerProps) {
  const [activeTab, setActiveTab] = useState<'elevation' | 'plan' | 'schedule'>('elevation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawingData, setDrawingData] = useState<DrawingData | null>(null)
  const [lastOpeningId, setLastOpeningId] = useState<number | null>(null)
  const [selectedElevationIndex, setSelectedElevationIndex] = useState(0)
  const [selectedPlanViewIndex, setSelectedPlanViewIndex] = useState(0)

  const generateElevationDrawing = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/drawings/elevation/${openingId}`)
      if (!response.ok) {
        throw new Error('Failed to generate elevation drawing')
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate drawing')
      }
      setDrawingData(prev => ({ ...prev, ...data }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const generatePlanDrawing = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/drawings/plan/${openingId}`)
      if (!response.ok) {
        throw new Error('Failed to generate plan drawing')
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate drawing')
      }
      setDrawingData(prev => ({ ...prev, ...data }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = (imageData: string, filename: string) => {
    const link = document.createElement('a')
    link.href = `data:image/png;base64,${imageData}`
    link.download = filename
    link.click()
  }

  // Process SVG image with parametric scaling - only for SVG files
  const processImage = (imageData: string, fileName: string | undefined, width: number, height: number, mode: 'elevation' | 'plan' = 'elevation') => {
    try {
      console.log('=== Processing Image ===')
      console.log('Filename:', fileName)
      console.log('Dimensions:', width, 'x', height)
      console.log('Mode:', mode)
      console.log('Data length:', imageData.length)
      console.log('Data prefix:', imageData.substring(0, 50))

      // Check if this is an SVG file by filename extension
      const isSvgFile = fileName?.toLowerCase().endsWith('.svg')

      if (!isSvgFile) {
        console.log('→ Not an SVG file (based on filename), skipping parametric scaling')
        return imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`
      }

      console.log('→ SVG file detected, attempting parametric scaling')

      let svgString = ''

      // Decode the SVG data
      if (imageData.startsWith('data:image/svg+xml')) {
        // Data URI SVG - check if it's base64 or url-encoded
        const parts = imageData.split(',')
        const dataContent = parts[1]

        // Check if it's base64 encoded (indicated in the data URI)
        if (parts[0].includes('base64')) {
          svgString = atob(dataContent)
          console.log('→ Decoded from data:image/svg+xml;base64 URI')
        } else {
          svgString = decodeURIComponent(dataContent)
          console.log('→ Decoded from data:image/svg+xml URI (URL encoded)')
        }
      } else if (imageData.startsWith('data:')) {
        // Should not happen for SVG files, but handle it
        console.warn('→ SVG file has non-SVG data URI, skipping')
        return imageData
      } else {
        // Base64 encoded SVG - may be double-encoded
        try {
          svgString = atob(imageData)
          console.log('→ Decoded from base64 (first pass)')
          console.log('→ First decode result starts with:', svgString.substring(0, 50))

          // Check if it's still base64 encoded (double encoding)
          if (!svgString.includes('<') && /^[A-Za-z0-9+/=]+$/.test(svgString.substring(0, 100))) {
            console.log('→ Detected double base64 encoding, decoding again')
            svgString = atob(svgString)
            console.log('→ Second decode result starts with:', svgString.substring(0, 50))
          }
        } catch (e) {
          console.error('→ Failed to decode base64:', e)
          return `data:image/svg+xml;base64,${imageData}`
        }
      }

      // Trim whitespace and check for SVG content
      svgString = svgString.trim()

      // Check if it's valid SVG (can have XML declaration or start with <svg)
      const hasSvgTag = svgString.includes('<svg')
      const hasXmlDeclaration = svgString.startsWith('<?xml')

      if (!hasSvgTag && !hasXmlDeclaration) {
        console.error('→ Decoded data does not contain <svg> tag or XML declaration')
        console.log('→ Content preview:', svgString.substring(0, 500))
        console.log('→ Content type check - starts with:', svgString.substring(0, 20))
        return imageData.startsWith('data:') ? imageData : `data:image/svg+xml;base64,${imageData}`
      }

      if (!hasSvgTag) {
        console.error('→ Has XML declaration but no <svg> tag found')
        console.log('→ Full content:', svgString)
        return imageData.startsWith('data:') ? imageData : `data:image/svg+xml;base64,${imageData}`
      }

      console.log('→ Valid SVG content found')
      console.log('→ SVG preview:', svgString.substring(0, 300))

      // Apply parametric scaling
      // The SVG viewBox is in arbitrary units (pixels from design software)
      // We need to extract the original viewBox and scale proportionally
      const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
      let targetWidth = width
      let targetHeight = height

      if (viewBoxMatch) {
        const viewBoxValues = viewBoxMatch[1].split(/\s+/)
        const origWidth = parseFloat(viewBoxValues[2])
        const origHeight = parseFloat(viewBoxValues[3])

        console.log('→ Original SVG viewBox dimensions:', origWidth, 'x', origHeight)

        // Assume the original SVG represents a standard door size (e.g., 36" x 96")
        // Scale the viewBox dimensions proportionally based on the panel dimensions
        const widthRatio = width / 36  // Assuming 36" is standard width
        const heightRatio = height / 96 // Assuming 96" is standard height

        targetWidth = origWidth * widthRatio
        targetHeight = origHeight * heightRatio

        console.log('→ Width ratio:', widthRatio, 'Height ratio:', heightRatio)
        console.log('→ Scaled target dimensions:', targetWidth, 'x', targetHeight)
      }

      console.log('→ Calling processParametricSVG with target dimensions:', targetWidth, 'x', targetHeight)
      const { scaledSVG, scaling, transforms } = processParametricSVG(svgString, { width: targetWidth, height: targetHeight }, mode)

      console.log('→ Parametric scaling applied successfully')
      console.log('→ Scale factors: X =', scaling.scaleX, ', Y =', scaling.scaleY)
      console.log('→ Elements processed:', transforms.length)
      console.log('→ Element types detected:', transforms.map(t => `${t.elementId || 'unnamed'}: ${t.elementType}`))
      console.log('→ Scaled SVG preview:', scaledSVG.substring(0, 500))

      const result = svgToDataUrl(scaledSVG)
      console.log('→ Converted to data URL, length:', result.length)
      console.log('=== Processing Complete ===')

      return result
    } catch (error) {
      console.error('!!! Error processing image:', error)
      console.error('Stack:', (error as Error).stack)
      // Fallback to original image
      return imageData.startsWith('data:') ? imageData : `data:image/svg+xml;base64,${imageData}`
    }
  }

  const handleTabChange = (tab: 'elevation' | 'plan' | 'schedule') => {
    setActiveTab(tab)
    if (tab === 'elevation' && !drawingData?.elevation_image && !drawingData?.elevationImages) {
      generateElevationDrawing()
    } else if (tab === 'plan' && !drawingData?.plan_image && !drawingData?.planViews) {
      generatePlanDrawing()
    }
  }

  // Clear cache when opening ID changes (direction updated)
  useEffect(() => {
    if (isOpen && openingId !== lastOpeningId) {
      setDrawingData(null)
      setLastOpeningId(openingId)
      setActiveTab('elevation')
      setSelectedElevationIndex(0)
      setSelectedPlanViewIndex(0)
      generateElevationDrawing()
    } else if (isOpen && !drawingData?.elevation_image && !drawingData?.elevationImages) {
      generateElevationDrawing()
    }
  }, [isOpen, openingId, lastOpeningId, drawingData?.elevation_image, drawingData?.elevationImages])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Shop Drawings - Opening {openingNumber}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => handleTabChange('elevation')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'elevation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 mr-2 inline" />
            Elevation View
          </button>
          <button
            onClick={() => handleTabChange('plan')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plan'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-4 h-4 mr-2 inline" />
            Plan View
          </button>
          <button
            onClick={() => handleTabChange('schedule')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 mr-2 inline" />
            Door Schedule
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating drawing...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="text-lg font-medium mb-2">Error</p>
                <p>{error}</p>
                <button
                  onClick={() => {
                    if (activeTab === 'elevation') generateElevationDrawing()
                    else if (activeTab === 'plan') generatePlanDrawing()
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Elevation Tab */}
              {activeTab === 'elevation' && (drawingData?.elevation_image || drawingData?.elevationImages) && (
                <div className="space-y-4">
                  {/* Product-based elevation images */}
                  {drawingData.elevationImages && drawingData.elevationImages.length > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium">Elevation View</h3>
                          <p className="text-sm text-gray-600">
                            {drawingData.elevationImages.length} component{drawingData.elevationImages.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Download all images as a single combined view would require canvas manipulation
                            // For now, download first image
                            downloadImage(
                              drawingData.elevationImages![0].imageData,
                              `opening-${openingNumber}-elevation.png`
                            )
                          }}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>

                      {/* Display all elevation images seamlessly side by side */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
                        <div className="flex items-end justify-center" style={{ minHeight: '400px' }}>
                          {drawingData.elevationImages.map((img, index) => {
                            // Apply parametric scaling to SVG images based on panel dimensions
                            const imageSrc = processImage(img.imageData, img.fileName, img.width, img.height, 'elevation')

                            return (
                              <img
                                key={index}
                                src={imageSrc}
                                alt={`${img.productName}`}
                                className="h-auto"
                                style={{ maxHeight: '400px', display: 'block' }}
                                onError={(e) => {
                                  console.error('Image load error for:', img.productName)
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {drawingData.elevationImages.map(img => img.productName).join(' + ')}
                      </div>
                    </>
                  )}

                  {/* Legacy generated elevation drawing */}
                  {drawingData.elevation_image && !drawingData.elevationImages && (
                    <>
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Elevation Drawing</h3>
                        <button
                          onClick={() => downloadImage(drawingData.elevation_image!, `opening-${openingNumber}-elevation.png`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <img
                          src={`data:image/png;base64,${drawingData.elevation_image}`}
                          alt="Elevation Drawing"
                          className="w-full h-auto max-h-96 object-contain"
                        />
                      </div>
                      {drawingData.total_width && drawingData.height && (
                        <div className="text-sm text-gray-600">
                          Overall dimensions: {drawingData.total_width}" W × {drawingData.height}" H
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Plan Tab */}
              {activeTab === 'plan' && (drawingData?.plan_image || drawingData?.planViews) && (
                <div className="space-y-4">
                  {/* Product-based plan views */}
                  {drawingData.planViews && drawingData.planViews.length > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-medium">Plan View</h3>
                          <p className="text-sm text-gray-600">
                            {drawingData.planViews.length} component{drawingData.planViews.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            downloadImage(
                              drawingData.planViews![0].imageData,
                              `opening-${openingNumber}-plan.png`
                            )
                          }}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>

                      {/* Display all plan views seamlessly side by side */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
                        <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                          {drawingData.planViews.map((view, index) => {
                            // Apply parametric scaling to SVG images based on panel dimensions
                            const imageSrc = processImage(view.imageData, view.fileName, view.width, view.height, 'plan')

                            return (
                              <img
                                key={index}
                                src={imageSrc}
                                alt={`${view.productName} - ${view.planViewName}`}
                                className="h-auto"
                                style={{ maxHeight: '400px', display: 'block' }}
                                onError={(e) => {
                                  console.error('Image load error for:', view.productName, view.planViewName)
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {drawingData.planViews.map(v => `${v.productName} (${v.planViewName})`).join(' + ')}
                      </div>
                    </>
                  )}

                  {/* Legacy generated plan view */}
                  {drawingData.plan_image && !drawingData.planViews && (
                    <>
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">Plan View</h3>
                        <button
                          onClick={() => downloadImage(drawingData.plan_image!, `opening-${openingNumber}-plan.png`)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </button>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <img
                          src={`data:image/png;base64,${drawingData.plan_image}`}
                          alt="Plan View Drawing"
                          className="w-full h-auto max-h-96 object-contain"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Plan Tab Error */}
              {activeTab === 'plan' && !drawingData?.plan_image && !drawingData?.planViews && !loading && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">Plan view is available for openings with swing or sliding doors.</p>
                  <button
                    onClick={generatePlanDrawing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate Plan View
                  </button>
                </div>
              )}

              {/* Schedule Tab */}
              {activeTab === 'schedule' && drawingData?.door_schedule && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Door Schedule</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          {drawingData.door_schedule.headers.map((header, index) => (
                            <th
                              key={index}
                              className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b border-gray-300"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drawingData.door_schedule.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-200">
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-4 py-2 text-sm text-gray-900"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
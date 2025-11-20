'use client'

import { useState, useEffect } from 'react'
import { X, FileText, Eye, FileDown } from 'lucide-react'

interface DrawingData {
  elevation_image?: string
  plan_image?: string
  elevationImages?: Array<{
    productName: string
    imageData: string
    fileName?: string
    width: number
    height: number
    productType: string
    swingDirection?: string
    slidingDirection?: string
    isCorner: boolean
    cornerDirection?: string
  }>
  planViews?: Array<{
    productName: string
    planViewName: string
    imageData: string
    fileName?: string
    fileType?: string
    orientation?: string
    width: number
    height: number
    productType: string
    cornerDirection?: string
    isCorner: boolean
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
  const [isExportingPdf, setIsExportingPdf] = useState(false)

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

  const exportToPdf = async () => {
    setIsExportingPdf(true)
    setError(null)
    try {
      const response = await fetch(`/api/drawings/pdf/${openingId}`)
      if (!response.ok) {
        throw new Error('Failed to generate PDF')
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Opening_${openingNumber}_Shop_Drawings.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Simple image data URL converter
  // SVG processing now happens server-side (SHOPGEN approach)
  const getImageDataUrl = (imageData: string) => {
    // If already a data URL, return as-is
    if (imageData.startsWith('data:')) {
      return imageData
    }
    // Otherwise, treat as base64 PNG
    return `data:image/png;base64,${imageData}`
  }

  const handleTabChange = (tab: 'elevation' | 'plan' | 'schedule') => {
    setActiveTab(tab)
    if (tab === 'elevation' && !drawingData?.elevation_image && !drawingData?.elevationImages) {
      generateElevationDrawing()
    } else if ((tab === 'plan' || tab === 'schedule') && !drawingData?.plan_image && !drawingData?.planViews) {
      // Plan API also returns door schedule data
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
          <div className="flex items-center gap-2">
            <button
              onClick={exportToPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExportingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Export PDF</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
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
                      <div className="mb-4">
                        <h3 className="text-lg font-medium">Elevation View</h3>
                        <p className="text-sm text-gray-600">
                          {drawingData.elevationImages.length} component{drawingData.elevationImages.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Display elevation images with row breaks at corners */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
                        <div className="space-y-6">
                          {(() => {
                            // Split images into rows based on corners
                            const rows: typeof drawingData.elevationImages[] = []
                            let currentRow: typeof drawingData.elevationImages = []

                            drawingData.elevationImages.forEach((img, index) => {
                              // If this is a corner, end the current row and start a new one
                              if (img.productType === 'CORNER_90' && currentRow.length > 0) {
                                rows.push(currentRow)
                                currentRow = [img]
                              } else {
                                currentRow.push(img)
                              }
                            })

                            // Push the last row
                            if (currentRow.length > 0) {
                              rows.push(currentRow)
                            }

                            return rows.map((row, rowIndex) => (
                              <div key={rowIndex} className="flex items-center justify-center" style={{ minHeight: '400px' }}>
                                {row.map((img, imgIndex) => {
                                  // Server-side rendering handles all SVG processing (SHOPGEN approach)
                                  const imageSrc = getImageDataUrl(img.imageData)

                                  // Calculate display size maintaining aspect ratio
                                  // Use a fixed scale factor so all panels render at the same scale
                                  const pixelsPerInch = 4  // Fixed scale for all panels
                                  const displayHeight = img.height * pixelsPerInch
                                  const displayWidth = img.width * pixelsPerInch

                                  // Skip rendering corners in elevation view (they don't have visual representation)
                                  if (img.productType === 'CORNER_90') {
                                    return null
                                  }

                                  return (
                                    <img
                                      key={imgIndex}
                                      src={imageSrc}
                                      alt={`${img.productName} (${img.width}" × ${img.height}")`}
                                      className="h-auto"
                                      style={{
                                        height: `${displayHeight}px`,
                                        width: `${displayWidth}px`,
                                        display: 'block'
                                      }}
                                      onError={(e) => {
                                        console.error('Image load error for:', img.productName)
                                      }}
                                    />
                                  )
                                })}
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        {drawingData.elevationImages.map(img => {
                          // Build component label with direction prefix if applicable
                          let label = ''

                          // Add direction prefix
                          if (img.productType === 'SWING_DOOR' && img.swingDirection) {
                            label = `${img.swingDirection} ${img.productName}`
                          } else if (img.productType === 'SLIDING_DOOR' && img.slidingDirection) {
                            label = `${img.slidingDirection} ${img.productName}`
                          } else {
                            label = img.productName
                          }

                          // Add dimensions
                          label += ` (${img.width}" x ${img.height}")`

                          return label
                        }).join(' + ')}
                      </div>
                    </>
                  )}

                  {/* Legacy generated elevation drawing */}
                  {drawingData.elevation_image && !drawingData.elevationImages && (
                    <>
                      <h3 className="text-lg font-medium mb-4">Elevation Drawing</h3>
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
                      <div className="mb-4">
                        <h3 className="text-lg font-medium">Plan View</h3>
                        <p className="text-sm text-gray-600">
                          {drawingData.planViews.length} component{drawingData.planViews.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Display plan views with directional changes at corners */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200 overflow-x-auto">
                        <div className="flex justify-center w-full" style={{ minHeight: '600px', position: 'relative' }}>
                          {(() => {
                            // Build segments: horizontal until corner, then vertical based on corner direction
                            const segments: Array<{
                              views: typeof drawingData.planViews
                              direction: 'horizontal' | 'vertical-up' | 'vertical-down'
                            }> = []

                            let currentSegment: typeof drawingData.planViews = []
                            let currentDirection: 'horizontal' | 'vertical-up' | 'vertical-down' = 'horizontal'

                            drawingData.planViews.forEach((view, index) => {
                              console.log(`Plan view ${index}: ${view.productName}, isCorner: ${view.isCorner}, productType: ${view.productType}`)

                              if (view.isCorner && view.productType === 'CORNER_90') {
                                console.log(`  ⟲ CORNER DETECTED! Direction: ${view.cornerDirection}`)
                                // Push current segment before corner
                                if (currentSegment.length > 0) {
                                  console.log(`  → Ending segment with ${currentSegment.length} views, direction: ${currentDirection}`)
                                  segments.push({ views: currentSegment, direction: currentDirection })
                                  currentSegment = []
                                }
                                // Change direction based on corner
                                currentDirection = view.cornerDirection === 'Down' ? 'vertical-down' : 'vertical-up'
                                console.log(`  → New direction: ${currentDirection}`)
                              } else {
                                currentSegment.push(view)
                              }
                            })

                            // Push last segment
                            if (currentSegment.length > 0) {
                              segments.push({ views: currentSegment, direction: currentDirection })
                            }

                            console.log(`Total segments: ${segments.length}`)
                            segments.forEach((seg, i) => {
                              console.log(`  Segment ${i}: ${seg.views.length} views, direction: ${seg.direction}`)
                            })

                            // First pass: calculate all positions and bounding box
                            const pixelsPerInch = 4
                            let cumulativeX = 0
                            let cumulativeY = 0

                            interface PanelPosition {
                              view: typeof drawingData.planViews[0]
                              x: number
                              y: number
                              displayWidth: number
                              displayHeight: number
                              translateY: string
                              rotation: number
                              transformOrigin: string
                              imageSrc: string
                            }

                            const panelPositions: PanelPosition[] = []
                            let minX = Infinity
                            let maxX = -Infinity
                            let minY = Infinity
                            let maxY = -Infinity

                            segments.forEach((segment, segmentIndex) => {
                              const isHorizontal = segment.direction === 'horizontal'
                              const isVerticalDown = segment.direction === 'vertical-down'

                              console.log(`\nCalculating segment ${segmentIndex}: ${segment.direction}, starting at X=${cumulativeX}, Y=${cumulativeY}`)

                              segment.views.forEach((view, viewIndex) => {
                                const imageSrc = getImageDataUrl(view.imageData)
                                const displayHeight = view.height * pixelsPerInch
                                const displayWidth = view.width * pixelsPerInch

                                // Calculate position and rotation
                                let x = cumulativeX
                                let y = cumulativeY
                                let translateY = '0px'
                                let rotation = 0
                                let transformOrigin = 'center center'

                                if (isHorizontal) {
                                  // Horizontal layout - no rotation
                                  translateY = view.orientation === 'bottom'
                                    ? `-${displayHeight}px`
                                    : `0px`

                                  console.log(`  Panel ${viewIndex} (${view.productName}): X=${x}, translateY=${translateY}, width=${displayWidth}`)

                                  // Update bounding box for horizontal panel
                                  minX = Math.min(minX, x)
                                  maxX = Math.max(maxX, x + displayWidth)
                                  const yWithTranslate = view.orientation === 'bottom' ? y - displayHeight : y
                                  minY = Math.min(minY, yWithTranslate)
                                  maxY = Math.max(maxY, yWithTranslate + displayHeight)

                                  // Add this panel's width to cumulative X for next panel
                                  cumulativeX += displayWidth
                                } else {
                                  // Vertical layout - rotate 90 degrees and position at corner
                                  const isSquarish = Math.abs(displayWidth - displayHeight) < 20

                                  if (isVerticalDown) {
                                    rotation = 90
                                    transformOrigin = isSquarish ? 'left top' : 'left center'

                                    if (isSquarish) {
                                      x = x + displayHeight
                                    }

                                    translateY = '0px'
                                    console.log(`  Panel ${viewIndex} (${view.productName}): X=${x}, Y=${y}, rotation=90°, isSquare=${isSquarish}, origin=${transformOrigin}`)

                                    // Update bounding box for vertical-down panel (rotated 90°)
                                    // After rotation, width becomes height and height becomes width
                                    minX = Math.min(minX, x)
                                    maxX = Math.max(maxX, x + displayHeight)
                                    minY = Math.min(minY, y)
                                    maxY = Math.max(maxY, y + displayWidth)

                                    cumulativeY += displayWidth
                                  } else {
                                    // Vertical up - rotate counterclockwise
                                    rotation = -90
                                    transformOrigin = isSquarish ? 'left bottom' : 'left center'

                                    if (isSquarish) {
                                      y = -displayHeight
                                      x = x + displayHeight
                                    }

                                    translateY = '0px'
                                    console.log(`  Panel ${viewIndex} (${view.productName}): X=${x}, Y=${y}, rotation=-90°, isSquare=${isSquarish}, origin=${transformOrigin}`)

                                    // Update bounding box for vertical-up panel (rotated -90°)
                                    minX = Math.min(minX, x)
                                    maxX = Math.max(maxX, x + displayHeight)
                                    minY = Math.min(minY, y - displayWidth)
                                    maxY = Math.max(maxY, y)

                                    cumulativeY -= displayWidth
                                  }
                                }

                                panelPositions.push({
                                  view,
                                  x,
                                  y,
                                  displayWidth,
                                  displayHeight,
                                  translateY,
                                  rotation,
                                  transformOrigin,
                                  imageSrc
                                })
                              })
                            })

                            // Calculate center offset to center the entire assembly
                            const assemblyWidth = maxX - minX
                            const assemblyHeight = maxY - minY
                            const centerOffsetX = -minX - assemblyWidth / 2
                            const centerOffsetY = -minY - assemblyHeight / 2

                            console.log(`\nAssembly bounds: minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`)
                            console.log(`Assembly size: ${assemblyWidth} x ${assemblyHeight}`)
                            console.log(`Center offset: X=${centerOffsetX}, Y=${centerOffsetY}`)

                            // Second pass: render all panels with center offset applied
                            const allImages: JSX.Element[] = panelPositions.map((panel, index) => {
                              const adjustedX = panel.x + centerOffsetX
                              const adjustedY = panel.y + centerOffsetY

                              return (
                                <img
                                  key={index}
                                  src={panel.imageSrc}
                                  alt={`${panel.view.productName} - ${panel.view.planViewName}`}
                                  style={{
                                    height: `${panel.displayHeight}px`,
                                    width: `${panel.displayWidth}px`,
                                    display: 'block',
                                    position: 'absolute',
                                    left: `calc(50% + ${adjustedX}px)`,
                                    top: `calc(50% + ${adjustedY}px)`,
                                    transform: `translate(0, ${panel.translateY}) rotate(${panel.rotation}deg)`,
                                    transformOrigin: panel.transformOrigin
                                  }}
                                  onError={(e) => {
                                    console.error('Image load error for:', panel.view.productName, panel.view.planViewName)
                                  }}
                                />
                              )
                            })

                            return allImages
                          })()}
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
                      <h3 className="text-lg font-medium mb-4">Plan View</h3>
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
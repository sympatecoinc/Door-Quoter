'use client'

import { useState, useEffect } from 'react'
import { X, Download, FileText, Eye } from 'lucide-react'

interface DrawingData {
  elevation_image?: string
  plan_image?: string
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

  const handleTabChange = (tab: 'elevation' | 'plan' | 'schedule') => {
    setActiveTab(tab)
    if (tab === 'elevation' && !drawingData?.elevation_image) {
      generateElevationDrawing()
    } else if (tab === 'plan' && !drawingData?.plan_image) {
      generatePlanDrawing()
    }
  }

  // Clear cache when opening ID changes (direction updated)
  useEffect(() => {
    if (isOpen && openingId !== lastOpeningId) {
      setDrawingData(null)
      setLastOpeningId(openingId)
      setActiveTab('elevation')
      generateElevationDrawing()
    } else if (isOpen && !drawingData?.elevation_image) {
      generateElevationDrawing()
    }
  }, [isOpen, openingId, lastOpeningId, drawingData?.elevation_image])

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
              {activeTab === 'elevation' && drawingData?.elevation_image && (
                <div className="space-y-4">
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
                </div>
              )}

              {/* Plan Tab */}
              {activeTab === 'plan' && drawingData?.plan_image && (
                <div className="space-y-4">
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
                </div>
              )}

              {/* Plan Tab Error */}
              {activeTab === 'plan' && !drawingData?.plan_image && !loading && (
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
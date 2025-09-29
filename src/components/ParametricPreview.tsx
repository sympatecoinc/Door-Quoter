'use client'

import { useState, useEffect, useMemo } from 'react'
import { processParametricSVG, svgToDataUrl, ScalingDimensions, ComponentType, ViewMode } from '@/lib/parametric-svg'
import { RefreshCw, Download, Eye, Settings, AlertCircle } from 'lucide-react'

interface ParametricPreviewProps {
  svgData?: string
  targetDimensions: ScalingDimensions
  mode?: ViewMode
  className?: string
  showControls?: boolean
  onScaledSVG?: (scaledSVG: string) => void
}

export default function ParametricPreview({
  svgData,
  targetDimensions,
  mode = 'elevation',
  className = '',
  showControls = true,
  onScaledSVG
}: ParametricPreviewProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  // Process SVG when data or dimensions change
  const processedSVG = useMemo(() => {
    if (!svgData || !svgData.trim()) {
      return null
    }

    try {
      setError(null)
      setIsProcessing(true)

      const result = processParametricSVG(svgData, targetDimensions, mode)

      // Notify parent component of scaled SVG
      if (onScaledSVG) {
        onScaledSVG(result.scaledSVG)
      }

      setIsProcessing(false)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown processing error'
      setError(errorMessage)
      setIsProcessing(false)
      return null
    }
  }, [svgData, targetDimensions.width, targetDimensions.height, mode, onScaledSVG])

  const handleDownload = () => {
    if (!processedSVG) return

    const blob = new Blob([processedSVG.scaledSVG], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parametric-${mode}-${targetDimensions.width}x${targetDimensions.height}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getComponentTypeColor = (type: ComponentType): string => {
    switch (type) {
      case 'vertical': return 'bg-blue-100 text-blue-700'
      case 'horizontal': return 'bg-green-100 text-green-700'
      case 'grow': return 'bg-purple-100 text-purple-700'
      case 'glassstop': return 'bg-yellow-100 text-yellow-700'
      case 'fixed': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (!svgData) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <div className="text-center text-gray-500 p-8">
          <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Upload an SVG to see parametric preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      {showControls && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">
              Parametric Preview ({targetDimensions.width} × {targetDimensions.height})
            </h3>
            {isProcessing && (
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded"
              title="Toggle details"
            >
              <Settings className="w-4 h-4" />
            </button>

            {processedSVG && (
              <button
                onClick={handleDownload}
                className="p-2 text-gray-400 hover:text-blue-600 rounded"
                title="Download scaled SVG"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">
              <strong>Processing Error:</strong> {error}
            </p>
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="p-4">
        {isProcessing ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
              <p className="text-gray-500">Processing parametric scaling...</p>
            </div>
          </div>
        ) : processedSVG ? (
          <div className="space-y-4">
            {/* SVG Preview */}
            <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
              <img
                src={svgToDataUrl(processedSVG.scaledSVG)}
                alt={`${mode} view preview`}
                className="max-w-full max-h-96 border border-gray-300 rounded shadow-sm"
                style={{
                  maxWidth: Math.min(400, targetDimensions.width * 2),
                  maxHeight: Math.min(300, targetDimensions.height * 2)
                }}
              />
            </div>

            {/* Details */}
            {showDetails && (
              <div className="space-y-3 text-sm">
                {/* Scaling Info */}
                <div className="bg-blue-50 p-3 rounded">
                  <h4 className="font-medium text-blue-900 mb-2">Scaling Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-blue-800">
                    <div>Original: {processedSVG.scaling.original.width} × {processedSVG.scaling.original.height}</div>
                    <div>Target: {processedSVG.scaling.target.width} × {processedSVG.scaling.target.height}</div>
                    <div>Scale X: {processedSVG.scaling.scaleX.toFixed(3)}</div>
                    <div>Scale Y: {processedSVG.scaling.scaleY.toFixed(3)}</div>
                  </div>
                </div>

                {/* Component Transforms */}
                {processedSVG.transforms.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Component Transforms ({processedSVG.transforms.length})
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {processedSVG.transforms.map((transform, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-600">
                              {transform.elementId || `element-${i}`}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${getComponentTypeColor(transform.elementType)}`}>
                              {transform.elementType}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">
                            {transform.transform}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Unable to process SVG for preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Simplified version for inline use
export function InlineParametricPreview({
  svgData,
  targetDimensions,
  mode = 'elevation',
  className = 'w-32 h-32'
}: {
  svgData?: string
  targetDimensions: ScalingDimensions
  mode?: ViewMode
  className?: string
}) {
  const processedSVG = useMemo(() => {
    if (!svgData || !svgData.trim()) return null

    try {
      return processParametricSVG(svgData, targetDimensions, mode)
    } catch {
      return null
    }
  }, [svgData, targetDimensions.width, targetDimensions.height, mode])

  if (!processedSVG) {
    return (
      <div className={`bg-gray-100 border border-gray-300 rounded flex items-center justify-center ${className}`}>
        <span className="text-xs text-gray-500">No Preview</span>
      </div>
    )
  }

  return (
    <img
      src={svgToDataUrl(processedSVG.scaledSVG)}
      alt={`${mode} preview`}
      className={`border border-gray-300 rounded object-contain ${className}`}
    />
  )
}
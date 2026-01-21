'use client'

import { useState, useEffect, useRef } from 'react'
import { ProductType } from '@prisma/client'
import {
  Plus,
  Upload,
  Trash2,
  Eye,
  Edit3,
  AlertCircle,
  Check,
  X,
  FileText,
  Image as ImageIcon
} from 'lucide-react'
import { processParametricSVG, validateParametricSVG, svgToDataUrl, ComponentType } from '@/lib/parametric-svg'

interface ComponentLibraryItem {
  id: number
  name: string
  description?: string
  hasSwingDirection: boolean
  hasSlidingDirection: boolean
  elevationImageData?: string
  planImageData?: string
  elevationFileName?: string
  planFileName?: string
  isParametric: boolean
  productType: ProductType
  createdAt: string
  updatedAt: string
  _count?: {
    panels: number
  }
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  detectedComponents: { id: string; type: ComponentType }[]
}

export default function ComponentLibraryManager() {
  const [components, setComponents] = useState<ComponentLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hasSwingDirection: false,
    hasSlidingDirection: false,
    isParametric: true,
    productType: 'SWING_DOOR' as ProductType
  })
  const [elevationFile, setElevationFile] = useState<File | null>(null)
  const [planFile, setPlanFile] = useState<File | null>(null)
  const [previewMode, setPreviewMode] = useState<'elevation' | 'plan'>('elevation')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [previewSVG, setPreviewSVG] = useState<string>('')
  const [viewingImage, setViewingImage] = useState<{ data: string; title: string; type: 'elevation' | 'plan' } | null>(null)

  const elevationFileRef = useRef<HTMLInputElement>(null)
  const planFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchComponents()
  }, [])

  const fetchComponents = async () => {
    try {
      const response = await fetch('/api/component-library')
      if (response.ok) {
        const data = await response.json()
        setComponents(data)
      }
    } catch (error) {
      console.error('Error fetching components:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (file: File, type: 'elevation' | 'plan') => {
    if (!file.type.includes('svg') && !file.type.includes('image')) {
      alert('Please upload SVG or image files only')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string

      if (type === 'elevation') {
        setElevationFile(file)
        if (file.type.includes('svg')) {
          validateAndPreviewSVG(content)
        }
      } else {
        setPlanFile(file)
      }
    }
    reader.readAsText(file)
  }

  const validateAndPreviewSVG = (svgContent: string) => {
    try {
      const validationResult = validateParametricSVG(svgContent)
      setValidation(validationResult)

      // Generate preview with test dimensions
      if (validationResult.isValid) {
        const { scaledSVG } = processParametricSVG(svgContent, { width: 200, height: 300 }, 'elevation')
        setPreviewSVG(scaledSVG)
      }
    } catch (error) {
      setValidation({
        isValid: false,
        errors: [`Preview error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        detectedComponents: []
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      alert('Component name is required')
      return
    }

    try {
      const elevationData = elevationFile ? await fileToBase64(elevationFile) : undefined
      const planData = planFile ? await fileToBase64(planFile) : undefined

      const payload = {
        ...formData,
        elevationImageData: elevationData,
        planImageData: planData,
        elevationFileName: elevationFile?.name,
        planFileName: planFile?.name
      }

      const url = editingId ? `/api/component-library/${editingId}` : '/api/component-library'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        await fetchComponents()
        resetForm()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save component')
      }
    } catch (error) {
      console.error('Error saving component:', error)
      alert('Failed to save component')
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      hasSwingDirection: false,
      hasSlidingDirection: false,
      isParametric: true,
      productType: 'SWING_DOOR'
    })
    setElevationFile(null)
    setPlanFile(null)
    setEditingId(null)
    setShowForm(false)
    setValidation(null)
    setPreviewSVG('')
    if (elevationFileRef.current) elevationFileRef.current.value = ''
    if (planFileRef.current) planFileRef.current.value = ''
  }

  const handleEdit = (component: ComponentLibraryItem) => {
    setFormData({
      name: component.name,
      description: component.description || '',
      hasSwingDirection: component.hasSwingDirection,
      hasSlidingDirection: component.hasSlidingDirection,
      isParametric: component.isParametric,
      productType: component.productType
    })
    setEditingId(component.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this component?')) return

    try {
      const response = await fetch(`/api/component-library/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchComponents()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete component')
      }
    } catch (error) {
      console.error('Error deleting component:', error)
      alert('Failed to delete component')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8">Loading component library...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Component Library</h2>
          <p className="text-gray-600 mt-1">Manage parametric SVG components for door drawings</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Component
        </button>
      </div>

      {/* Component Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingId ? 'Edit Component' : 'Add New Component'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Component Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Standard Swing Door"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Type
                </label>
                <select
                  value={formData.productType}
                  onChange={(e) => setFormData({ ...formData, productType: e.target.value as ProductType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="SWING_DOOR">Swing Door</option>
                  <option value="SLIDING_DOOR">Sliding Door</option>
                  <option value="FIXED_PANEL">Fixed Panel</option>
                  <option value="CORNER_90">90 Degree Corner</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasSwingDirection}
                  onChange={(e) => setFormData({ ...formData, hasSwingDirection: e.target.checked })}
                  className="mr-2"
                />
                Has Swing Direction
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.hasSlidingDirection}
                  onChange={(e) => setFormData({ ...formData, hasSlidingDirection: e.target.checked })}
                  className="mr-2"
                />
                Has Sliding Direction
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isParametric}
                  onChange={(e) => setFormData({ ...formData, isParametric: e.target.checked })}
                  className="mr-2"
                />
                Parametric Scaling
              </label>
            </div>

            {/* File Uploads */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Elevation View
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400">
                  <input
                    type="file"
                    ref={elevationFileRef}
                    accept=".svg,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'elevation')
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => elevationFileRef.current?.click()}
                    className="w-full flex flex-col items-center py-2"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">
                      {elevationFile ? elevationFile.name : 'Upload elevation SVG/image'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plan View
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400">
                  <input
                    type="file"
                    ref={planFileRef}
                    accept=".svg,image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'plan')
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => planFileRef.current?.click()}
                    className="w-full flex flex-col items-center py-2"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">
                      {planFile ? planFile.name : 'Upload plan SVG/image'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Results */}
            {validation && (
              <div className={`p-4 rounded-lg ${validation.isValid ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {validation.isValid ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`font-medium ${validation.isValid ? 'text-green-700' : 'text-red-700'}`}>
                    {validation.isValid ? 'SVG Valid for Parametric Scaling' : 'SVG Validation Issues'}
                  </span>
                </div>

                {validation.errors.length > 0 && (
                  <ul className="text-sm text-red-600 space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                )}

                {validation.detectedComponents.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">Detected Components:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {validation.detectedComponents.map((comp, i) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {comp.id} ({comp.type})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview */}
            {previewSVG && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Parametric Preview (200×300):</p>
                <div className="flex justify-center">
                  <img
                    src={svgToDataUrl(previewSVG)}
                    alt="Parametric preview"
                    className="max-w-[200px] max-h-[300px] border border-gray-300 rounded"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingId ? 'Update Component' : 'Create Component'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Components List */}
      <div className="bg-white rounded-lg shadow-lg border">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Components ({components.length})</h3>
        </div>

        {components.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No components yet. Add your first parametric component to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {components.map((component) => (
              <div key={component.id} className="p-4 hover:bg-gray-50">
                <div className="flex gap-4">
                  {/* Thumbnail Images */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Elevation Thumbnail */}
                    {component.elevationImageData ? (
                      <div className="relative group">
                        <img
                          src={component.elevationImageData}
                          alt={`${component.name} elevation`}
                          className="w-32 h-32 object-contain border border-gray-300 rounded bg-gray-50 cursor-pointer hover:border-blue-400 transition-colors"
                          onClick={() => setViewingImage({
                            data: component.elevationImageData!,
                            title: `${component.name} - Elevation`,
                            type: 'elevation'
                          })}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded flex items-center justify-center transition-all">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="absolute bottom-1 left-1 right-1 text-center text-xs bg-black bg-opacity-60 text-white px-1 py-0.5 rounded">
                          Elevation
                        </span>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex flex-col items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                        <span className="text-xs text-gray-400">No elevation</span>
                      </div>
                    )}

                    {/* Plan Thumbnail */}
                    {component.planImageData ? (
                      <div className="relative group">
                        <img
                          src={component.planImageData}
                          alt={`${component.name} plan`}
                          className="w-32 h-32 object-contain border border-gray-300 rounded bg-gray-50 cursor-pointer hover:border-blue-400 transition-colors"
                          onClick={() => setViewingImage({
                            data: component.planImageData!,
                            title: `${component.name} - Plan`,
                            type: 'plan'
                          })}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded flex items-center justify-center transition-all">
                          <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="absolute bottom-1 left-1 right-1 text-center text-xs bg-black bg-opacity-60 text-white px-1 py-0.5 rounded">
                          Plan
                        </span>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex flex-col items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-300 mb-1" />
                        <span className="text-xs text-gray-400">No plan</span>
                      </div>
                    )}
                  </div>

                  {/* Component Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">{component.name}</h4>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {component.productType.replace('_', ' ')}
                      </span>
                      {component.isParametric && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          Parametric
                        </span>
                      )}
                    </div>

                    {component.description && (
                      <p className="text-sm text-gray-600 mb-2">{component.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {component.elevationFileName && (
                        <span>Elevation: {component.elevationFileName}</span>
                      )}
                      {component.planFileName && (
                        <span>Plan: {component.planFileName}</span>
                      )}
                      {component._count && component._count.panels > 0 && (
                        <span>Used in {component._count.panels} panel(s)</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(component)}
                      className="p-2 text-gray-400 hover:text-blue-600"
                      title="Edit component"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(component.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                      title="Delete component"
                      disabled={!!(component._count?.panels && component._count.panels > 0)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-8"
          onClick={() => setViewingImage(null)}
        >
          <div
            className="bg-white rounded-lg max-w-5xl max-h-full overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">{viewingImage.title}</h3>
              <button
                onClick={() => setViewingImage(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 flex justify-center items-center bg-gray-50">
              <img
                src={viewingImage.data}
                alt={viewingImage.title}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileImage,
  Loader2
} from 'lucide-react'

interface ProjectInfo {
  id: number
  name: string
  customerName: string | null
  uploads: {
    id: number
    originalName: string
    uploadedAt: string
  }[]
}

export default function FieldVerificationCapturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Fetch project info
  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/field-verification/${token}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load project')
      }
      const data = await response.json()
      setProject(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUploadError('Please select an image file')
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setUploadError('Image must be less than 10MB')
        return
      }

      setSelectedFile(file)
      setUploadError(null)
      setUploadSuccess(false)

      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Clear selected file
  const clearSelection = () => {
    setSelectedFile(null)
    setPreview(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`/api/field-verification/${token}/upload`, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      setUploadSuccess(true)
      setSelectedFile(null)
      setPreview(null)

      // Refresh project data to show the new upload
      fetchProject()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Load
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchProject}
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <FileImage className="h-5 w-5" />
            <span className="text-sm font-medium opacity-80">Field Verification</span>
          </div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          {project.customerName && (
            <p className="text-sm text-indigo-100">{project.customerName}</p>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Success Message */}
          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Upload Successful!</p>
                <p className="text-sm text-green-600">Your photo has been saved.</p>
              </div>
            </div>
          )}

          {/* Upload Card */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Upload Completed Form
            </h2>

            {!selectedFile ? (
              <div className="space-y-4">
                {/* Hidden file inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Camera Button */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Camera className="h-6 w-6" />
                  <span className="font-medium">Take Photo</span>
                </button>

                {/* Gallery Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-3 py-4 px-4 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Upload className="h-6 w-6" />
                  <span className="font-medium">Choose from Gallery</span>
                </button>

                <p className="text-sm text-gray-500 text-center">
                  Take a clear photo of the completed field verification form showing all written measurements.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview */}
                <div className="relative">
                  <img
                    src={preview || ''}
                    alt="Preview"
                    className="w-full rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={clearSelection}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* File info */}
                <p className="text-sm text-gray-600 text-center">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                </p>

                {/* Upload Error */}
                {uploadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600">{uploadError}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={clearSelection}
                    disabled={uploading}
                    className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Previous Uploads */}
          {project.uploads.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-3">
                Previous Uploads ({project.uploads.length})
              </h3>
              <ul className="space-y-2">
                {project.uploads.map((upload) => (
                  <li
                    key={upload.id}
                    className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {upload.originalName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(upload.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-gray-500">
        Field Verification Upload
      </footer>
    </div>
  )
}

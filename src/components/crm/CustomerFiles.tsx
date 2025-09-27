'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, File, Download, Trash2, Eye, Calendar, User, FileText, Image, Archive, Video } from 'lucide-react'

interface CustomerFile {
  id: number
  customerId: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy?: string
  createdAt: string
  url?: string
}

interface CustomerFilesProps {
  customerId: number
}

export default function CustomerFiles({ customerId }: CustomerFilesProps) {
  const [files, setFiles] = useState<CustomerFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFiles()
  }, [customerId])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/files`)
      if (response.ok) {
        const filesData = await response.json()
        setFiles(filesData)
      } else {
        console.error('Failed to fetch files')
      }
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (filesToUpload: FileList) => {
    if (!filesToUpload.length) return

    setUploading(true)
    try {
      const formData = new FormData()

      Array.from(filesToUpload).forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/customers/${customerId}/files`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const newFiles = await response.json()
        setFiles(prev => [...newFiles, ...prev])
      } else {
        console.error('Failed to upload files')
      }
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(`/api/customers/${customerId}/files/${fileId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setFiles(prev => prev.filter(file => file.id !== fileId))
      } else {
        console.error('Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const handleDownloadFile = (file: CustomerFile) => {
    if (file.url) {
      const link = document.createElement('a')
      link.href = file.url
      link.download = file.originalName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="w-8 h-8 text-blue-600" />
    } else if (mimeType.startsWith('video/')) {
      return <Video className="w-8 h-8 text-purple-600" />
    } else if (mimeType.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-600" />
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <Archive className="w-8 h-8 text-yellow-600" />
    } else {
      return <File className="w-8 h-8 text-gray-600" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Files</h2>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Upload Files
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop files here, or click to select files
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Select Files'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-4">
        {files.length > 0 ? (
          files.map((file) => (
            <div key={file.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {file.originalName}
                    </h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span>{formatFileSize(file.size)}</span>
                      <div className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        <span>{file.uploadedBy || 'Unknown User'}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {file.mimeType.startsWith('image/') && file.url && (
                    <button
                      onClick={() => window.open(file.url, '_blank')}
                      className="text-blue-600 hover:text-blue-800"
                      title="Preview image"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadFile(file)}
                    className="text-green-600 hover:text-green-800"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Image Preview for image files */}
              {file.mimeType.startsWith('image/') && file.url && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <img
                    src={file.url}
                    alt={file.originalName}
                    className="max-w-xs max-h-48 rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center py-8 text-gray-500">
              <File className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files uploaded</h3>
              <p className="text-gray-600 mb-4">
                Upload files related to this customer to keep everything organized in one place.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload First File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
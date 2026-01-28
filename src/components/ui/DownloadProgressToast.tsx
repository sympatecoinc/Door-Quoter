'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import type { Download } from '@/stores/downloadStore'

interface DownloadProgressToastProps {
  download: Download
  index: number
  onDismiss: () => void
}

export function DownloadProgressToast({ download, index, onDismiss }: DownloadProgressToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(onDismiss, 300) // Allow exit animation to complete
  }

  const getTypeStyles = () => {
    switch (download.status) {
      case 'processing':
        return {
          bg: 'bg-blue-100/90 border-blue-300',
          text: 'text-blue-900',
          icon: 'bg-blue-500 text-white',
          close: 'text-blue-700/70 hover:text-blue-900',
          progress: 'bg-blue-500'
        }
      case 'complete':
        return {
          bg: 'bg-green-100/90 border-green-300',
          text: 'text-green-900',
          icon: 'bg-green-500 text-white',
          close: 'text-green-700/70 hover:text-green-900',
          progress: 'bg-green-500'
        }
      case 'error':
        return {
          bg: 'bg-red-100/90 border-red-300',
          text: 'text-red-900',
          icon: 'bg-red-500 text-white',
          close: 'text-red-700/70 hover:text-red-900',
          progress: 'bg-red-500'
        }
    }
  }

  const getIcon = () => {
    switch (download.status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'complete':
        return <Check className="w-4 h-4" />
      case 'error':
        return <X className="w-4 h-4" />
    }
  }

  const getStatusText = () => {
    switch (download.status) {
      case 'processing':
        if (download.progress !== undefined && download.progress > 0) {
          return `Processing... ${Math.round(download.progress)}%`
        }
        return 'Processing...'
      case 'complete':
        return 'Download complete'
      case 'error':
        return download.error || 'Download failed'
    }
  }

  const styles = getTypeStyles()

  return (
    <div
      style={{ bottom: `${1 + index * 5}rem` }}
      className={`fixed right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ease-out transform backdrop-blur-sm min-w-[280px] max-w-[400px] ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      } ${styles.bg}`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${styles.icon}`}>
          {getIcon()}
        </span>
        <div className="flex-1 min-w-0">
          <div className={`font-medium truncate ${styles.text}`}>
            {download.name}
          </div>
          <div className={`text-sm ${styles.text} opacity-80`}>
            {getStatusText()}
          </div>
          {download.status === 'processing' && download.progress !== undefined && download.progress > 0 && (
            <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${styles.progress}`}
                style={{ width: `${download.progress}%` }}
              />
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`text-lg leading-none transition-colors flex-shrink-0 ${styles.close}`}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )
}

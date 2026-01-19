'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
  index?: number
}

export function Toast({ message, type = 'success', duration = 3000, onClose, index = 0 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Allow fade out animation to complete
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-100/90 border-green-300',
          text: 'text-green-900',
          icon: 'bg-green-500 text-white',
          close: 'text-green-700/70 hover:text-green-900'
        }
      case 'error':
        return {
          bg: 'bg-red-100/90 border-red-300',
          text: 'text-red-900',
          icon: 'bg-red-500 text-white',
          close: 'text-red-700/70 hover:text-red-900'
        }
      case 'info':
        return {
          bg: 'bg-blue-100/90 border-blue-300',
          text: 'text-blue-900',
          icon: 'bg-blue-500 text-white',
          close: 'text-blue-700/70 hover:text-blue-900'
        }
      default:
        return {
          bg: 'bg-green-100/90 border-green-300',
          text: 'text-green-900',
          icon: 'bg-green-500 text-white',
          close: 'text-green-700/70 hover:text-green-900'
        }
    }
  }

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'info':
        return 'ℹ'
      default:
        return '✓'
    }
  }

  const styles = getTypeStyles()

  return (
    <div
      style={{ bottom: `${1 + index * 4}rem` }}
      className={`fixed right-4 z-50 px-4 py-3 rounded-xl border shadow-2xl transition-all duration-300 ease-out transform backdrop-blur-sm ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      } ${styles.bg}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${styles.icon}`}>
          {getIcon()}
        </span>
        <span className={`font-medium ${styles.text}`}>{message}</span>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          className={`ml-2 text-lg leading-none transition-colors ${styles.close}`}
        >
          ×
        </button>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Array<{
    id: string
    message: string
    type?: 'success' | 'error' | 'info'
    duration?: number
  }>
  removeToast: (id: string) => void
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <>
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
          index={index}
        />
      ))}
    </>
  )
}
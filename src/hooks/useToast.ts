'use client'

import { useState, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message: string, duration?: number) => {
    addToast({ message, type: 'success', duration })
  }, [addToast])

  const showError = useCallback((message: string, duration?: number) => {
    addToast({ message, type: 'error', duration })
  }, [addToast])

  const showInfo = useCallback((message: string, duration?: number) => {
    addToast({ message, type: 'info', duration })
  }, [addToast])

  return {
    toasts,
    removeToast,
    showSuccess,
    showError,
    showInfo
  }
}
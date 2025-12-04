'use client'

import { useEffect, useCallback } from 'react'

interface ModalHandler {
  isOpen: boolean
  isBlocked?: boolean // If true, don't allow closing (e.g., during save/delete)
  onClose: () => void
}

/**
 * Hook to handle Escape key for closing modals.
 * Pass modals in priority order (topmost first).
 * Only closes one modal per Escape press.
 */
export function useEscapeKey(modals: ModalHandler[]) {
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Find the first open modal that isn't blocked and close it
      for (const modal of modals) {
        if (modal.isOpen && !modal.isBlocked) {
          modal.onClose()
          break
        }
      }
    }
  }, [modals])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleEscapeKey])
}

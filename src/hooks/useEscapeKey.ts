'use client'

import { useEffect, useRef } from 'react'

interface ModalHandler {
  isOpen: boolean
  isBlocked?: boolean // If true, don't allow closing (e.g., during save/delete)
  onClose: () => void
}

// Global stack to track all registered escape handlers
// Handlers added later (nested/child components) are at the end
const escapeHandlerStack: Array<{
  id: number
  getModals: () => ModalHandler[]
}> = []
let handlerId = 0
let listenerAttached = false

// Global escape key handler - only attached once
function handleEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  // Check handlers in reverse order (most recently added first)
  // This ensures nested/child modals are closed before parent modals
  for (let i = escapeHandlerStack.length - 1; i >= 0; i--) {
    const handler = escapeHandlerStack[i]
    const handlerModals = handler.getModals()

    // Find the first open modal in this handler that isn't blocked
    for (const modal of handlerModals) {
      if (modal.isOpen && !modal.isBlocked) {
        event.preventDefault()
        modal.onClose()
        return // Stop after closing one modal
      }
    }
  }
}

/**
 * Hook to handle Escape key for closing modals.
 * Pass modals in priority order (topmost first).
 * Only closes one modal per Escape press across all components.
 *
 * When multiple components use this hook, the most recently mounted
 * component's modals are checked first (LIFO order).
 */
export function useEscapeKey(modals: ModalHandler[]) {
  // Store modals in a ref so the global handler can access current values
  const modalsRef = useRef(modals)
  modalsRef.current = modals

  useEffect(() => {
    // Register this component's modals on mount
    const id = ++handlerId
    escapeHandlerStack.push({
      id,
      getModals: () => modalsRef.current
    })

    // Attach global listener only once
    if (!listenerAttached) {
      document.addEventListener('keydown', handleEscapeKey)
      listenerAttached = true
    }

    // Cleanup on unmount
    return () => {
      const index = escapeHandlerStack.findIndex(h => h.id === id)
      if (index !== -1) {
        escapeHandlerStack.splice(index, 1)
      }

      // Remove global listener when no handlers remain
      if (escapeHandlerStack.length === 0 && listenerAttached) {
        document.removeEventListener('keydown', handleEscapeKey)
        listenerAttached = false
      }
    }
  }, [])
}

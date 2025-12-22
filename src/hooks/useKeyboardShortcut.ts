'use client'

import { useEffect, useCallback } from 'react'

interface UseKeyboardShortcutOptions {
  disabled?: boolean // Disable the shortcut (e.g., when a modal is already open)
}

/**
 * Hook to handle Cmd+N (Mac) / Ctrl+N (Windows/Linux) keyboard shortcut.
 * Useful for "Add New" actions across the application.
 *
 * @param callback - Function to call when shortcut is triggered
 * @param options - Configuration options
 */
export function useNewShortcut(
  callback: () => void,
  options: UseKeyboardShortcutOptions = {}
) {
  const { disabled = false } = options

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Ctrl+N (all platforms)
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        // Don't trigger if user is typing in an input field
        const target = event.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }

        // Always prevent browser default (new tab) for Cmd+N
        event.preventDefault()

        // Only trigger callback if not disabled
        if (!disabled) {
          callback()
        }
      }
    },
    [callback, disabled]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])
}

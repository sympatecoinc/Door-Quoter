'use client'

import { useState } from 'react'
import { Bell, ChevronDown, ChevronUp, X, Settings } from 'lucide-react'

interface MasterPart {
  id: number
  partNumber: string
  baseName: string
  partType: string
}

interface InventoryNotification {
  id: number
  type: string
  message: string
  masterPartId: number | null
  masterPart: MasterPart | null
  actionType: string | null
  isDismissed: boolean
  createdAt: string
}

interface Props {
  notifications: InventoryNotification[]
  onDismiss: (id: number) => void
  onSetupPart: (partId: number) => void
}

export default function InventoryNotificationBanner({
  notifications,
  onDismiss,
  onSetupPart
}: Props) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (notifications.length === 0) return null

  return (
    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-blue-900">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-blue-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-600" />
        )}
      </button>

      {/* Notification list - collapsible */}
      {isExpanded && (
        <div className="border-t border-blue-200 divide-y divide-blue-100">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className="px-4 py-3 flex items-center justify-between bg-white"
            >
              <div className="flex-1">
                <div className="text-sm text-gray-900">
                  {notification.message}
                </div>
                {notification.masterPart && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {notification.masterPart.partType} - {notification.masterPart.baseName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {notification.actionType === 'setup_part' && notification.masterPartId && (
                  <button
                    onClick={() => {
                      onSetupPart(notification.masterPartId!)
                      onDismiss(notification.id)
                    }}
                    className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <Settings className="w-4 h-4" />
                    Set Up Part
                  </button>
                )}
                <button
                  onClick={() => onDismiss(notification.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

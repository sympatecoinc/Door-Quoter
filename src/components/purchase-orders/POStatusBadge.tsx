'use client'

import { POStatus, PO_STATUS_CONFIG } from '@/types/purchase-order'

interface POStatusBadgeProps {
  status: POStatus
  size?: 'sm' | 'md' | 'lg'
}

export default function POStatusBadge({ status, size = 'md' }: POStatusBadgeProps) {
  const config = PO_STATUS_CONFIG[status] || PO_STATUS_CONFIG.DRAFT

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  )
}

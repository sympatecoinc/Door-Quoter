'use client'

import { SOStatus, SO_STATUS_CONFIG } from '@/types/sales-order'

interface SOStatusBadgeProps {
  status: SOStatus
  size?: 'sm' | 'md' | 'lg'
}

export default function SOStatusBadge({ status, size = 'md' }: SOStatusBadgeProps) {
  const config = SO_STATUS_CONFIG[status] || SO_STATUS_CONFIG.DRAFT

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm'
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bgColor} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  )
}
